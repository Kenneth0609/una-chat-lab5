(function () {

  var socket = io();
  var colorHexTxt = "";

  // genera colores aleatorios en hexadeximal
  function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }

    return color;
  }

  var form = document.querySelector('form');
  var nombre = document.getElementById('nombre');
  var mensaje = document.getElementById('m');
  var lista = document.getElementById('messages');
  var aviso = document.getElementById('aviso');

  // Punto de extension del chat. Cada regla de envio vive en su propio archivo dentro de
  // public/validators/ (el servidor los entrega juntos en /validators.js), asi varias
  // personas o agentes pueden agregar reglas en paralelo sin tocar este archivo.
  //
  //   UNAChat.registerSendValidator(function (ctx) { ... })
  //     ctx     = { nombre: <valor del campo Username>, mensaje: <valor del campo de mensaje> }
  //     retorna = null si el envio es valido, o
  //               { campo: 'nombre' | 'mensaje', texto: '<aviso para el visitante>', limpiar: true | false }
  //               (limpiar: vaciar el campo indicado; false: conservar lo escrito)
  //   Los validadores corren en orden alfabetico del nombre de archivo; gana el primero que falla.
  var validators = [];
  window.UNAChat = {
    registerSendValidator: function (fn) { validators.push(fn); },
    notify: function (texto) { aviso.textContent = texto; },
    clearNotice: function () { aviso.textContent = ''; }
  };

  // devuelve el primer fallo de validacion (o null) y lo aplica en pantalla
  function validarEnvio(ctx) {
    for (var i = 0; i < validators.length; i++) {
      var fallo = validators[i](ctx);
      if (fallo) {
        window.UNAChat.notify(fallo.texto);
        var campo = fallo.campo === 'nombre' ? nombre : mensaje;
        if (fallo.limpiar) {
          campo.value = '';
        }
        campo.focus();
        return fallo;
      }
    }
    return null;
  }

  // emite evento al servidor
  form.addEventListener('submit', function (evento) {
    evento.preventDefault();

    if (validarEnvio({ nombre: nombre.value, mensaje: mensaje.value })) {
      return;
    }
    window.UNAChat.clearNotice();

    var nombreTxt = nombre.value || "Anonimo";
    var mensajeTxt = mensaje.value;

    if (colorHexTxt == "") {
      colorHexTxt = getRandomColor();
    }

    var jsonMsg = { nombre: nombreTxt, mensaje: mensajeTxt, color: colorHexTxt };
    socket.emit('Evento-Mensaje-Server', JSON.stringify(jsonMsg));
    mensaje.value = '';
  });

  // recibe el mensaje ya validado y saneado por unalib en el servidor:
  // "nombre" y "mensaje" llegan como HTML seguro (texto escapado, o <img>/<video>/<iframe> permitidos)
  socket.on('Evento-Mensaje-Server', function (msg) {
    var msgJson = JSON.parse(msg);

    var autor = document.createElement('b');
    if (/^#[0-9a-f]{6}$/i.test(msgJson.color)) {
      autor.style.color = msgJson.color;
    }
    autor.innerHTML = msgJson.nombre;

    var contenido = document.createElement('span');
    contenido.className = 'mensaje';
    contenido.innerHTML = msgJson.mensaje;

    var item = document.createElement('li');
    item.appendChild(autor);
    item.appendChild(document.createTextNode(': '));
    item.appendChild(contenido);
    lista.appendChild(item);

    window.scrollTo(0, document.body.scrollHeight);
  });

})();
