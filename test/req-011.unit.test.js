// Pruebas UNITARIAS de REQ-011 (Messages need a name): la regla de envio
// public/validators/nombre-obligatorio.js, segun la "Testable interface" de design.md y
// el contrato harness/contracts/send-validator.md.
//
// El require del modulo se hace dentro de un before() (no al inicio del archivo): hoy el
// archivo no existe, y un require fallido arriba del archivo abortaria TODO Mocha, tapando
// las demas suites. El "Cannot find module" dentro del before es el rojo esperado.
var assert = require('assert');

describe('REQ-011: regla de envio "nombre obligatorio" (public/validators/nombre-obligatorio.js)', function () {
  var regla;

  before(function () {
    regla = require('../public/validators/nombre-obligatorio');
  });

  it('REQ-011: username vacio + mensaje real -> rechaza con el aviso exacto y limpiar=true sobre "nombre"', function () {
    var resultado = regla.validate({ nombre: '', mensaje: 'Hola a todos' });
    assert.deepStrictEqual(resultado, {
      campo: 'nombre',
      texto: 'Escriba un nombre para enviar el mensaje.',
      limpiar: true
    });
  });

  it('REQ-011: username solo con espacios ("   ") + mensaje real -> rechaza', function () {
    var resultado = regla.validate({ nombre: '   ', mensaje: 'Hola a todos' });
    assert.deepStrictEqual(resultado, {
      campo: 'nombre',
      texto: 'Escriba un nombre para enviar el mensaje.',
      limpiar: true
    });
  });

  it('REQ-011: username formado solo por tabs y saltos de linea + mensaje real -> rechaza', function () {
    var resultado = regla.validate({ nombre: '\t\n\t\n', mensaje: 'Hola a todos' });
    assert.deepStrictEqual(resultado, {
      campo: 'nombre',
      texto: 'Escriba un nombre para enviar el mensaje.',
      limpiar: true
    });
  });

  it('REQ-011: username con texto real rodeado de espacios ("  Ana  ") + mensaje real -> se acepta (null)', function () {
    var resultado = regla.validate({ nombre: '  Ana  ', mensaje: 'Hola a todos' });
    assert.strictEqual(resultado, null);
  });

  it('REQ-011: username vacio + mensaje vacio -> fuera del alcance de esta regla (null)', function () {
    var resultado = regla.validate({ nombre: '', mensaje: '' });
    assert.strictEqual(resultado, null);
  });

  it('REQ-011: username vacio + mensaje solo con espacios -> fuera del alcance de esta regla (null)', function () {
    var resultado = regla.validate({ nombre: '', mensaje: '   ' });
    assert.strictEqual(resultado, null);
  });

  it('REQ-011: username ausente (undefined) + mensaje real -> rechaza igual que username vacio', function () {
    var resultado = regla.validate({ mensaje: 'Hola a todos' });
    assert.deepStrictEqual(resultado, {
      campo: 'nombre',
      texto: 'Escriba un nombre para enviar el mensaje.',
      limpiar: true
    });
  });
});
