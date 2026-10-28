// Pruebas de INTEGRACION (paso 9): backend Node.js (Express + Socket.IO) + una-lib.
//
// - Supertest se usa para las rutas HTTP (GET /, archivos estaticos, cabeceras de seguridad).
// - Los mensajes del chat NO viajan por HTTP: se envian con el evento Socket.IO
//   'Evento-Mensaje-Server', asi que ese evento real se prueba con socket.io-client.
// - Se espia unalib.validateMessage para comprobar que el backend realmente la invoca.
//
// Ejecutar: npx jest tests/integration --runInBand --env=node

const request = require('supertest');
const { io: conectarCliente } = require('socket.io-client');
const unalib = require('../../libs/unalib');
const { app, http, io } = require('../../server');

const EVENTO = 'Evento-Mensaje-Server';
const IMAGEN = 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png';
const VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm';
const YOUTUBE = 'https://www.youtube.com/watch?v=qYwlqx-JLok';
const ETIQUETA_HTML = /<\s*\/?\s*[a-z!]/i;

jest.setTimeout(15000);

let urlServidor;
let clientes = [];

// abre una conexion Socket.IO real contra el servidor levantado por la prueba
function conectar() {
  return new Promise((resolve, reject) => {
    const socket = conectarCliente(urlServidor, { transports: ['websocket'], forceNew: true, reconnection: false });
    clientes.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

// espera el proximo mensaje que el servidor emita a este cliente
function esperarMensaje(socket) {
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(() => reject(new Error('El servidor no respondio a tiempo')), 5000);
    socket.once(EVENTO, (respuesta) => {
      clearTimeout(temporizador);
      resolve(respuesta);
    });
  });
}

// emite el evento real de envio y devuelve la respuesta cruda (string) del backend
async function enviar(socket, datos) {
  const respuesta = esperarMensaje(socket);
  socket.emit(EVENTO, typeof datos === 'string' ? datos : JSON.stringify(datos));
  return respuesta;
}

function mensaje(texto, extra) {
  return Object.assign({ nombre: 'Ana', mensaje: texto, color: '#336699' }, extra);
}

beforeAll(async () => {
  // importar server.js no debe abrir ningun puerto (solo "npm start" lo hace)
  expect(http.listening).toBe(false);
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  urlServidor = `http://127.0.0.1:${http.address().port}`;
});

afterEach(() => {
  clientes.forEach((c) => c.close());
  clientes = [];
  jest.restoreAllMocks();
});

afterAll(async () => {
  // cierra Socket.IO y el servidor HTTP que abrio la prueba
  await new Promise((resolve) => io.close(resolve));
});

describe('rutas HTTP (Supertest)', () => {

  test('GET / responde 200 con la pagina del chat', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('id="messages"');
    expect(res.text).toContain('id="nombre"');
    expect(res.text).toContain('<button>Send</button>');
  });

  test('la pagina no carga scripts de terceros ni tiene scripts en linea', async () => {
    const res = await request(app).get('/');
    const scripts = res.text.match(/<script[^>]*>/gi) || [];
    expect(scripts.length).toBeGreaterThan(0);
    scripts.forEach((etiqueta) => {
      expect(etiqueta).toMatch(/src="\/[^"]+"/); // solo scripts del mismo origen
    });
    expect(res.text).not.toMatch(/<script>[^<]/i);
  });

  test('envia cabeceras de seguridad (CSP y nosniff)', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['content-security-policy']).toContain("object-src 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('sirve el JavaScript y el CSS del chat', async () => {
    const js = await request(app).get('/chat.js');
    expect(js.status).toBe(200);
    expect(js.headers['content-type']).toMatch(/javascript/);
    const css = await request(app).get('/chat.css');
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toMatch(/css/);
  });

  test('sirve el cliente de Socket.IO sin depender de un CDN', async () => {
    // Socket.IO se adjunta al servidor HTTP (no a la app de Express): se prueba contra el servidor real
    const res = await request(urlServidor).get('/socket.io/socket.io.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });

  test('los mensajes no se reciben por HTTP: POST / responde 404', async () => {
    const res = await request(app).post('/').send(mensaje('hola'));
    expect(res.status).toBe(404);
  });

  test('una ruta inexistente responde 404', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
  });

});

describe('evento Socket.IO "Evento-Mensaje-Server" + una-lib', () => {

  test('el backend llama a validateMessage de una-lib y retransmite exactamente lo que devuelve', async () => {
    const espia = jest.spyOn(unalib, 'validateMessage');
    const socket = await conectar();
    const enviado = JSON.stringify(mensaje('hola mundo'));

    const respuesta = await enviar(socket, enviado);

    expect(espia).toHaveBeenCalledTimes(1);
    expect(espia).toHaveBeenCalledWith(enviado);
    expect(respuesta).toBe(espia.mock.results[0].value);
  });

  test('si una-lib devolviera otro contenido, ese es el que llega al cliente (el backend depende de ella)', async () => {
    const centinela = JSON.stringify({ nombre: 'una-lib', mensaje: 'respuesta de prueba', color: '#000000', tipo: 'texto' });
    jest.spyOn(unalib, 'validateMessage').mockReturnValueOnce(centinela);
    const socket = await conectar();

    const respuesta = await enviar(socket, mensaje('lo que sea'));

    expect(respuesta).toBe(centinela);
  });

  test('URL de imagen valida: el backend la acepta y la convierte en <img>', async () => {
    const socket = await conectar();
    const respuesta = JSON.parse(await enviar(socket, mensaje(IMAGEN)));

    expect(respuesta.tipo).toBe('imagen');
    expect(respuesta.nombre).toBe('Ana');
    expect(respuesta.color).toBe('#336699');
    expect(respuesta.mensaje).toMatch(/^<img src="https:\/\/upload\.wikimedia\.org\/[^"]+\.png"/);
    expect(respuesta.mensaje).not.toMatch(/\bon\w+\s*=/i);
  });

  test('URL de video valida (archivo): el backend la acepta y la convierte en <video controls>', async () => {
    const socket = await conectar();
    const respuesta = JSON.parse(await enviar(socket, mensaje(VIDEO)));

    expect(respuesta.tipo).toBe('video');
    expect(respuesta.mensaje).toMatch(/^<video src="https:\/\/interactive-examples\.mdn\.mozilla\.net\/[^"]+\.webm"/);
    expect(respuesta.mensaje).toContain('controls');
  });

  test('URL de video valida (YouTube): el backend la convierte en un reproductor incrustado', async () => {
    const socket = await conectar();
    const respuesta = JSON.parse(await enviar(socket, mensaje(YOUTUBE)));

    expect(respuesta.tipo).toBe('video');
    expect(respuesta.mensaje).toMatch(/^<iframe src="https:\/\/www\.youtube\.com\/embed\/qYwlqx-JLok"/);
  });

  test('script: la validacion lo rechaza y devuelve contenido saneado', async () => {
    const socket = await conectar();
    const respuesta = JSON.parse(await enviar(socket, mensaje("<script>alert('Inyección de script');</script>")));

    expect(respuesta.tipo).toBe('bloqueado');
    expect(respuesta.mensaje).not.toMatch(ETIQUETA_HTML);
    expect(respuesta.mensaje).not.toContain('alert');
  });

  test.each([
    ['un ejecutable', 'https://example.com/descarga/virus.exe'],
    ['un enlace javascript:', 'javascript:alert(document.cookie)'],
    ['una pagina web', 'https://example.com/index.html'],
    ['un video en formato no permitido', 'https://example.com/pelicula.avi'],
    ['una imagen que intenta salirse del atributo src', 'https://example.com/a.jpg" onerror="alert(1)'],
    ['una imagen data: URI', 'data:image/png;base64,iVBORw0KGgo=']
  ])('URL no permitida (%s): se muestra solo como texto escapado', async (_descripcion, url) => {
    const socket = await conectar();
    const respuesta = JSON.parse(await enviar(socket, mensaje(url)));

    expect(respuesta.tipo).toBe('texto');
    expect(respuesta.mensaje).not.toMatch(ETIQUETA_HTML);
    expect(respuesta.mensaje).not.toContain('"');
  });

  test.each([
    ['<img src=x onerror=alert(1)>'],
    ['<svg onload=alert(1)>'],
    ['<iframe src="javascript:alert(1)"></iframe>'],
    ['<ScRiPt>alert(1)</sCrIpT>']
  ])('otras inyecciones (%s) no llegan como HTML', async (carga) => {
    const socket = await conectar();
    const respuesta = JSON.parse(await enviar(socket, mensaje(carga)));

    expect(respuesta.mensaje).not.toMatch(ETIQUETA_HTML);
  });

  test('sanea el nombre y el color de usuario de punta a punta', async () => {
    const socket = await conectar();
    const respuesta = JSON.parse(await enviar(socket, {
      nombre: '<img src=x onerror=alert(1)>Eva',
      mensaje: 'hola',
      color: 'red;background:url(javascript:alert(1))'
    }));

    expect(respuesta.nombre).toBe('Eva');
    expect(respuesta.color).toBe('#000000');
  });

  test('un mensaje que no es JSON se trata como texto saneado', async () => {
    const socket = await conectar();
    const respuesta = JSON.parse(await enviar(socket, 'esto no es json <script>alert(1)</script>'));

    expect(respuesta.mensaje).not.toMatch(ETIQUETA_HTML);
    expect(respuesta.mensaje).toBe('esto no es json');
  });

  test('un payload que no es texto no tumba el servidor y se responde con un mensaje vacio', async () => {
    const socket = await conectar();
    const vacio = esperarMensaje(socket);
    socket.emit(EVENTO, { no: 'es un string' });
    expect(JSON.parse(await vacio).mensaje).toBe('');

    // el servidor sigue atendiendo mensajes normales
    const respuesta = JSON.parse(await enviar(socket, mensaje('sigo vivo')));
    expect(respuesta.mensaje).toBe('sigo vivo');
  });

  test('el mensaje saneado se retransmite a todos los clientes conectados', async () => {
    const emisor = await conectar();
    const receptor = await conectar();
    const recibido = esperarMensaje(receptor);

    const propio = await enviar(emisor, mensaje(IMAGEN));
    const ajeno = await recibido;

    expect(ajeno).toBe(propio);
    expect(JSON.parse(ajeno).tipo).toBe('imagen');
  });

});
