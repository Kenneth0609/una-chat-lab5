const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('REQ-010 + REQ-012: 281 espacios se conservan y muestran el limite de longitud', async ({ page }) => {
  const texto = ' '.repeat(281);
  await page.getByRole('textbox', { name: 'Username' }).fill('Ana');
  await page.getByRole('textbox', { name: 'Escriba un mensaje' }).fill(texto);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert')).toContainText('demasiado largo');
  await expect(page.locator('#m')).toHaveValue(texto);
  await expect(page.locator('#messages li')).toHaveCount(0);
});

test('REQ-011 + REQ-012: corregir longitud y nombre permite enviar una sola vez', async ({ page }) => {
  const mensaje = page.getByRole('textbox', { name: 'Escriba un mensaje' });
  const enviar = page.getByRole('button', { name: 'Send' });
  await mensaje.fill('a'.repeat(281));
  await enviar.click();
  await expect(page.getByRole('alert')).toContainText('demasiado largo');
  await expect(mensaje).toHaveValue('a'.repeat(281));
  await mensaje.fill('Mensaje corregido');
  await enviar.click();
  await expect(page.getByRole('alert')).toContainText('nombre');
  await expect(mensaje).toHaveValue('Mensaje corregido');
  await expect(page.locator('#messages li')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Username' }).fill('Ana');
  await enviar.click();
  await expect(page.locator('#messages li')).toHaveCount(1);
  await expect(page.locator('#messages li')).toContainText('Mensaje corregido');
  await expect(mensaje).toHaveValue('');
  await expect(page.locator('#aviso')).toBeEmpty();
});

test('REQ-010 + REQ-011: ambos campos vacios piden un mensaje', async ({ page }) => {
  await page.locator('#m').fill('   ');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert')).toContainText('Escribe un mensaje');
  await expect(page.locator('#m')).toHaveValue('');
  await expect(page.locator('#messages li')).toHaveCount(0);
});
