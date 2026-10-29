// Pasos Gherkin propios de REQ-010 (mensajes vacios/solo-espacios en blanco). Los pasos comunes
// (abrir el chat, llenar el username, pulsar Send, contar mensajes, campo vacio) ya existen en
// tests/bdd/support/common.steps.js y se reutilizan desde req-010.feature; aqui solo se definen
// los que faltan, con texto propio para no chocar con los de otros requerimientos.
const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

// Un tab literal no se puede escribir dentro de un string entre comillas en un archivo .feature
// (Gherkin no admite el caracter tab en el texto), asi que este paso programa el valor en Node.
When('the visitor types a message containing only tabs and spaces', async function () {
  await this.campoMensaje.fill('\t \t');
});

// Mas estricto que el paso comun "the visitor sees a notice": verifica el texto exacto del aviso
// que exige REQ-010, no solo que exista algun aviso visible.
Then('the visitor sees a notice that says {string}', async function (texto) {
  await expect(this.aviso).toHaveText(texto);
});
