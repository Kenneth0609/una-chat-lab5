// public/validators/nombre-obligatorio.js
// REQ-011: Messages need a name.
(function (root, factory) {
  var regla = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = regla;                                   // pruebas unitarias en Node: require(...).validate
  } else if (root.UNAChat) {
    root.UNAChat.registerSendValidator(regla.validate);       // navegador
  }
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    // ctx = { nombre: <valor crudo del campo Username>, mensaje: <valor crudo del campo de mensaje> }
    // retorna null si el envio es valido, o:
    //   { campo: 'nombre' | 'mensaje', texto: '<aviso para el visitante>', limpiar: true | false }
    validate: function (ctx) {
      var nombreVacio = !ctx.nombre || ctx.nombre.trim() === '';
      var mensajeReal = !!ctx.mensaje && ctx.mensaje.trim() !== '';
      if (nombreVacio && mensajeReal) {
        return { campo: 'nombre', texto: 'Escriba un nombre para enviar el mensaje.', limpiar: true };
      }
      return null;
    }
  };
});
