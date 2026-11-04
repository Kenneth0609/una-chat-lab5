'use strict';
// Solo las pruebas importan este middleware; los puntos de entrada reales usan el SDK.
const now = Math.floor(Date.now() / 1000);
const idToken = 'fixture.' + Buffer.from(JSON.stringify({ iat: now, exp: now + 3600 })).toString('base64url') + '.fixture';
const env = { APP_BASE_URL: 'http://localhost:3000', AUTH0_DOMAIN: 'issuer.test', AUTH0_CLIENT_ID: 'test-client',
  AUTH0_CLIENT_SECRET: 'test-only', AUTH0_SESSION_SECRET: 'a'.repeat(64) };
function sessionMiddleware(req, res, next) {
  req.auth0 = { client: { getSession: async () => req.headers.cookie?.includes('test-session=valid')
    ? { user: { sub: 'google-oauth2|test-user', name: 'Ana', email: 'ana@example.test' }, idToken } : undefined } };
  next();
}
module.exports = { env, sessionMiddleware };
