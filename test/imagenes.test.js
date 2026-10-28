// Pruebas unitarias (paso 7): validacion de URLs de imagenes
var val = require('../libs/unalib');
var assert = require('assert');

describe('imagenes: URLs de imagen en el chat', function () {

  describe('is_valid_url_image: URLs permitidas', function () {

    [
      'http://image.com/image.jpg',
      'http://image.com/image.gif',
      'https://image.com/foto.png',
      'https://image.com/foto.jpeg',
      'https://image.com/foto.bmp',
      'https://image.com/foto.webp',
      'https://CDN.Example.com/Fotos/FOTO.JPG',
      'https://example.com/a/b/c/imagen-con_guiones.png',
      'https://example.com/imagen.png?w=300&h=200',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png',
      '  https://example.com/con-espacios-alrededor.png  '
    ].forEach(function (url) {
      it('acepta ' + url.trim(), function () {
        assert.strictEqual(val.is_valid_url_image(url), true);
      });
    });

  });

  describe('is_valid_url_image: URLs rechazadas', function () {

    [
      ['sin extension de imagen', 'https://example.com/imagen'],
      ['una pagina web', 'https://example.com/index.html'],
      ['un ejecutable', 'https://example.com/virus.exe'],
      ['doble extension peligrosa', 'https://example.com/foto.jpg.exe'],
      ['protocolo javascript:', 'javascript:alert(1)//.jpg'],
      ['protocolo ftp:', 'ftp://example.com/foto.jpg'],
      ['protocolo file:', 'file:///C:/foto.jpg'],
      ['data URI', 'data:image/png;base64,iVBORw0KGgo='],
      ['URL relativa al protocolo', '//example.com/foto.jpg'],
      ['sin protocolo', 'example.com/foto.jpg'],
      ['con espacios internos', 'https://example.com/mi foto.jpg'],
      ['con comillas (rompe el atributo src)', 'https://example.com/a.jpg"onerror="alert(1)'],
      ['con menor que', 'https://example.com/a.jpg?x=<script>'],
      ['con credenciales embebidas', 'https://usuario:clave@example.com/foto.jpg'],
      ['texto normal', 'hola mundo'],
      ['cadena vacia', '']
    ].forEach(function (caso) {
      it('rechaza ' + caso[0], function () {
        assert.strictEqual(val.is_valid_url_image(caso[1]), false);
      });
    });

    it('rechaza valores que no son texto', function () {
      [undefined, null, 42, {}, [], true].forEach(function (valor) {
        assert.strictEqual(val.is_valid_url_image(valor), false);
      });
    });

  });

  describe('getImageTag', function () {

    it('genera una etiqueta <img> con la URL y sin manejadores de eventos', function () {
      var tag = val.getImageTag('http://image.com/image.jpg');
      assert.match(tag, /^<img /);
      assert.match(tag, /src="http:\/\/image\.com\/image\.jpg"/);
      assert.doesNotMatch(tag, /\bon\w+\s*=/i);
    });

    it('escapa cualquier caracter peligroso de la URL', function () {
      var tag = val.getImageTag('http://image.com/a.jpg?x="><script>alert(1)</script>');
      assert.doesNotMatch(tag, /<script/i);
      assert.strictEqual((tag.match(/</g) || []).length, 1);
    });

  });

  describe('validateMessage con URL de imagen', function () {

    it('convierte la URL en una imagen mostrada en el chat', function () {
      var salida = JSON.parse(val.validateMessage(JSON.stringify({
        nombre: 'Ana', mensaje: 'https://image.com/foto.png', color: '#112233'
      })));
      assert.strictEqual(salida.tipo, 'imagen');
      assert.match(salida.mensaje, /^<img src="https:\/\/image\.com\/foto\.png"/);
      assert.strictEqual(salida.nombre, 'Ana');
    });

    it('acepta la URL aunque tenga espacios alrededor', function () {
      var salida = JSON.parse(val.validateMessage(JSON.stringify({
        nombre: 'Ana', mensaje: '   https://image.com/foto.png  ', color: '#112233'
      })));
      assert.strictEqual(salida.tipo, 'imagen');
    });

    it('una URL que no es de imagen se muestra como texto', function () {
      var salida = JSON.parse(val.validateMessage(JSON.stringify({
        nombre: 'Ana', mensaje: 'https://example.com/pagina.html', color: '#112233'
      })));
      assert.strictEqual(salida.tipo, 'texto');
      assert.strictEqual(salida.mensaje, 'https://example.com/pagina.html');
    });

  });

});
