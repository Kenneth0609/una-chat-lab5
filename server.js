'use strict';
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const validation = require('./libs/unalib');
const { readAuthConfig, identityFromSession, loginPage, SESSION_SECONDS } = require('./libs/auth');
const SOCKET_PATH = '/api/chat/socket.io';
const chatPage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function createChatServer({ env = process.env, sessionMiddleware } = {}) {
  const config = readAuthConfig(env);
  const app = express();
  const http = require('node:http').createServer(app);
  const io = new (require('socket.io').Server)(http, {
    path: SOCKET_PATH, addTrailingSlash: false, transports: ['websocket'], maxHttpBufferSize: 65536
  });
  const port = Number(env.PORT || 3000);
  const revoked = new Map();
  const sessions = express();
  app.disable('x-powered-by');
  sessions.disable('x-powered-by');
  if (env.VERCEL && config && !env.REDIS_URL) throw new Error('Redis es obligatorio para UNA Chat en Vercel.');
  const shared = config && env.REDIS_URL
    ? require('./libs/chat-redis').createRedisChat(env.REDIS_URL, config.appBaseUrl, {
      onMessage: broadcast,
      onRevoke: markRevoked,
      onDisconnect() {
        for (const socket of io.sockets.sockets.values()) socket.conn.close();
      }
    }) : null;
  if (shared) http.on('close', () => shared.close());

  function isActive(identity) { return identity && identity.expiresAt > Date.now() && !revoked.has(identity.key); }
  async function checkActive(identity) {
    return isActive(identity) && (!shared || !(await shared.isRevoked(identity.key))) && isActive(identity);
  }
  function disconnectSession(socket) {
    socket.emit('auth-required');
    socket.disconnect(true);
  }
  function markRevoked(key, expiresAt) {
    for (const [key, expiration] of revoked) if (expiration <= Date.now()) revoked.delete(key);
    revoked.set(key, expiresAt);
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.identity?.key === key) disconnectSession(socket);
    }
  }
  function broadcast(message) {
    for (const recipient of io.sockets.sockets.values()) {
      if (isActive(recipient.data.identity)) recipient.emit('Evento-Mensaje-Server', message);
    }
  }
  function signIn(res, status = 200, message = '') {
    return res.status(status).send(loginPage({ configured: Boolean(config), message, connection: config?.connection }));
  }
  function authFailure(req, res) {
    return signIn(res, 400, req.query.error === 'access_denied'
      ? 'Cancelaste el inicio de sesión. Puedes intentarlo de nuevo.'
      : 'No se pudo iniciar sesión. Inténtalo de nuevo.');
  }
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', ["default-src 'self'", "script-src 'self'", "style-src 'self'",
      'img-src http: https:', 'media-src http: https:', 'frame-src https://www.youtube.com',
      "connect-src 'self' ws: wss:", "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'"].join('; '));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  if (sessionMiddleware) sessions.use(sessionMiddleware);
  else if (config) {
    let authMiddleware;
    sessions.use(async (req, res, next) => {
      authMiddleware ??= import('@auth0/auth0-express').then(({ createAuth0 }) => createAuth0({
        domain: config.domain, clientId: config.clientId, clientSecret: config.clientSecret,
        sessionSecret: config.sessionSecret, appBaseUrl: config.appBaseUrl, mountRoutes: false,
        sessionConfiguration: { rolling: false, absoluteDuration: SESSION_SECONDS, inactivityDuration: SESSION_SECONDS,
          cookie: { secure: config.secure, sameSite: 'lax', path: '/', httpOnly: true } }
      }));
      const middleware = await authMiddleware;
      return middleware(req, res, next);
    });
  }
  sessions.use(async (req, res, next) => {
    try {
      const session = await req.auth0?.client.getSession({ request: req, response: res });
      const identity = identityFromSession(session);
      req.chatIdentity = (await checkActive(identity)) ? identity : null;
      next();
    } catch (error) {
      req.chatIdentity = null;
      if (shared) return next(error);
      next();
    }
  });
  app.use(sessions);
  app.get('/auth/login', async (req, res) => {
    if (!config) return signIn(res, 503);
    try {
      const url = await req.auth0.client.startInteractiveLogin({ appState: { returnTo: '/' },
        authorizationParams: { redirect_uri: config.appBaseUrl + '/auth/callback', scope: 'openid profile email', connection: config.connection } });
      res.redirect(url.href);
    } catch { authFailure(req, res); }
  });
  app.get('/auth/callback', async (req, res) => {
    if (!config) return signIn(res, 503);
    try {
      await req.auth0.client.completeInteractiveLogin(new URL(req.originalUrl, config.appBaseUrl));
      res.redirect('/');
    } catch { authFailure(req, res); }
  });
  app.get('/auth/logout', async (req, res) => {
    if (!config) return signIn(res, 503);
    try {
      const identity = req.chatIdentity;
      if (identity) {
        if (shared) await shared.revoke(identity);
        markRevoked(identity.key, identity.expiresAt);
      }
      const url = await req.auth0.client.logout({ returnTo: config.appBaseUrl });
      res.redirect(url.href);
    } catch { signIn(res, 502, 'No se pudo cerrar sesión. Vuelve a intentarlo.'); }
  });
  app.get('/api/me', (req, res) => {
    if (!isActive(req.chatIdentity)) return res.status(401).json({ error: 'authentication_required' });
    res.json(req.chatIdentity.profile);
  });
  app.get('/validators.js', (req, res) => {
    if (!isActive(req.chatIdentity)) return res.sendStatus(401);
    const dir = path.join(__dirname, 'public', 'validators');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => /\.js$/.test(file)).sort() : [];
    res.type('application/javascript').send(files.map((file) => fs.readFileSync(path.join(dir, file), 'utf8')).join('\n') || '// sin reglas de envio\n');
  });
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/', (req, res) => {
    if (!isActive(req.chatIdentity)) return signIn(res, config ? 200 : 503);
    res.send(chatPage);
  });
  io.engine.use((req, res, next) => {
    if (!config || (req.headers.origin && req.headers.origin !== config.appBaseUrl)) return next(new Error('authentication_required'));
    // Express adapta los prototipos; restaurarlos conserva la respuesta especial del upgrade de Engine.IO.
    const requestPrototype = Object.getPrototypeOf(req);
    const responsePrototype = Object.getPrototypeOf(res);
    sessions(req, res, (error) => {
      Object.setPrototypeOf(req, requestPrototype);
      Object.setPrototypeOf(res, responsePrototype);
      if (error || !isActive(req.chatIdentity)) return next(new Error('authentication_required'));
      next();
    });
  });
  io.use(async (socket, next) => {
    try {
      if (shared) await shared.listen();
      const identity = socket.request.chatIdentity;
      if (!(await checkActive(identity))) return next(new Error('authentication_required'));
      socket.data.identity = identity;
      next();
    } catch { next(new Error('connection_unavailable')); }
  });
  io.on('connection', (socket) => {
    const identity = socket.data.identity;
    if (!isActive(identity)) return disconnectSession(socket);
    const expiration = setTimeout(() => disconnectSession(socket), Math.max(0, identity.expiresAt - Date.now()));
    expiration.unref();
    socket.on('disconnect', () => clearTimeout(expiration));
    socket.on('Evento-Mensaje-Server', async (message) => {
      if (!isActive(identity)) return disconnectSession(socket);
      let data;
      try { data = JSON.parse(message); } catch { data = { mensaje: typeof message === 'string' ? message : '' }; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) data = { mensaje: typeof data === 'string' ? data : '' };
      const sanitized = validation.validateMessage(JSON.stringify({ ...data, nombre: identity.profile.name }));
      if (!shared) return broadcast(sanitized);
      try {
        if (!(await shared.publish(identity, sanitized))) disconnectSession(socket);
      } catch { socket.conn.close(); }
    });
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (req.path.startsWith('/auth/')) return authFailure(req, res);
    res.status(500).send('No se pudo completar la solicitud. Inténtalo de nuevo.');
  });
  return { app, http, io, port };
}

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  try {
    const { http, port } = createChatServer();
    http.listen(port, () => console.log('UNA Chat: http://localhost:' + port));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { createChatServer, SOCKET_PATH };
