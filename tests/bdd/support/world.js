// Ciclo de vida de los escenarios BDD: levanta el chat (si no hay uno activo), abre Chromium y
// entrega a cada escenario una pagina limpia. No contiene reglas de ningun requerimiento.
const { setWorldConstructor, setDefaultTimeout, BeforeAll, AfterAll, Before, After, Status } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

setDefaultTimeout(30 * 1000);

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BDD_BASE_URL || `http://localhost:${PORT}`;
let servidor = null;
let navegador = null;

function responde(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function esperar(url, ms) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (await responde(url)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`El chat no respondio en ${url}`);
}

class ChatWorld {
  constructor() {
    this.baseURL = BASE_URL;
    this.page = null;
    this.context = null;
  }
  get campoNombre() { return this.page.getByRole('textbox', { name: 'Username' }); }
  get campoMensaje() { return this.page.getByRole('textbox', { name: 'Escriba un mensaje' }); }
  get botonEnviar() { return this.page.getByRole('button', { name: 'Send' }); }
  get conversacion() { return this.page.locator('#messages li'); }
  get aviso() { return this.page.getByRole('alert'); }
}

setWorldConstructor(ChatWorld);

BeforeAll(async function () {
  if (!process.env.BDD_BASE_URL && !(await responde(BASE_URL))) {
    servidor = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..', '..', '..'),
      env: Object.assign({}, process.env, { PORT: String(PORT) }),
      stdio: 'ignore',
    });
    await esperar(BASE_URL, 20 * 1000);
  }
  navegador = await chromium.launch({ headless: process.env.HEADED ? false : true });
});

AfterAll(async function () {
  if (navegador) await navegador.close();
  if (servidor) servidor.kill();
});

Before(async function () {
  this.context = await navegador.newContext();
  this.page = await this.context.newPage();
});

After(async function (escenario) {
  if (escenario.result && escenario.result.status === Status.FAILED && this.page) {
    const png = await this.page.screenshot();
    this.attach(png, 'image/png');
  }
  if (this.context) await this.context.close();
});
