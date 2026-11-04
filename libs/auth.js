'use strict';
const crypto = require('node:crypto');
const SESSION_SECONDS = 3600;

function readAuthConfig(env) {
  const names = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_SESSION_SECRET', 'APP_BASE_URL'];
  if (names.some((name) => !env[name] || !env[name].trim())) return null;
  let base;
  try { base = new URL(env.APP_BASE_URL); } catch { throw new Error('APP_BASE_URL debe ser una URL válida.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      (base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) ||
      ((env.NODE_ENV === 'production' || env.VERCEL) && base.protocol !== 'https:')) {
    throw new Error('APP_BASE_URL debe ser un origen HTTPS o localhost HTTP para desarrollo.');
  }
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(env.AUTH0_DOMAIN) || env.AUTH0_DOMAIN.includes('..')) {
    throw new Error('AUTH0_DOMAIN debe contener el dominio sin protocolo ni rutas.');
  }
  if (env.AUTH0_SESSION_SECRET.length < 64 || !/^[a-f0-9]+$/i.test(env.AUTH0_SESSION_SECRET)) {
    throw new Error('AUTH0_SESSION_SECRET debe tener al menos 64 caracteres hexadecimales aleatorios.');
  }
  return { domain: env.AUTH0_DOMAIN, clientId: env.AUTH0_CLIENT_ID, clientSecret: env.AUTH0_CLIENT_SECRET,
    sessionSecret: env.AUTH0_SESSION_SECRET, appBaseUrl: base.origin,
    connection: env.AUTH0_CONNECTION || 'google-oauth2', secure: base.protocol === 'https:' };
}

// Solo se interpreta un ID token recuperado de la sesión que el SDK ya verificó.
function identityFromSession(session) {
  if (!session?.user?.sub || !session.idToken) return null;
  try {
    const claims = JSON.parse(Buffer.from(session.idToken.split('.')[1], 'base64url').toString('utf8'));
    const expiresAt = Math.min(claims.exp, claims.iat + SESSION_SECONDS) * 1000;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    const user = session.user;
    return { key: crypto.createHash('sha256').update(session.idToken).digest('hex'), expiresAt,
      profile: { sub: user.sub, name: String(user.name || user.nickname || user.email || 'Usuario'),
        ...(typeof user.email === 'string' ? { email: user.email } : {}) } };
  } catch { return null; }
}

function loginPage({ configured = true, message = '', connection = 'google-oauth2' } = {}) {
  const escape = require('./unalib').escapeHtml;
  const label = connection === 'google-oauth2' ? 'Continuar con Google' : 'Iniciar sesión';
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Iniciar sesión | UNA Chat</title><link rel="stylesheet" href="/chat.css"></head>' +
    '<body class="login-page"><main class="login-card"><p class="eyebrow">UNA · PARADIGMAS</p>' +
    '<h1>UNA Chat</h1><p>Inicia sesión para entrar al chat</p>' +
    (message ? '<p class="login-notice" role="alert">' + escape(message) + '</p>' : '') +
    (configured ? '<a class="login-button" href="/auth/login">' + label + '</a>' :
      '<p class="login-notice" role="alert">El inicio de sesión todavía no está configurado.</p>') +
    '<p class="login-help">Usa tu cuenta social para participar en la conversación.</p></main></body></html>';
}
module.exports = { readAuthConfig, identityFromSession, loginPage, SESSION_SECONDS };
