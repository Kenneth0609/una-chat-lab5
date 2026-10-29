# Reglas de envio del chat (`public/validators/`)

Cada archivo `.js` de esta carpeta es **una regla independiente** que se ejecuta cuando el visitante pulsa
**Send**, antes de emitir el mensaje. El servidor las entrega concatenadas en `/validators.js`
(orden alfabetico del nombre de archivo), de modo que agregar una regla no obliga a editar `index.html`
ni `public/chat.js`.

## Contrato

```js
// public/validators/<nombre-de-la-regla>.js
(function (root, factory) {
  var regla = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = regla;                                   // pruebas unitarias en Node
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

- Si una regla devuelve un fallo, el mensaje **no se emite** al servidor (no entra en la conversacion),
  se muestra `texto` en el aviso (`<div id="aviso" role="alert">`) y el foco vuelve a `campo`.
- `limpiar: true` vacia el campo indicado; `limpiar: false` conserva lo que el visitante escribio.
- `registerSendValidator(fn, prioridad)` acepta una prioridad numerica opcional (0 por defecto).
  Gana la primera regla que falle: menor prioridad primero; los empates mantienen el orden alfabetico del archivo.
  El limite de longitud usa -10 para conservar textos de mas de 280 caracteres, incluso si solo contienen espacios.
