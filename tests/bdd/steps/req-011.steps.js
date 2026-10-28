// Pasos Gherkin propios de REQ-011 (Messages need a name). Solo se definen los pasos que NO
// existen ya en tests/bdd/support/common.steps.js, con texto propio para no chocar con otros
// requerimientos.
//
// Nota: common.steps.js ya registra DOS pasos con el texto idéntico "the username field is
// empty" (uno Given en la linea 16, otro Then en la linea 50); Cucumber empareja por texto sin
// distinguir Given/When/Then, asi que usar esa frase en cualquier escenario es ambiguo. Por eso
// aqui se usa "the username field contains \"\"" (para vaciar el campo) y un paso propio,
// "the username field has been cleared" (para verificar que quedo vacio), con texto unico.
const { Given, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

const AVISO_ESPERADO = 'Escriba un nombre para enviar el mensaje.';

Given('the username field contains only tab and newline characters', async function () {
  await this.campoNombre.fill('\t\n\t\n');
});

Then('the username field has been cleared', async function () {
  await expect(this.campoNombre).toHaveValue('');
});

Then('the visitor is told to write a name', async function () {
  await expect(this.aviso).toHaveText(AVISO_ESPERADO);
});

// No se usa this.aviso (getByRole('alert')) aqui: el contrato dice que #aviso esta oculto
// mientras no hay aviso, lo que lo saca del arbol de accesibilidad y getByRole('alert') no
// encuentra nada -> toHaveText/not.toHaveText esperarian el elemento y expirarian por timeout
// aunque la ausencia de aviso sea el comportamiento correcto. Leer el texto por id evita eso.
Then('the visitor is not told to write a name', async function () {
  const texto = await this.page.locator('#aviso').textContent();
  expect((texto || '').trim()).not.toBe(AVISO_ESPERADO);
});
