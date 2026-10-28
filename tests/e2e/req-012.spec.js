// Pruebas END-TO-END REQ-012 (mensajes cortos): navegador Chromium real contra el frontend y backend
// reales de UNA Chat. El chat debe bloquear Send para un mensaje mas largo que 280 caracteres.
const { test, expect } = require('@playwright/test');

async function enviarMensaje(page, texto, nombre = 'Playwright') {
  await page.getByRole('textbox', { name: 'Username' }).fill(nombre);
  await page.getByRole('textbox', { name: 'Escriba un mensaje' }).fill(texto);
  await page.getByRole('button', { name: 'Send' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Chat Socket.IO UNA');
});

test('REQ-012: un mensaje de 281 caracteres no se agrega a la conversacion', async ({ page }) => {
  await enviarMensaje(page, 'a'.repeat(281), 'Ana');

  await expect(page.getByRole('listitem')).toHaveCount(0);
});

test('REQ-012: tras el rechazo por mensaje demasiado largo, el campo de mensaje conserva el texto escrito', async ({ page }) => {
  const texto = 'a'.repeat(281);
  await enviarMensaje(page, texto, 'Ana');

  await expect(page.getByRole('textbox', { name: 'Escriba un mensaje' })).toHaveValue(texto);
});

test('REQ-012: tras el rechazo por mensaje demasiado largo, el aviso le dice al visitante que es demasiado largo', async ({ page }) => {
  await enviarMensaje(page, 'a'.repeat(281), 'Ana');

  await expect(page.getByRole('alert')).toContainText(/demasiado largo/i);
});

test('REQ-012: un mensaje de exactamente 280 caracteres si se agrega a la conversacion', async ({ page }) => {
  const texto = 'a'.repeat(280);
  await enviarMensaje(page, texto, 'Ana');

  await expect(page.getByRole('listitem').filter({ hasText: texto })).toBeVisible();
});

test('REQ-012: un mensaje de 281 espacios tambien se bloquea (no se recorta antes de contar)', async ({ page }) => {
  await enviarMensaje(page, ' '.repeat(281), 'Ana');

  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText(/demasiado largo/i);
});
