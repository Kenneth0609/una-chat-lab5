// Pruebas unitarias (paso 7): validacion de URLs de videos
var val = require('../libs/unalib');
var assert = require('assert');

describe('videos: URLs de video en el chat', function () {

  describe('is_valid_url_video: archivos de video directos', function () {

    [
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
      'https://example.com/clip.mp4',
      'http://example.com/clip.ogg',
      'https://example.com/clip.ogv',
      'https://example.com/clip.m4v',
      'https://EXAMPLE.com/CLIP.MP4',
      'https://example.com/clip.mp4?token=abc123'
    ].forEach(function (url) {
      it('acepta ' + url, function () {
        assert.strictEqual(val.is_valid_url_video(url), true);
      });
    });

    [
      ['una imagen', 'https://example.com/foto.jpg'],
      ['una pagina web', 'https://example.com/video.html'],
      ['un ejecutable', 'https://example.com/video.mp4.exe'],
      ['protocolo javascript:', 'javascript:alert(1)//.mp4'],
      ['data URI', 'data:video/mp4;base64,AAAA'],
      ['con comillas', 'https://example.com/a.mp4"onloadstart="alert(1)'],
      ['con espacios internos', 'https://example.com/mi video.mp4'],
      ['texto normal', 'hola mundo']
    ].forEach(function (caso) {
      it('rechaza ' + caso[0], function () {
        assert.strictEqual(val.is_valid_url_video(caso[1]), false);
      });
    });

    it('rechaza valores que no son texto', function () {
      [undefined, null, 42, {}, []].forEach(function (valor) {
        assert.strictEqual(val.is_valid_url_video(valor), false);
      });
    });

  });

  describe('is_valid_yt_video: videos de YouTube', function () {

    [
      'https://www.youtube.com/watch?v=qYwlqx-JLok',
      'http://www.youtube.com/watch?v=qYwlqx-JLok',
      'https://youtube.com/watch?v=qYwlqx-JLok',
      'https://youtu.be/qYwlqx-JLok',
      'https://www.youtube.com/embed/qYwlqx-JLok',
      'https://www.youtube.com/watch?v=qYwlqx-JLok&t=30s',
      'https://www.youtube.com/watch?feature=share&v=qYwlqx-JLok'
    ].forEach(function (url) {
      it('acepta ' + url, function () {
        assert.strictEqual(val.is_valid_yt_video(url), true);
      });
    });

    [
      ['identificador demasiado corto', 'https://www.youtube.com/watch?v=abc'],
      ['sin identificador', 'https://www.youtube.com/watch?v='],
      ['dominio falso al inicio', 'https://youtube.com.evil.example/watch?v=qYwlqx-JLok'],
      ['dominio falso en el parametro', 'https://evil.example/?u=youtube.com/watch?v=qYwlqx-JLok'],
      ['comillas en el identificador', 'https://youtu.be/qYwlqx-JLo"onload="alert(1)'],
      ['otra red de video', 'https://vimeo.com/123456789']
    ].forEach(function (caso) {
      it('rechaza ' + caso[0], function () {
        assert.strictEqual(val.is_valid_yt_video(caso[1]), false);
      });
    });

    it('rechaza valores que no son texto', function () {
      [undefined, null, 42, {}, []].forEach(function (valor) {
        assert.strictEqual(val.is_valid_yt_video(valor), false);
      });
    });

  });

  describe('getYTVideoId', function () {

    it('extrae el identificador de las distintas formas de URL', function () {
      assert.strictEqual(val.getYTVideoId('https://www.youtube.com/watch?v=qYwlqx-JLok'), 'qYwlqx-JLok');
      assert.strictEqual(val.getYTVideoId('https://youtu.be/qYwlqx-JLok'), 'qYwlqx-JLok');
      assert.strictEqual(val.getYTVideoId('https://www.youtube.com/embed/qYwlqx-JLok'), 'qYwlqx-JLok');
    });

    it('devuelve null (sin lanzar error) si no hay identificador', function () {
      assert.strictEqual(val.getYTVideoId('https://example.com/'), null);
    });

  });

  describe('reproductores insertados en el chat', function () {

    it('getVideoTag genera un <video> con controles y sin manejadores de eventos', function () {
      var tag = val.getVideoTag('https://example.com/clip.mp4');
      assert.match(tag, /^<video /);
      assert.match(tag, /\bcontrols\b/);
      assert.match(tag, /src="https:\/\/example\.com\/clip\.mp4"/);
      assert.doesNotMatch(tag, /\bon\w+\s*=/i);
    });

    it('getEmbeddedCode genera el iframe de YouTube con el identificador correcto', function () {
      var code = val.getEmbeddedCode('https://www.youtube.com/watch?v=qYwlqx-JLok');
      assert.match(code, /^<iframe /);
      assert.match(code, /src="https:\/\/www\.youtube\.com\/embed\/qYwlqx-JLok"/);
    });

    it('validateMessage convierte un archivo de video en un reproductor <video>', function () {
      var salida = JSON.parse(val.validateMessage(JSON.stringify({
        nombre: 'Ana', mensaje: 'https://example.com/clip.webm', color: '#112233'
      })));
      assert.strictEqual(salida.tipo, 'video');
      assert.match(salida.mensaje, /^<video /);
      assert.match(salida.mensaje, /controls/);
    });

    it('validateMessage convierte un enlace de YouTube en un reproductor incrustado', function () {
      var salida = JSON.parse(val.validateMessage(JSON.stringify({
        nombre: 'Ana', mensaje: 'https://www.youtube.com/watch?v=qYwlqx-JLok', color: '#112233'
      })));
      assert.strictEqual(salida.tipo, 'video');
      assert.match(salida.mensaje, /^<iframe /);
      assert.match(salida.mensaje, /youtube\.com\/embed\/qYwlqx-JLok/);
    });

    it('una URL de video no permitida se muestra solo como texto', function () {
      var salida = JSON.parse(val.validateMessage(JSON.stringify({
        nombre: 'Ana', mensaje: 'https://example.com/pelicula.avi', color: '#112233'
      })));
      assert.strictEqual(salida.tipo, 'texto');
      assert.doesNotMatch(salida.mensaje, /</);
    });

  });

});
