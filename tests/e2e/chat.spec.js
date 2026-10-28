// Pruebas END-TO-END (paso 10): navegador Chromium real + frontend y backend reales de UNA Chat.
//
// Ejecutar (con el chat activo con "npm start", o dejando que Playwright lo inicie):
//   npx playwright test --project=chromium --headed
//   npx playwright show-report
const { test, expect } = require('@playwright/test');

// medios de prueba conocidos y estables
const IMAGEN = 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png';
const VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm';
const YOUTUBE = 'https://www.youtube.com/watch?v=qYwlqx-JLok';
const SCRIPT_PASO_2 = "<script>alert('Inyección de script');</script>";

// escribe nombre y mensaje y pulsa Send, como lo haria una persona
async function enviarMensaje(page, texto, nombre = 'Playwright') {
  await page.getByRole('textbox', { name: 'Username' }).fill(nombre);
  await page.getByRole('textbox', { name: 'Escriba un mensaje' }).fill(texto);
  await page.getByRole('button', { name: 'Send' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Chat Socket.IO UNA');
});

test('el chat se comunica con el backend: el mensaje viaja por Socket.IO y vuelve a la pantalla', async ({ page }) => {
  await enviarMensaje(page, 'Hola desde Playwright', 'Ana');

  const mensaje = page.getByRole('listitem').filter({ hasText: 'Hola desde Playwright' });
  await expect(mensaje).toBeVisible();
  await expect(mensaje).toContainText('Ana: Hola desde Playwright');
  // el campo de texto se limpia tras enviar
  await expect(page.getByRole('textbox', { name: 'Escriba un mensaje' })).toHaveValue('');
});

test('una URL de imagen se muestra en el chat y termina de cargar', async ({ page }) => {
  await enviarMensaje(page, IMAGEN);

  const imagen = page.getByRole('img', { name: 'Imagen compartida en el chat' });
  await expect(imagen).toBeVisible();
  await expect(imagen).toHaveAttribute('src', IMAGEN);
  // "visible" no basta: se comprueba que el navegador descargo la imagen
  await expect(imagen).toHaveJSProperty('complete', true);
  await expect.poll(() => imagen.evaluate((img) => img.naturalWidth), { message: 'la imagen debe tener ancho natural > 0' }).toBeGreaterThan(0);
  // la URL no se muestra como texto: se reemplaza por la imagen
  await expect(page.getByRole('listitem').filter({ has: imagen })).not.toContainText('https://');
});

test('una URL de video muestra el reproductor y carga el contenido', async ({ page }) => {
  await enviarMensaje(page, VIDEO);

  const video = page.locator('#messages video');
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('src', VIDEO);
  await expect(video).toHaveJSProperty('controls', true);

  // el navegador descargo los metadatos y al menos el primer fotograma (readyState >= HAVE_CURRENT_DATA)
  await expect.poll(() => video.evaluate((v) => v.readyState), { timeout: 20000 }).toBeGreaterThanOrEqual(2);
  expect(await video.evaluate((v) => v.error)).toBeNull();
  expect(await video.evaluate((v) => v.videoWidth)).toBeGreaterThan(0);
  expect(await video.evaluate((v) => v.duration)).toBeGreaterThan(0);

  // y se puede reproducir de verdad: el tiempo avanza
  await video.evaluate((v) => { v.muted = true; return v.play(); });
  await expect.poll(() => video.evaluate((v) => v.currentTime), { timeout: 10000 }).toBeGreaterThan(0);
  await video.evaluate((v) => v.pause());
});

test('un enlace de YouTube inserta el reproductor incrustado', async ({ page }) => {
  await enviarMensaje(page, YOUTUBE);

  const reproductor = page.locator('#messages iframe');
  await expect(reproductor).toBeVisible();
  await expect(reproductor).toHaveAttribute('src', 'https://www.youtube.com/embed/qYwlqx-JLok');
});

test('el script del paso 2 no se ejecuta: se rechaza/sanea el mensaje', async ({ page }) => {
  // el manejador se registra ANTES de enviar: cualquier alert hace fallar la prueba
  const dialogos = [];
  page.on('dialog', async (dialog) => {
    dialogos.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });

  await enviarMensaje(page, SCRIPT_PASO_2, 'Atacante');

  const bloqueado = page.getByRole('listitem').filter({ hasText: 'Atacante' });
  await expect(bloqueado).toContainText('[Mensaje bloqueado: contenido no permitido]');
  await expect(bloqueado).not.toContainText('alert');
  await expect(page.locator('#messages script')).toHaveCount(0);
  expect(await page.locator('#messages').innerHTML()).not.toMatch(/<script/i);

  // se envia otro mensaje y se espera su eco: asi se sabe que la pagina ya proceso todo lo anterior
  await enviarMensaje(page, 'mensaje de control', 'Control');
  await expect(page.getByRole('listitem').filter({ hasText: 'mensaje de control' })).toBeVisible();

  expect(dialogos, 'no debe aparecer ningun alert/confirm/prompt').toEqual([]);
});

for (const [descripcion, carga] of [
  ['<img onerror>', '<img src=x onerror="alert(\'xss\')">'],
  ['<svg onload>', '<svg onload="alert(\'xss\')">'],
  ['<iframe javascript:>', '<iframe src="javascript:alert(\'xss\')"></iframe>'],
]) {
  test(`otras inyecciones (${descripcion}) no crean elementos ni ejecutan codigo`, async ({ page }) => {
    const dialogos = [];
    page.on('dialog', async (dialog) => {
      dialogos.push(dialog.message());
      await dialog.dismiss();
    });

    await enviarMensaje(page, carga, 'Atacante');
    await expect(page.getByRole('listitem').filter({ hasText: 'Atacante' })).toContainText('[Mensaje bloqueado');

    await expect(page.locator('#messages img, #messages svg, #messages iframe, #messages script')).toHaveCount(0);
    await enviarMensaje(page, 'mensaje de control', 'Control');
    await expect(page.getByRole('listitem').filter({ hasText: 'mensaje de control' })).toBeVisible();
    expect(dialogos).toEqual([]);
  });
}

test('una URL no permitida se muestra como texto, sin enlace ni reproductor', async ({ page }) => {
  await enviarMensaje(page, 'javascript:alert(document.cookie)', 'Ana');

  const mensaje = page.getByRole('listitem').filter({ hasText: 'javascript:alert(document.cookie)' });
  await expect(mensaje).toBeVisible();
  await expect(mensaje.locator('a, img, video, iframe')).toHaveCount(0);
});

test('el mensaje de un usuario llega a otro usuario conectado', async ({ page, browser }) => {
  const otraPersona = await (await browser.newContext()).newPage();
  await otraPersona.goto('/');
  await expect(otraPersona).toHaveTitle('Chat Socket.IO UNA');

  await enviarMensaje(page, 'mensaje para todos', 'Ana');

  await expect(otraPersona.getByRole('listitem').filter({ hasText: 'mensaje para todos' })).toContainText('Ana');
  await otraPersona.context().close();
});
