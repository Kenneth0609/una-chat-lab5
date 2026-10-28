// Pruebas unitarias REQ-012 (mensajes cortos): regla de envio public/validators/message-length.js,
// siguiendo la "Testable interface" de openspec/changes/req-012-messages-stay-short/design.md.
// Escritas ANTES de que exista el archivo (TDD: primero en rojo, luego en verde).
//
// El require() del modulo nuevo va DENTRO de un before(), nunca al inicio del archivo: si el modulo no
// existe todavia, un require a nivel de archivo abortaria TODO Mocha (incluidas las pruebas existentes).
var assert = require('assert');

describe('REQ-012: messages stay short (unitarias - regla message-length.js)', function () {
  var regla;

  before(function () {
    // el archivo aun no existe: este require fallara con "Cannot find module" (el rojo esperado)
    regla = require('../public/validators/message-length.js');
  });

  it('REQ-012: bloquea el envio de un mensaje de 281 caracteres devolviendo un rechazo sobre el campo "mensaje"', function () {
    var resultado = regla.validate({ nombre: 'Ana', mensaje: 'a'.repeat(281) });
    assert.ok(resultado, 'la regla debe devolver un objeto de rechazo (no null) para 281 caracteres');
    assert.strictEqual(resultado.campo, 'mensaje');
  });

  it('REQ-012: al bloquear un mensaje demasiado largo, conserva el texto escrito (limpiar: false)', function () {
    var resultado = regla.validate({ nombre: 'Ana', mensaje: 'a'.repeat(281) });
    assert.ok(resultado);
    assert.strictEqual(resultado.limpiar, false);
  });

  it('REQ-012: al bloquear un mensaje demasiado largo, el texto del aviso dice que es demasiado largo', function () {
    var resultado = regla.validate({ nombre: 'Ana', mensaje: 'a'.repeat(281) });
    assert.ok(resultado);
    assert.match(resultado.texto, /demasiado largo/i);
  });

  it('REQ-012: acepta un mensaje de exactamente 280 caracteres (no bloquea: devuelve null)', function () {
    var resultado = regla.validate({ nombre: 'Ana', mensaje: 'a'.repeat(280) });
    assert.strictEqual(resultado, null);
  });

  it('REQ-012: bloquea tambien un mensaje de 281 caracteres hecho solo de espacios (no se recorta antes de contar)', function () {
    var resultado = regla.validate({ nombre: 'Ana', mensaje: ' '.repeat(281) });
    assert.ok(resultado, 'la regla debe bloquear 281 espacios igual que 281 letras');
    assert.strictEqual(resultado.campo, 'mensaje');
  });

  it('REQ-012: no bloquea un mensaje corto normal', function () {
    var resultado = regla.validate({ nombre: 'Ana', mensaje: 'hola' });
    assert.strictEqual(resultado, null);
  });
});
