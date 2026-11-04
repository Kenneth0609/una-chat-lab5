'use strict';
const Redis = require('ioredis');

function createRedisChat(url, origin, { onMessage, onRevoke, onDisconnect }) {
  const options = { lazyConnect: true, connectTimeout: 3000, commandTimeout: 3000, maxRetriesPerRequest: 0 };
  const commands = new Redis(url, options);
  const subscriber = new Redis(url, { ...options, autoResubscribe: false });
  const prefix = 'una-chat:' + origin;
  const channel = prefix + ':events';
  const revoked = (key) => prefix + ':revoked:' + key;
  let listening;

  for (const client of [commands, subscriber]) {
    client.on('error', () => console.error('UNA Chat: no se pudo conectar con Redis.'));
  }
  subscriber.on('close', () => {
    listening = undefined;
    onDisconnect();
  });
  subscriber.on('message', (_channel, payload) => {
    let event;
    try { event = JSON.parse(payload); } catch { return; }
    if (!event) return;
    if (event.type === 'revoke') onRevoke(event.key, event.expiresAt);
    if (event.type === 'message') onMessage(event.message);
  });

  return {
    listen() {
      if (!listening) {
        listening = subscriber.subscribe(channel).catch((error) => {
          listening = undefined;
          throw error;
        });
      }
      return listening;
    },
    async isRevoked(key) {
      return Boolean(await commands.exists(revoked(key)));
    },
    async revoke(identity) {
      const remaining = identity.expiresAt - Date.now();
      if (remaining <= 0) return;
      const event = JSON.stringify({ type: 'revoke', key: identity.key, expiresAt: identity.expiresAt });
      await commands.eval(
        "redis.call('SET', KEYS[1], '1', 'PX', ARGV[1]); return redis.call('PUBLISH', KEYS[2], ARGV[2])",
        2, revoked(identity.key), channel, remaining, event
      );
    },
    async publish(identity, message) {
      const event = JSON.stringify({ type: 'message', message });
      return Boolean(await commands.eval(
        "if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end; redis.call('PUBLISH', KEYS[2], ARGV[1]); return 1",
        2, revoked(identity.key), channel, event
      ));
    },
    close() {
      subscriber.disconnect();
      commands.disconnect();
    }
  };
}

module.exports = { createRedisChat };
