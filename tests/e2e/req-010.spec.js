// Pruebas END-TO-END de REQ-010: navegador Chromium real contra el chat real (frontend + backend).
// Ejecutar: npx playwright test tests/e2e/req-010.spec.js --project=chromium
const { test, expect } = require('@playwright/test');

const AVISO_ESPERADO = 'Escribe un mensaje antes de enviarlo.';

function campoNombre(page) { return page.getByRole('textbox', { name: 'Username' }); }
function campoMensaje(page) { return page.getByRole('textbox', { name: 'Escriba un mensaje' }); }
function botonEnviar(page) { return page.getByRole('button', { name: 'Send' }); }

// escribe nombre y mensaje y pulsa Send, como lo haria una persona
async function enviarMensaje(page, texto, nombre = 'Ana') {
  await campoNombre(page).fill(nombre);
  await campoMensaje(page).fill(texto);
  await botonEnviar(page).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Chat Socket.IO UNA');
});

test('REQ-010: un mensaje completamente vacio no se publica, el campo queda vacio y se avisa al visitante', async ({ page }) => {
  await enviarMensaje(page, '');

  await expect(page.locator('#messages li')).toHaveCount(0);
  await expect(campoMensaje(page)).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveText(AVISO_ESPERADO);
});

test('REQ-010: un mensaje de solo espacios no se publica, el campo se vacia y se avisa al visitante', async ({ page }) => {
  await enviarMensaje(page, '   ');

  await expect(page.locator('#messages li')).toHaveCount(0);
  await expect(campoMensaje(page)).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveText(AVISO_ESPERADO);
});

test('REQ-010: un mensaje de solo tabs y espacios no se publica, el campo se vacia y se avisa al visitante', async ({ page }) => {
  await enviarMensaje(page, '\t \t');

  await expect(page.locator('#messages li')).toHaveCount(0);
  await expect(campoMensaje(page)).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveText(AVISO_ESPERADO);
});

test('REQ-010: un mensaje con espacios alrededor pero con contenido real si se publica', async ({ page }) => {
  await enviarMensaje(page, '  hola  ');

  await expect(page.getByRole('listitem').filter({ hasText: 'hola' })).toBeVisible();
});
