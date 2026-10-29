// Pasos Gherkin propios de REQ-012: solo los que NO existen en tests/bdd/support/common.steps.js.
// Texto de paso propio para no chocar con otros requerimientos cuando se integran varios a la vez.
const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

When('the visitor types a message of {int} space characters', async function (cantidad) {
  await this.campoMensaje.fill(' '.repeat(cantidad));
});

Then('the visitor sees a notice that the message is too long', async function () {
  await expect(this.aviso).toBeVisible();
  await expect(this.aviso).toContainText(/demasiado largo/i);
});
