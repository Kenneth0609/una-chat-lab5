// public/validators/message-length.js
(function (root, factory) {
  var regla = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = regla;
  } else if (root.UNAChat) {
    // Decision de negocio: conservar primero cualquier texto que exceda 280 caracteres,
    // incluso si contiene solo espacios o el nombre tambien esta vacio.
    root.UNAChat.registerSendValidator(regla.validate, -10);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  var LIMITE = 280;
  return {
    // ctx = { nombre: <raw Username value>, mensaje: <raw message value> }
    validate: function (ctx) {
      if (ctx.mensaje.length > LIMITE) {
        return {
          campo: 'mensaje',
          texto: 'El mensaje es demasiado largo (máximo 280 caracteres).',
          limpiar: false
        };
      }
      return null;
    }
  };
});
