// public/validators/mensaje-vacio.js
// REQ-010: bloquea Send cuando el mensaje esta vacio o contiene solo espacios en blanco.
(function (root, factory) {
  var regla = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = regla;
  } else if (root.UNAChat) {
    root.UNAChat.registerSendValidator(regla.validate);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    validate: function (ctx) {
      if (ctx.mensaje.trim() === '') {
        return { campo: 'mensaje', texto: 'Escribe un mensaje antes de enviarlo.', limpiar: true };
      }
      return null;
    }
  };
});
