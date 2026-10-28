
// npm install para descargar los paquetes...

// librerias
var fs = require('fs');
var path = require('path');
var express = require('express');
var validation = require('./libs/unalib');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

// Politica de seguridad de contenido (defensa en profundidad): aunque algun codigo lograra colarse
// en un mensaje, el navegador no ejecutaria scripts en linea ni cargaria scripts de otros sitios.
var CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src http: https:",
  "media-src http: https:",
  "frame-src https://www.youtube.com",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

app.use(function(req, res, next){
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// reglas de envio del cliente: cada archivo de public/validators/ es una regla independiente;
// se entregan concatenadas (orden alfabetico) para no tener que editar index.html al agregar una
app.get('/validators.js', function(req, res){
  var dir = path.join(__dirname, 'public', 'validators');
  var archivos = fs.existsSync(dir) ? fs.readdirSync(dir).filter(function(f){ return /\.js$/.test(f); }).sort() : [];
  var codigo = archivos.map(function(f){
    return '// ' + f + '\n' + fs.readFileSync(path.join(dir, f), 'utf8');
  }).join('\n');
  res.type('application/javascript').send(codigo || '// sin reglas de envio\n');
});

// archivos estaticos del chat (chat.js y chat.css)
app.use(express.static(path.join(__dirname, 'public')));

// root: presentar html
app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'index.html'));
});

// escuchar una conexion por socket
io.on('connection', function(socket){
  // si se escucha "chat message"
  socket.on('Evento-Mensaje-Server', function(msg){

    // la libreria valida y sanea el mensaje (script injection, URLs de imagenes y videos)
    msg = validation.validateMessage(msg);
    // volvemos a emitir el mensaje ya saneado
    io.emit('Evento-Mensaje-Server', msg);
  });
});

// solo se abre el puerto cuando se ejecuta con "npm start" (las pruebas importan este modulo)
if (require.main === module) {
  http.listen(port, function(){
    console.log('listening on *:' + port);
  });
}

module.exports = { app: app, http: http, io: io, port: port };
