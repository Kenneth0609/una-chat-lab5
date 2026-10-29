// Pruebas de INTEGRACION de REQ-011 (Messages need a name).
//
// design.md (Non-Goals) deja explicito que REQ-011 no agrega revalidacion en el servidor: la
// regla vive solo en public/validators/nombre-obligatorio.js y la garantia de "no se emite" la
// da el mecanismo de reglas de envio del propio cliente (harness/contracts/send-validator.md).
// Por eso la integracion real y verificable aqui es que el backend SIRVE esa regla en
// GET /validators.js (tal como hace con las demas, vease tests/integration/chat.test.js) y que,
// al ejecutarla en un sandbox vm con un UNAChat de mentira (igual que lo haria public/chat.js en
// el navegador), produce el resultado exigido por la especificacion para cada escenario.
//
// Ejecutar: npx jest tests/integration/req-011.test.js --runInBand --env=node
const request = require('supertest');
const vm = require('vm');
const { app, http, io } = require('../../server');

const AVISO_ESPERADO = 'Escriba un nombre para enviar el mensaje.';

// Ejecuta el contenido real de GET /validators.js en un sandbox, con un UNAChat de mentira
// que solo registra las funciones validate() que le pasen las reglas (igual que hace
// root.UNAChat.registerSendValidator en el navegador).
function cargarReglas(codigoFuente) {
  const reglas = [];
  const sandbox = {
    self: {
      UNAChat: {
        registerSendValidator: function (fn) { reglas.push(fn); }
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(codigoFuente, sandbox, { filename: 'validators.js' });
  return reglas;
}

// Corre todas las reglas registradas, en orden, y devuelve el primer fallo (o null si ninguna falla),
// replicando como public/chat.js aplica el resultado de una regla al pulsar Send.
function evaluarEnvio(reglas, ctx) {
  for (const regla of reglas) {
    const resultado = regla(ctx);
    if (resultado) return resultado;
  }
  return null;
}

beforeAll(async () => {
  // importar server.js no debe abrir ningun puerto (solo "npm start" lo hace)
  expect(http.listening).toBe(false);
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
  await new Promise((resolve) => io.close(resolve));
});

describe('REQ-011: GET /validators.js sirve la regla de nombre obligatorio', () => {
  let reglas;

  beforeAll(async () => {
    const res = await request(app).get('/validators.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    reglas = cargarReglas(res.text);
  });

  test('REQ-011: username vacio + mensaje real -> alguna regla registrada rechaza con el aviso de escribir un nombre', () => {
    const resultado = evaluarEnvio(reglas, { nombre: '', mensaje: 'Hola a todos' });
    expect(resultado).not.toBeNull();
    expect(resultado.campo).toBe('nombre');
    expect(resultado.texto).toBe(AVISO_ESPERADO);
    expect(resultado.limpiar).toBe(true);
  });

  test('REQ-011: username solo con espacios + mensaje real -> se rechaza con el mismo aviso', () => {
    const resultado = evaluarEnvio(reglas, { nombre: '   ', mensaje: 'Hola a todos' });
    expect(resultado).not.toBeNull();
    expect(resultado.campo).toBe('nombre');
    expect(resultado.texto).toBe(AVISO_ESPERADO);
    expect(resultado.limpiar).toBe(true);
  });

  test('REQ-011: username solo con tabs y saltos de linea + mensaje real -> se rechaza con el mismo aviso', () => {
    const resultado = evaluarEnvio(reglas, { nombre: '\t\n\t\n', mensaje: 'Hola a todos' });
    expect(resultado).not.toBeNull();
    expect(resultado.campo).toBe('nombre');
    expect(resultado.texto).toBe(AVISO_ESPERADO);
    expect(resultado.limpiar).toBe(true);
  });

  test('REQ-011: username con texto real rodeado de espacios -> ninguna regla registrada lo rechaza', () => {
    const resultado = evaluarEnvio(reglas, { nombre: '  Ana  ', mensaje: 'Hola a todos' });
    expect(resultado).toBeNull();
  });

  test('REQ-011: username y mensaje vacios -> ninguna regla produce el aviso de "escriba un nombre"', () => {
    const resultado = evaluarEnvio(reglas, { nombre: '', mensaje: '' });
    expect(resultado === null || resultado.texto !== AVISO_ESPERADO).toBe(true);
  });
});
