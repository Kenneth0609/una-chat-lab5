(function () {

  var socket = io({ path: '/api/chat/socket.io', addTrailingSlash: false, transports: ['websocket'], autoConnect: false });
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
  var enviar = form.querySelector('button');
  var identity = document.getElementById('identity');
  function requireLogin() {
    enviar.disabled = true;
    socket.disconnect();
    window.location.assign('/');
  }
  fetch('/api/me', { cache: 'no-store' }).then(function (response) {
    if (response.status === 401) { requireLogin(); return null; }
    if (!response.ok) throw new Error('profile');
    return response.json();
  }).then(function (user) {
    if (!user) return;
    nombre.value = user.name;
    identity.textContent = user.name + (user.email ? ' · ' + user.email : '');
    socket.connect();
  }).catch(function () { aviso.textContent = 'No se pudo cargar tu sesión. Recarga la página para reintentar.'; });
  document.getElementById('logout').addEventListener('click', function () { socket.disconnect(); enviar.disabled = true; });
  socket.on('auth-required', requireLogin);
  socket.on('connect', function () { enviar.disabled = false; aviso.textContent = ''; });
  socket.on('disconnect', function (reason) {
    enviar.disabled = true;
    if (reason === 'io server disconnect') { requireLogin(); return; }
    aviso.textContent = 'Se perdió la conexión. Estamos intentando reconectar.';
  });
  socket.on('connect_error', function () {
    enviar.disabled = true;
    fetch('/api/me', { cache: 'no-store' }).then(function (response) {
      if (response.status === 401) requireLogin();
      else {
        aviso.textContent = 'Se perdió la conexión. Estamos intentando reconectar.';
        if (!socket.active) setTimeout(function () { socket.connect(); }, 3000);
      }
    }).catch(function () { aviso.textContent = 'Se perdió la conexión. Estamos intentando reconectar.'; });
  });

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
    if (!socket.connected) return;

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
