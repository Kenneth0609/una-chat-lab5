// Pruebas de INTEGRACION de REQ-010: el servidor real (Express) sirve GET /validators.js con la
// regla de mensaje vacio/solo-espacios incluida (concatenada junto con las demas, segun
// harness/contracts/send-validator.md). En el navegador real cada archivo se ejecuta sin "module"
// definido, por lo que toma la rama `root.UNAChat.registerSendValidator(...)`; eso se reproduce
// aqui con un sandbox `vm` que ofrece un `self.UNAChat` de mentira y registra las reglas servidas.
//
// Ejecutar: npx jest tests/integration/req-010.test.js --runInBand --env=node
const request = require('supertest');
const vm = require('vm');
const { app, http, io } = require('../../server');

jest.setTimeout(15000);

const AVISO_ESPERADO = 'Escribe un mensaje antes de enviarlo.';

beforeAll(async () => {
  // importar server.js no debe abrir ningun puerto (solo "npm start" lo hace)
  expect(http.listening).toBe(false);
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
  await new Promise((resolve) => io.close(resolve));
});

// descarga GET /validators.js y lo ejecuta como lo haria el navegador: sin "module" global,
// con un "self.UNAChat.registerSendValidator" de mentira que recolecta cada regla registrada
async function cargarReglasRegistradas() {
  const res = await request(app).get('/validators.js');
  const reglas = [];
  const sandbox = {
    self: {
      UNAChat: {
        registerSendValidator: function (fn) { reglas.push(fn); }
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(res.text, sandbox, { filename: 'validators.js' });
  return reglas;
}

// corre todas las reglas registradas sobre un ctx y devuelve el primer resultado que falla (no null)
function primerRechazo(reglas, ctx) {
  for (const fn of reglas) {
    const resultado = fn(ctx);
    if (resultado) return resultado;
  }
  return null;
}

describe('REQ-010: integracion - GET /validators.js expone la regla de mensaje vacio', () => {

  test('REQ-010: GET /validators.js responde 200 con JavaScript', async () => {
    const res = await request(app).get('/validators.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });

  test('REQ-010: un mensaje completamente vacio es rechazado por alguna regla registrada, con el aviso esperado', async () => {
    const reglas = await cargarReglasRegistradas();
    const resultado = primerRechazo(reglas, { nombre: 'Ana', mensaje: '' });
    expect(resultado).toEqual({ campo: 'mensaje', texto: AVISO_ESPERADO, limpiar: true });
  });

  test.each([
    ['solo espacios', '   '],
    ['solo tabs', '\t\t\t'],
    ['mezcla de espacios y tabs', '\t \t']
  ])('REQ-010: un mensaje con %s es rechazado igual que uno vacio', async (_descripcion, mensaje) => {
    const reglas = await cargarReglasRegistradas();
    const resultado = primerRechazo(reglas, { nombre: 'Ana', mensaje });
    expect(resultado).toEqual({ campo: 'mensaje', texto: AVISO_ESPERADO, limpiar: true });
  });

  test('REQ-010: un mensaje con contenido real (con espacios alrededor) no es rechazado por ninguna regla', async () => {
    const reglas = await cargarReglasRegistradas();
    const resultado = primerRechazo(reglas, { nombre: 'Ana', mensaje: '  hola  ' });
    expect(resultado).toBeNull();
  });

});
