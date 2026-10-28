// Pruebas END-TO-END de REQ-011 (Messages need a name): navegador Chromium real contra el
// frontend y backend reales de UNA Chat (ver tests/e2e/chat.spec.js para el estilo base).
const { test, expect } = require('@playwright/test');

const AVISO_ESPERADO = 'Escriba un nombre para enviar el mensaje.';

async function enviarMensaje(page, nombre, mensaje) {
  await page.getByRole('textbox', { name: 'Username' }).fill(nombre);
  await page.getByRole('textbox', { name: 'Escriba un mensaje' }).fill(mensaje);
  await page.getByRole('button', { name: 'Send' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Chat Socket.IO UNA');
});

test('REQ-011: username vacio con un mensaje real no se agrega al transcript, limpia el campo y avisa', async ({ page }) => {
  await enviarMensaje(page, '', 'Hola a todos REQ-011 vacio');

  await expect(page.getByRole('listitem').filter({ hasText: 'Hola a todos REQ-011 vacio' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveText(AVISO_ESPERADO);
});

test('REQ-011: username con solo espacios y un mensaje real no se agrega al transcript, limpia el campo y avisa', async ({ page }) => {
  await enviarMensaje(page, '   ', 'Hola a todos REQ-011 espacios');

  await expect(page.getByRole('listitem').filter({ hasText: 'Hola a todos REQ-011 espacios' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveText(AVISO_ESPERADO);
});

test('REQ-011: username con solo tabs y un mensaje real no se agrega al transcript, limpia el campo y avisa', async ({ page }) => {
  await enviarMensaje(page, '\t\t\t', 'Hola a todos REQ-011 tabs');

  await expect(page.getByRole('listitem').filter({ hasText: 'Hola a todos REQ-011 tabs' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveText(AVISO_ESPERADO);
});

test('REQ-011: username con espacios alrededor de texto real se acepta y el mensaje se envia', async ({ page }) => {
  await enviarMensaje(page, '  Ana  ', 'Mensaje con nombre valido REQ-011');

  const mensaje = page.getByRole('listitem').filter({ hasText: 'Mensaje con nombre valido REQ-011' });
  await expect(mensaje).toBeVisible();
  await expect(page.getByRole('alert')).not.toHaveText(AVISO_ESPERADO);
});

test('REQ-011: username y mensaje vacios no muestran el aviso de "escriba un nombre"', async ({ page }) => {
  await enviarMensaje(page, '', '   ');

  await expect(page.getByRole('alert')).not.toHaveText(AVISO_ESPERADO);
});
