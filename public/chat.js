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

  // emite evento al servidor
  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
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
