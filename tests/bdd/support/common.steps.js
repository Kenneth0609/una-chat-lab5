// Pasos Gherkin COMUNES del chat. Los escenarios de cada requerimiento reutilizan estos pasos y
// definen solo los que les faltan en tests/bdd/steps/<REQ>.steps.js (con texto propio, para que
// no choquen entre si cuando se integran varios requerimientos).
const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Given('the chat is open', async function () {
  await this.page.goto(this.baseURL);
  await expect(this.page).toHaveTitle('Chat Socket.IO UNA');
});

Given('the username field contains {string}', async function (nombre) {
  await this.campoNombre.fill(nombre);
});

Given('the username field is empty', async function () {
  await this.campoNombre.fill('');
});

When('the visitor types the message {string}', async function (texto) {
  await this.campoMensaje.fill(texto);
});

When('the visitor types a message of {int} characters', async function (cantidad) {
  await this.campoMensaje.fill('a'.repeat(cantidad));
});

When('the visitor activates Send', async function () {
  await this.botonEnviar.click();
});

Then('the transcript has {int} message(s)', async function (cantidad) {
  // se da un margen para que un mensaje que SI fuera publicado alcance a llegar antes de contar
  await this.page.waitForTimeout(500);
  await expect(this.conversacion).toHaveCount(cantidad);
});

Then('the transcript contains the message {string}', async function (texto) {
  await expect(this.conversacion.filter({ hasText: texto })).toHaveCount(1);
});

Then('the message field is empty', async function () {
  await expect(this.campoMensaje).toHaveValue('');
});

Then('the message field still contains {int} characters', async function (cantidad) {
  expect((await this.campoMensaje.inputValue()).length).toBe(cantidad);
});

Then('the username field is empty', async function () {
  await expect(this.campoNombre).toHaveValue('');
});

Then('the visitor sees a notice', async function () {
  await expect(this.aviso).toBeVisible();
  await expect(this.aviso).not.toHaveText('');
});
