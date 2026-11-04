'use strict';

async function login(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Continuar con Google' }).click();
  await page.waitForURL((url) => url.pathname === '/' && url.hostname === 'localhost');
  await page.getByRole('button', { name: 'Send', exact: true }).waitFor({ state: 'visible' });
}
module.exports = { login };
