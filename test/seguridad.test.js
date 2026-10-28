// Pruebas unitarias de SEGURIDAD (paso 7: prevencion de inyeccion de scripts).
// Se escribieron ANTES de endurecer validateMessage (TDD: primero en rojo, luego en verde).
var val = require('../libs/unalib');
var assert = require('assert');

// helper: envia un mensaje como lo hace el cliente y devuelve el objeto saneado
function enviar(datos) {
  var salida = val.validateMessage(JSON.stringify(datos));
  return JSON.parse(salida);
}

function mensajeDe(texto) {
  return enviar({ nombre: 'Test', mensaje: texto, color: '#112233' });
}

// Cualquier cosa que el navegador pudiera interpretar como etiqueta HTML
var ETIQUETA_HTML = /<\s*\/?\s*[a-z!]/i;

describe('seguridad: prevencion de inyeccion de scripts', function () {

  describe('mensaje con <script>', function () {

    it('bloquea el script del laboratorio (paso 2) y no deja etiquetas en la salida', function () {
      var r = mensajeDe("<script>alert('Inyección de script');</script>");
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
      assert.doesNotMatch(r.mensaje, /alert\(/);
      assert.strictEqual(r.tipo, 'bloqueado');
    });

    it('bloquea <script> con mayusculas y minusculas mezcladas', function () {
      var r = mensajeDe('<ScRiPt>alert(1)</sCrIpT>');
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
      assert.strictEqual(r.tipo, 'bloqueado');
    });

    it('bloquea un <script> sin etiqueta de cierre', function () {
      var r = mensajeDe('<script>alert(1)');
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
      assert.doesNotMatch(r.mensaje, /alert/);
    });

    it('bloquea <script src="..."> externo', function () {
      var r = mensajeDe('<script src="https://evil.example/x.js"></script>');
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
      assert.doesNotMatch(r.mensaje, /evil\.example/);
    });

  });

  describe('otras tecnicas de inyeccion', function () {

    it('neutraliza <img src=x onerror=...>', function () {
      var r = mensajeDe('<img src=x onerror=alert(1)>');
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
      assert.doesNotMatch(r.mensaje, /onerror/i);
    });

    it('neutraliza <svg onload=...>', function () {
      var r = mensajeDe('<svg onload=alert(1)>');
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
      assert.doesNotMatch(r.mensaje, /onload/i);
    });

    it('neutraliza <iframe src="javascript:...">', function () {
      var r = mensajeDe('<iframe src="javascript:alert(1)"></iframe>');
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
    });

    it('un enlace javascript: se muestra solo como texto, nunca como imagen o video', function () {
      var r = mensajeDe('javascript:alert(1)');
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
      assert.strictEqual(r.tipo, 'texto');
    });

    it('no permite salirse del atributo src con comillas (http://x/a.jpg" onerror="...)', function () {
      var r = mensajeDe('http://x.com/a.jpg" onerror="alert(1)');
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
      assert.doesNotMatch(r.mensaje, /"/);
      assert.strictEqual(r.tipo, 'texto');
    });

    it('no acepta una imagen data: URI', function () {
      var r = mensajeDe('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+');
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
      assert.strictEqual(r.tipo, 'texto');
    });

    it('elimina etiquetas inofensivas pero conserva el texto', function () {
      var r = mensajeDe('hola <b>mundo</b>');
      assert.strictEqual(r.mensaje, 'hola mundo');
    });

    it('escapa los caracteres especiales del texto normal', function () {
      var r = mensajeDe('Tom & Jerry <3 "comillas" \'simples\'');
      assert.strictEqual(r.mensaje, 'Tom &amp; Jerry &lt;3 &quot;comillas&quot; &#39;simples&#39;');
    });

  });

  describe('campos nombre y color', function () {

    it('sanea el nombre de usuario', function () {
      var r = enviar({ nombre: '<script>alert(1)</script>Eva', mensaje: 'hola', color: '#112233' });
      assert.doesNotMatch(r.nombre, ETIQUETA_HTML);
      assert.strictEqual(r.nombre, 'Eva');
    });

    it('si el nombre queda vacio tras sanear, usa un nombre por defecto', function () {
      var r = enviar({ nombre: '<script>alert(1)</script>', mensaje: 'hola', color: '#112233' });
      assert.strictEqual(r.nombre, 'Anonimo');
    });

    it('rechaza un color que no sea hexadecimal (inyeccion en el atributo style)', function () {
      var r = enviar({ nombre: 'Eva', mensaje: 'hola', color: 'red;background:url(javascript:alert(1))' });
      assert.strictEqual(r.color, '#000000');
    });

    it('conserva un color hexadecimal valido', function () {
      var r = enviar({ nombre: 'Eva', mensaje: 'hola', color: '#A1b2C3' });
      assert.strictEqual(r.color, '#A1b2C3');
    });

  });

  describe('entradas malformadas', function () {

    it('un JSON invalido con script no se devuelve sin sanear', function () {
      var salida = JSON.parse(val.validateMessage('<script>alert(1)</script>'));
      assert.doesNotMatch(salida.mensaje, ETIQUETA_HTML);
    });

    it('no lanza error con entradas que no son texto', function () {
      [undefined, null, 42, {}, [], true].forEach(function (entrada) {
        var salida = JSON.parse(val.validateMessage(entrada));
        assert.strictEqual(salida.mensaje, '');
      });
    });

    it('tolera que "mensaje" no sea un string', function () {
      var r = enviar({ nombre: 'Eva', mensaje: { a: '<script>' }, color: '#112233' });
      assert.strictEqual(typeof r.mensaje, 'string');
      assert.doesNotMatch(r.mensaje, ETIQUETA_HTML);
    });

    it('tolera un JSON que no es un objeto', function () {
      var salida = JSON.parse(val.validateMessage('"<script>alert(1)</script>"'));
      assert.doesNotMatch(salida.mensaje, ETIQUETA_HTML);
    });

    it('la salida siempre es JSON con las claves esperadas', function () {
      var r = mensajeDe('hola');
      assert.deepStrictEqual(Object.keys(r).sort(), ['color', 'mensaje', 'nombre', 'tipo']);
    });

  });

  describe('alias en espanol', function () {

    it('validarMensaje devuelve lo mismo que validateMessage', function () {
      var entrada = JSON.stringify({ nombre: 'Eva', mensaje: '<script>x</script>', color: '#112233' });
      assert.strictEqual(val.validarMensaje(entrada), val.validateMessage(entrada));
    });

  });

});
