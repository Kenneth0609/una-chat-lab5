// Pruebas de INTEGRACION REQ-012 (mensajes cortos): el servidor real sirve GET /validators.js con las
// reglas de envio de public/validators/*.js (contrato: harness/contracts/send-validator.md). Esta prueba
// evalua ese archivo en un sandbox `vm` con un UNAChat de mentira que registra cada regla, exactamente
// como lo haria public/chat.js en el navegador antes de emitir el mensaje por Socket.IO.
//
// Por diseno (design.md de REQ-012), no hay validacion de longitud en el servidor: la regla vive solo en
// public/validators/message-length.js y se sirve via /validators.js, asi que esta es la capa correcta
// para probar la integracion servidor + regla.
//
// Ejecutar: npx jest tests/integration/req-012.test.js --runInBand --env=node

const request = require('supertest');
const vm = require('vm');
const { app, http, io } = require('../../server');

jest.setTimeout(15000);

beforeAll(async () => {
  expect(http.listening).toBe(false);
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
  await new Promise((resolve) => io.close(resolve));
});

// Descarga /validators.js del servidor real y lo ejecuta en un sandbox que imita el navegador:
// un UNAChat falso cuyo registerSendValidator va guardando cada regla registrada.
async function cargarReglasDeEnvio() {
  const res = await request(app).get('/validators.js');
  expect(res.status).toBe(200);

  const reglas = [];
  const sandbox = {
    module: undefined,
    UNAChat: { registerSendValidator: (fn) => reglas.push(fn) },
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(res.text, sandbox, { filename: 'validators.js' });
  return reglas;
}

// corre las reglas registradas como lo hace el chat real al pulsar Send: gana el primer rechazo
function primerRechazo(reglas, ctx) {
  for (const regla of reglas) {
    const resultado = regla(ctx);
    if (resultado) return resultado;
  }
  return null;
}

describe('REQ-012: messages stay short (integracion, GET /validators.js)', () => {

  test('REQ-012: un mensaje de 281 caracteres es rechazado por alguna regla registrada (no se emitiria)', async () => {
    const reglas = await cargarReglasDeEnvio();
    const resultado = primerRechazo(reglas, { nombre: 'Ana', mensaje: 'a'.repeat(281) });

    expect(resultado).not.toBeNull();
    expect(resultado.campo).toBe('mensaje');
    expect(resultado.limpiar).toBe(false);
    expect(resultado.texto).toMatch(/demasiado largo/i);
  });

  test('REQ-012: un mensaje de exactamente 280 caracteres no es rechazado por ninguna regla', async () => {
    const reglas = await cargarReglasDeEnvio();
    const resultado = primerRechazo(reglas, { nombre: 'Ana', mensaje: 'a'.repeat(280) });

    expect(resultado).toBeNull();
  });

  test('REQ-012: un mensaje de 281 espacios tambien es rechazado (no se recorta antes de contar)', async () => {
    const reglas = await cargarReglasDeEnvio();
    const resultado = primerRechazo(reglas, { nombre: 'Ana', mensaje: ' '.repeat(281) });

    expect(resultado).not.toBeNull();
    expect(resultado.campo).toBe('mensaje');
  });

});
