'use strict';
const express = require('express');
const http = require('node:http');
const crypto = require('node:crypto');
const { createChatServer } = require('../../server');

const ISSUER = 'https://issuer.example.test/';
async function freePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startFixture({ port = 0, providerPort = 0, redisURL } = {}) {
  const { generateKeyPair, exportJWK, SignJWT } = require('jose');
  const { createAuth0 } = require('@auth0/auth0-express');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const provider = express();
  const codes = new Map();
  const behavior = { expired: false, tokenLifetime: 3600 };
  provider.use(express.urlencoded({ extended: false }));
  provider.get('/.well-known/openid-configuration', (req, res) => res.json({
    issuer: ISSUER, authorization_endpoint: ISSUER + 'authorize', token_endpoint: ISSUER + 'oauth/token',
    jwks_uri: ISSUER + 'jwks', end_session_endpoint: ISSUER + 'oidc/logout',
    response_types_supported: ['code'], subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'], code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic']
  }));
  provider.get('/jwks', (req, res) => res.json({ keys: [jwk] }));
  provider.get('/authorize', (req, res) => {
    const target = new URL(req.query.redirect_uri);
    if (req.query.state) target.searchParams.set('state', req.query.state);
    if (req.query.cancel === '1') target.searchParams.set('error', 'access_denied');
    else {
      const code = crypto.randomUUID();
      codes.set(code, { ...req.query });
      target.searchParams.set('code', code);
    }
    res.redirect(target.href);
  });
  provider.post('/oauth/token', async (req, res) => {
    const code = codes.get(req.body.code);
    codes.delete(req.body.code);
    if (!code || req.body.grant_type !== 'authorization_code' ||
        req.body.redirect_uri !== code.redirect_uri ||
        crypto.createHash('sha256').update(req.body.code_verifier || '').digest('base64url') !== code.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const basic = req.headers.authorization?.startsWith('Basic ')
      ? Buffer.from(req.headers.authorization.slice(6), 'base64').toString() : '';
    if (!(req.body.client_id === 'test-client' && req.body.client_secret === 'test-client-secret') &&
        basic !== 'test-client:test-client-secret') return res.status(401).json({ error: 'invalid_client' });
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ name: 'Ana', email: 'ana@example.test', sid: crypto.randomUUID(),
      ...(code.nonce ? { nonce: code.nonce } : {}) })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(ISSUER).setAudience('test-client').setSubject('google-oauth2|test-user')
      .setIssuedAt(now).setExpirationTime(behavior.expired ? now - 120 : now + behavior.tokenLifetime).sign(privateKey);
    res.json({ access_token: 'test-access-token', token_type: 'Bearer', expires_in: 3600, id_token: token });
  });
  provider.get(['/oidc/logout', '/v2/logout'], (req, res) => res.redirect(req.query.post_logout_redirect_uri || req.query.returnTo));
  const providerHttp = http.createServer(provider);
  await new Promise((resolve) => providerHttp.listen(providerPort, '127.0.0.1', resolve));
  const providerURL = 'http://127.0.0.1:' + providerHttp.address().port;
  const appPort = port || await freePort();
  const baseURL = 'http://localhost:' + appPort;
  const env = { PORT: String(appPort), APP_BASE_URL: baseURL, AUTH0_DOMAIN: 'issuer.example.test',
    AUTH0_CLIENT_ID: 'test-client', AUTH0_CLIENT_SECRET: 'test-client-secret',
    AUTH0_SESSION_SECRET: crypto.randomBytes(32).toString('hex') };
  const router = createAuth0({ domain: env.AUTH0_DOMAIN, clientId: env.AUTH0_CLIENT_ID,
    clientSecret: env.AUTH0_CLIENT_SECRET, appBaseUrl: baseURL, sessionSecret: env.AUTH0_SESSION_SECRET,
    mountRoutes: false, sessionConfiguration: { rolling: false, absoluteDuration: 3600,
      inactivityDuration: 3600, cookie: { secure: false, httpOnly: true, sameSite: 'lax' } },
    customFetch: (input, init) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      if (url.origin !== new URL(ISSUER).origin) throw new Error('Unexpected issuer request');
      return fetch(providerURL + url.pathname + url.search, init);
    }
  });
  router.use((req, res, next) => {
    // Solo en pruebas: resolver el issuer HTTPS ficticio hacia el proveedor loopback del navegador.
    // El SDK sigue validando el issuer original y el canje PKCE; el servidor real no usa este adaptador.
    const redirect = res.redirect.bind(res);
    res.redirect = (url) => redirect(typeof url === 'string' && url.startsWith(ISSUER)
      ? providerURL + '/' + url.slice(ISSUER.length) : url);
    const original = req.auth0.client;
    req.auth0.client = {
      getSession: original.getSession.bind(original),
      startInteractiveLogin: original.startInteractiveLogin.bind(original),
      logout: original.logout.bind(original),
      completeInteractiveLogin: async (...args) => {
        try { return await original.completeInteractiveLogin(...args); }
        catch (error) { behavior.lastError = error; throw error; }
      }
    };
    next();
  });
  if (redisURL) env.REDIS_URL = redisURL;
  const chat = createChatServer({ env, sessionMiddleware: router });
  await new Promise((resolve) => chat.http.listen(appPort, resolve));
  return { ...chat, provider, providerURL, baseURL, env, behavior, issuer: ISSUER, sessionMiddleware: router,
    close: async () => {
      await new Promise((resolve) => chat.io.close(resolve));
      await new Promise((resolve) => providerHttp.close(resolve));
    } };
}

if (require.main === module) {
  startFixture({ port: Number(process.env.PORT || 3000), providerPort: Number(process.env.OIDC_TEST_PORT || Number(process.env.PORT || 3000) + 1) })
    .then((fixture) => {
      console.log('Test OIDC fixture listening on ' + fixture.baseURL);
      for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => fixture.close().then(() => process.exit(0)));
    }).catch((error) => { console.error(error); process.exitCode = 1; });
}
module.exports = { startFixture };
