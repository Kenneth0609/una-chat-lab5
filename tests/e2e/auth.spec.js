const { test, expect } = require('@playwright/test');
const { login } = require('../support/browser-auth');

test('anonymous visitors see sign-in and cannot fetch a profile', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'UNA Chat' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continuar con Google' })).toBeVisible();
  await expect(page.locator('#messages')).toHaveCount(0);
  expect((await page.request.get('/api/me')).status()).toBe(401);
  await page.screenshot({ path: testInfo.outputPath('sign-in.png') });
});

test('login displays trusted identity and logout ends access in both tabs', async ({ page, context }, testInfo) => {
  await login(page);
  await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('Ana');
  await expect(page.getByRole('textbox', { name: 'Username' })).toHaveAttribute('readonly', '');
  await expect(page.locator('#identity')).toHaveText('Ana · ana@example.test');
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('authenticated-chat.png') });
  await page.getByRole('link', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('link', { name: 'Continuar con Google' })).toBeVisible();
  await expect(second.getByRole('link', { name: 'Continuar con Google' })).toBeVisible();
  expect((await page.request.get('/api/me')).status()).toBe(401);
});

test('cancelled login shows a safe retry action', async ({ page }) => {
  const start = await page.request.get('/auth/login', { maxRedirects: 0 });
  const url = new URL(start.headers().location);
  url.searchParams.set('cancel', '1');
  await page.goto(url.href);
  await expect(page.getByRole('alert')).toHaveText('Cancelaste el inicio de sesión. Puedes intentarlo de nuevo.');
  await page.getByRole('link', { name: 'Continuar con Google' }).click();
  await expect(page.locator('#identity')).toHaveText('Ana · ana@example.test');
});

test('invalid callback does not expose provider detail', async ({ page }) => {
  await page.goto('/auth/callback?code=invalid&error_description=PRIVATE-DETAIL');
  await expect(page.getByRole('alert')).toHaveText('No se pudo iniciar sesión. Inténtalo de nuevo.');
  await expect(page.locator('body')).not.toContainText('PRIVATE-DETAIL');
  expect((await page.request.get('/api/me')).status()).toBe(401);
});

test('sign-in fits a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Continuar con Google' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('sign-in-mobile.png') });
});
