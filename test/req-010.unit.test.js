// Pruebas unitarias de REQ-010: regla de envio que bloquea un mensaje vacio o de solo espacios en
// blanco. Interfaz probada segun el "Testable interface" de
// openspec/changes/req-010-empty-messages-are-not-published/design.md:
//   validate(ctx) con ctx = { nombre, mensaje }, devuelve null si es valido o
//   { campo: 'mensaje', texto: 'Escribe un mensaje antes de enviarlo.', limpiar: true } si se rechaza.
//
// El require del modulo NUEVO se hace dentro de un before() (no al inicio del archivo): hoy
// public/validators/mensaje-vacio.js no existe, y un require fallido en la raiz del archivo
// abortaria toda la ejecucion de Mocha, tapando las demas suites existentes.
//
// El require se envuelve en try/catch: si fallara al cargar, cada prueba lo reporta con un
// assert.ok() propio y un mensaje claro de conducta faltante, en vez de dejar que el error crudo
// de resolucion de modulos de Node ("Cannot find module ...") se imprima tal cual. Eso evita que
// un gate rojo/verde confunda "falta implementar la regla" con un error de carga/infraestructura.
var assert = require('assert');

describe('REQ-010: regla de envio para mensaje vacio o de solo espacios en blanco', function () {
  var regla = null;

  before(function () {
    try {
      regla = require('../public/validators/mensaje-vacio');
    } catch (e) {
      regla = null;
    }
  });

  var AVISO_ESPERADO = 'Escribe un mensaje antes de enviarlo.';

  // centraliza la llamada: si la regla no existe o no expone validate(), falla con una aserccion
  // legible ("falta implementar...") en vez de un TypeError/"Cannot find module" crudo
  function validar(ctx) {
    assert.ok(
      regla && typeof regla.validate === 'function',
      'Falta implementar public/validators/mensaje-vacio.js exportando { validate(ctx) } (REQ-010)'
    );
    return regla.validate(ctx);
  }

  it('REQ-010: rechaza un mensaje completamente vacio ("")', function () {
    var resultado = validar({ nombre: 'Ana', mensaje: '' });
    assert.deepStrictEqual(resultado, { campo: 'mensaje', texto: AVISO_ESPERADO, limpiar: true });
  });

  it('REQ-010: rechaza un mensaje que contiene solo espacios ("   ")', function () {
    var resultado = validar({ nombre: 'Ana', mensaje: '   ' });
    assert.deepStrictEqual(resultado, { campo: 'mensaje', texto: AVISO_ESPERADO, limpiar: true });
  });

  it('REQ-010: rechaza un mensaje que contiene solo tabs ("\\t\\t\\t")', function () {
    var resultado = validar({ nombre: 'Ana', mensaje: '\t\t\t' });
    assert.deepStrictEqual(resultado, { campo: 'mensaje', texto: AVISO_ESPERADO, limpiar: true });
  });

  it('REQ-010: rechaza un mensaje con una mezcla de espacios y tabs ("\\t \\t")', function () {
    var resultado = validar({ nombre: 'Ana', mensaje: '\t \t' });
    assert.deepStrictEqual(resultado, { campo: 'mensaje', texto: AVISO_ESPERADO, limpiar: true });
  });

  it('REQ-010: NO rechaza un mensaje con espacios alrededor pero con contenido real ("  hola  ")', function () {
    var resultado = validar({ nombre: 'Ana', mensaje: '  hola  ' });
    assert.strictEqual(resultado, null);
  });

  it('REQ-010: NO rechaza un mensaje normal sin espacios sobrantes ("hola")', function () {
    var resultado = validar({ nombre: 'Ana', mensaje: 'hola' });
    assert.strictEqual(resultado, null);
  });

  it('REQ-010: cuando rechaza, siempre senala el campo "mensaje" (nunca "nombre") y pide limpiarlo', function () {
    var resultado = validar({ nombre: '', mensaje: '' });
    assert.strictEqual(resultado.campo, 'mensaje');
    assert.strictEqual(resultado.limpiar, true);
  });
});
