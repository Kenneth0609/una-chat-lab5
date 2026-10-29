# Contrato de una regla de envio (`public/validators/<regla>.js`)

Cada archivo `.js` de `public/validators/` es **una regla independiente** que corre cuando el visitante pulsa **Send**,
antes de emitir el mensaje al servidor. `GET /validators.js` las entrega concatenadas (orden alfabetico del archivo),
asi agregar una regla no obliga a editar `index.html` ni `public/chat.js`.

```js
// public/validators/<nombre-de-la-regla>.js
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
    validate: function (ctx) { return null; }
  };
});
```

Comportamiento que aplica `public/chat.js` cuando una regla devuelve un fallo:

1. El mensaje **no se emite**: no entra a la conversacion de ningun cliente.
2. `texto` se escribe en el aviso (`<div id="aviso" role="alert">`).
3. `limpiar: true` deja vacio el campo `campo`; `limpiar: false` conserva lo escrito.
4. El foco vuelve a `campo`.
5. `registerSendValidator(fn, prioridad)` admite una prioridad numerica opcional (por defecto 0).
   Se ejecutan primero las prioridades menores; los empates conservan el orden alfabetico de carga.
   La longitud usa -10: si un mensaje tiene mas de 280 caracteres, se conserva y se avisa que es demasiado largo,
   incluso cuando solo contiene espacios o tambien falta el nombre (decision del usuario, 2026-10-28).
6. Un envio valido borra el aviso, emite el mensaje y vacia el campo de mensaje.
