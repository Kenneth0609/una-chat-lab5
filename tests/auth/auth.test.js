'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const request = require('supertest');
const { io: connect } = require('socket.io-client');
const { startFixture } = require('../support/auth-fixture');
const { createChatServer, SOCKET_PATH } = require('../../server');
const { readAuthConfig } = require('../../libs/auth');
let fixture;
before(async () => { fixture = await startFixture({ redisURL: process.env.LAB8_TEST_REDIS_URL }); fixture.io.engine.on('connection_error', (error) => { fixture.behavior.socketError = { code: error.code, message: error.message, context: error.context?.message }; }); });
after(async () => { await fixture?.close(); });

async function signIn(agent, transform) {
  const start = await agent.get('/auth/login').expect(302);
  const authorizeURL = new URL(start.headers.location);
  assert.equal(authorizeURL.searchParams.get('connection'), 'google-oauth2');
  assert.equal(authorizeURL.searchParams.get('code_challenge_method'), 'S256');
  const redirect = await request(fixture.provider).get(authorizeURL.pathname + authorizeURL.search).expect(302);
  let target = new URL(redirect.headers.location);
  if (transform) target = transform(target);
  return agent.get(target.pathname + target.search);
}
function socketConnection(cookie, origin, baseURL = fixture.baseURL) {
  const socket = connect(baseURL, { path: SOCKET_PATH, addTrailingSlash: false, transports: ['websocket'], reconnection: false, forceNew: true, timeout: 3000,
    extraHeaders: { ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) } });
  return new Promise((resolve, reject) => { socket.once('connect', () => resolve(socket)); socket.once('connect_error', (error) => { socket.close(); error.message += ' ' + JSON.stringify(fixture.behavior.socketError); reject(error); }); });
}
test('anonymous HTTP and websocket requests cannot access the chat', async () => {
  const page = await request(fixture.app).get('/').expect(200);
  assert.match(page.text, /Inicia sesión para entrar al chat/);
  assert.doesNotMatch(page.text, /id="messages"/);
  await request(fixture.app).get('/api/me').expect(401);
  await request(fixture.app).get('/validators.js').expect(401);
  await assert.rejects(socketConnection(), /websocket error/);
});
test('real SDK completes code + PKCE login, sets private cookie and exposes only profile', async () => {
  const agent = request.agent(fixture.app);
  const callback = await signIn(agent);
  assert.equal(callback.status, 302, require('node:util').inspect(fixture.behavior.lastError, { depth: 5 }));
  const cookies = callback.headers['set-cookie'].join(';');
  assert.match(cookies, /HttpOnly/i);
  assert.match(cookies, /SameSite=Lax/i);
  const me = await agent.get('/api/me').expect(200);
  assert.deepEqual(me.body, { sub: 'google-oauth2|test-user', name: 'Ana', email: 'ana@example.test' });
  assert.equal(me.headers['cache-control'], 'no-store');
  assert.doesNotMatch(JSON.stringify(me.body), /test-access-token|test-client-secret|idToken/);
  await agent.get('/').expect(200).expect(/id="messages"/);
});
test('invalid state and expired tokens never establish a session', async () => {
  const invalidState = request.agent(fixture.app);
  const result = await signIn(invalidState, (url) => { url.searchParams.set('state', 'forged'); return url; });
  assert.equal(result.status, 400);
  await invalidState.get('/api/me').expect(401);
  const invalidSignature = request.agent(fixture.app);
  fixture.behavior.expired = true;
  try { assert.equal((await signIn(invalidSignature)).status, 400); }
  finally { fixture.behavior.expired = false; }
  await invalidSignature.get('/api/me').expect(401);
});
test('cancellation and callback errors are safe and retryable', async () => {
  const response = await request(fixture.app).get('/auth/callback?error=access_denied&error_description=SECRET-DETAIL').expect(400);
  assert.match(response.text, /Cancelaste el inicio/);
  assert.match(response.text, /href="\/auth\/login"/);
  assert.doesNotMatch(response.text, /SECRET-DETAIL/);
  await request(fixture.app).get('/auth/callback?code=invalid').expect(400).expect(/No se pudo iniciar sesión/);
});
test('authenticated sockets trust the session author and logout revokes existing cookies and sockets', async () => {
  const agent = request.agent(fixture.app);
  const callback = await signIn(agent);
  assert.equal(callback.status, 302);
  // Supertest stores cookies for its own loopback address; replay the returned session cookie to the real socket.
  const cookie = callback.headers['set-cookie'].filter((value) => !value.includes('Max-Age=0')).map((value) => value.split(';')[0]).join('; ');
  const socket = await socketConnection(cookie);
  try {
    const message = new Promise((resolve) => socket.once('Evento-Mensaje-Server', resolve));
    socket.emit('Evento-Mensaje-Server', JSON.stringify({ nombre: 'Impostor', mensaje: '<script>alert(1)</script>', color: '#112233' }));
    const delivered = JSON.parse(await message);
    assert.equal(delivered.nombre, 'Ana');
    assert.equal(delivered.tipo, 'bloqueado');
    await assert.rejects(socketConnection(cookie, 'https://attacker.example'), /websocket error/);
    const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));
    await agent.get('/auth/logout').expect(302);
    await disconnected;
    await request(fixture.app).get('/api/me').set('Cookie', cookie).expect(401);
    await assert.rejects(socketConnection(cookie), /websocket error/);
  } finally { socket.close(); }
});
test('missing and unsafe environment configuration fails closed', async () => {
  const chat = createChatServer({ env: {} });
  try { await request(chat.app).get('/').expect(503).expect(/todavía no está configurado/); }
  finally { await new Promise((resolve) => chat.io.close(resolve)); }
  assert.throws(() => readAuthConfig({ ...fixture.env, APP_BASE_URL: 'http://evil.example' }), /APP_BASE_URL/);
  assert.throws(() => readAuthConfig({ ...fixture.env, AUTH0_SESSION_SECRET: 'short' }), /AUTH0_SESSION_SECRET/);
  assert.throws(() => readAuthConfig({ ...fixture.env, APP_BASE_URL: 'http://localhost:3000', NODE_ENV: 'production' }), /APP_BASE_URL/);
});
test('expired sessions disconnect readers and publishers; tampered cookies grant no access', async () => {
  fixture.behavior.tokenLifetime = 2;
  const agent = request.agent(fixture.app);
  let callback;
  try { callback = await signIn(agent); } finally { fixture.behavior.tokenLifetime = 3600; }
  assert.equal(callback.status, 302);
  const cookie = callback.headers['set-cookie'].filter((value) => !value.includes('Max-Age=0')).map((value) => value.split(';')[0]).join('; ');
  const tampered = cookie.replace(/=([A-Za-z0-9_-])/, (_, char) => '=' + (char === 'a' ? 'b' : 'a'));
  await request(fixture.app).get('/api/me').set('Cookie', tampered).expect(401);
  const socket = await socketConnection(cookie);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Expired socket was not closed')), 3500);
      socket.once('disconnect', () => { clearTimeout(timer); resolve(); });
    });
    await agent.get('/api/me').expect(401);
    await assert.rejects(socketConnection(cookie), /websocket error/);
  } finally { socket.close(); }
});

