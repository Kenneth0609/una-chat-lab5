'use strict';
// "harness doctor": comprueba que esten las herramientas que necesita el harness.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { cfg } = require('./config');
const { exec, which } = require('./proc');
const fofo = require('./fofo');
const { CLAUDE } = require('./agent');

async function doctor() {
  const filas = [];
  const ok = (n, v) => filas.push(['OK  ', n, v]);
  const no = (n, v) => filas.push(['FALTA', n, v]);

  const nodeMajor = parseInt(process.versions.node, 10);
  (nodeMajor >= 20 ? ok : no)('node', process.version);
  for (const [nombre, args] of [['git', ['--version']], ['npm', ['--version']], ['openspec', ['--version']]]) {
    const ruta = which(nombre);
    if (!ruta) { no(nombre, 'no esta en el PATH'); continue; }
    const r = await exec(ruta, args);
    (r.code === 0 ? ok : no)(nombre, (r.out || r.err).trim().split('\n')[0]);
  }
  const gh = which('gh');
  if (!gh) no('gh', 'no esta en el PATH');
  else {
    const r = await exec(gh, ['auth', 'status']);
    (r.code === 0 ? ok : no)('gh (GitHub CLI)', r.code === 0 ? 'autenticado' : 'ejecute: gh auth login');
  }
  const c = await exec(CLAUDE, ['auth', 'status']);
  let logged = false;
  try { logged = JSON.parse(c.out).loggedIn; } catch { /* sin json */ }
  (logged ? ok : no)('claude (agentes headless)', logged ? 'sesion iniciada' : 'ejecute: claude auth login');
  const py = await fofo.findPython();
  (py ? ok : no)('python 3 (gates de FoFo)', py || 'instale Python 3 o defina HARNESS_PYTHON');
  const pw = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.cache'), 'ms-playwright');
  (fs.existsSync(pw) ? ok : no)('navegadores de Playwright', fs.existsSync(pw) ? pw : 'ejecute: npx playwright install chromium');
  ok('repositorio', `${cfg.repo} (base: ${cfg.baseBranch})`);
  for (const f of filas) console.log(`${f[0]} ${f[1].padEnd(30)} ${f[2]}`);
  if (filas.some((f) => f[0] !== 'OK  ')) process.exitCode = 1;
}

module.exports = { doctor };