test('Redis broadcasts and revokes a session across two servers', { skip: !process.env.LAB8_TEST_REDIS_URL }, async () => {
  const other = createChatServer({ env: fixture.env, sessionMiddleware: fixture.sessionMiddleware });
  await new Promise((resolve) => other.http.listen(0, '127.0.0.1', resolve));
  const otherURL = 'http://127.0.0.1:' + other.http.address().port;
  const sockets = [];
  try {
    const callback = await signIn(request.agent(fixture.app));
    assert.equal(callback.status, 302);
    const cookie = callback.headers['set-cookie'].filter((value) => !value.includes('Max-Age=0'))
      .map((value) => value.split(';')[0]).join('; ');
    const sender = await socketConnection(cookie);
    sockets.push(sender);
    const recipient = await socketConnection(cookie, fixture.baseURL, otherURL);
    sockets.push(recipient);
    const delivered = once(recipient, 'Evento-Mensaje-Server', { signal: AbortSignal.timeout(3000) });
    sender.emit('Evento-Mensaje-Server', JSON.stringify({ nombre: 'Impostor', mensaje: 'Entre instancias', color: '#112233' }));
    const [message] = await delivered;
    assert.equal(JSON.parse(message).nombre, 'Ana');
    assert.equal(JSON.parse(message).mensaje, 'Entre instancias');
    const closed = sockets.map((socket) => once(socket, 'disconnect', { signal: AbortSignal.timeout(3000) }));
    await request(otherURL).get('/auth/logout').set('Cookie', cookie).expect(302);
    await Promise.all(closed);
    await request(fixture.baseURL).get('/api/me').set('Cookie', cookie).expect(401);
    await assert.rejects(socketConnection(cookie), /websocket error/);
  } finally {
    for (const socket of sockets) socket.close();
    await new Promise((resolve) => other.io.close(resolve));
  }
});
