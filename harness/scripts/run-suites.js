#!/usr/bin/env node
// Ejecuta las cuatro suites de pruebas del chat, una tras otra y SIN detenerse en la primera que falla:
//   unit (Mocha) -> integration (Jest) -> bdd (Cucumber) -> e2e (Playwright)
// Uso:
//   node harness/scripts/run-suites.js [--only unit,bdd] [--json salida.json] [--log-dir carpeta] [--cwd carpeta]
// Variables: PORT (puerto del chat para bdd y e2e; por defecto 3000).
// Codigo de salida: 0 si todas pasan, 1 si alguna falla.
// Es el "test_command" de FoFo (redgreen-gate) y el verificador del harness.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (nombre, defecto) => {
  const i = args.indexOf(nombre);
  return i >= 0 && args[i + 1] ? args[i + 1] : defecto;
};
const cwd = path.resolve(opt('--cwd', process.cwd()));
const only = opt('--only', 'unit,integration,bdd,e2e').split(',').map((s) => s.trim()).filter(Boolean);
const jsonOut = opt('--json', null);
const logDir = opt('--log-dir', null);
const bail = args.includes('--bail');

const bin = (ruta) => path.join(cwd, 'node_modules', ...ruta.split('/'));

const SUITES = {
  unit: { titulo: 'Unitarias (Mocha)', cmd: () => [process.execPath, [bin('mocha/bin/mocha.js')]] },
  integration: {
    titulo: 'Integracion (Jest + Supertest)',
    cmd: () => [process.execPath, [bin('jest/bin/jest.js'), 'tests/integration', '--runInBand', '--env=node']],
  },
  bdd: { titulo: 'BDD (Cucumber + Playwright)', cmd: () => [process.execPath, [bin('@cucumber/cucumber/bin/cucumber.js')]] },
  e2e: {
    titulo: 'End-to-end (Playwright)',
    cmd: () => [process.execPath, [bin('@playwright/test/cli.js'), 'test', '--project=chromium']],
  },
};

const sinColor = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');

// Cuenta pasadas/falladas leyendo el resumen de cada herramienta
function contar(suite, texto) {
  const t = sinColor(texto);
  const num = (re) => { const m = t.match(re); return m ? parseInt(m[1], 10) : 0; };
  if (suite === 'unit') return { passed: num(/(\d+) passing/), failed: num(/(\d+) failing/) };
  if (suite === 'integration') return { passed: num(/Tests:.*?(\d+) passed/), failed: num(/Tests:.*?(\d+) failed/) };
  if (suite === 'bdd') return { passed: num(/scenarios? \([^)]*?(\d+) passed/), failed: num(/scenarios? \([^)]*?(\d+) failed/) + num(/scenarios? \([^)]*?(\d+) undefined/) };
  return { passed: num(/(\d+) passed/), failed: num(/(\d+) failed/) };
}

// Distingue "fallo de una asercion" (rojo por la razon correcta) de "la prueba ni siquiera corre"
function causa(texto) {
  // "Cannot find module .../public/validators/..." es el rojo ESPERADO de una prueba unitaria escrita antes del codigo
  const t = sinColor(texto).replace(/Cannot find module '[^']*(?:public|libs)[\/][^']*'/g, 'MODULO-AUN-SIN-IMPLEMENTAR');
  if (/SyntaxError|Cannot find module|ReferenceError|ERR_MODULE_NOT_FOUND|Undefined. Implement|Multiple step definitions match|Ambiguous/i.test(t)) {
    return 'infraestructura';
  }
  return 'asercion';
}

function correr(nombre) {
  const suite = SUITES[nombre];
  return new Promise((resolve) => {
    const [cmd, cmdArgs] = suite.cmd();
    const env = Object.assign({}, process.env, { FORCE_COLOR: '0', CI: '' });
    delete env.NO_COLOR;
    const inicio = Date.now();
    console.log(`\n=== ${suite.titulo} ===`);
    const hijo = spawn(cmd, cmdArgs, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = '';
    const alimentar = (chunk) => { const s = chunk.toString(); salida += s; process.stdout.write(s); };
    hijo.stdout.on('data', alimentar);
    hijo.stderr.on('data', alimentar);
    hijo.on('error', (e) => { salida += String(e); resolve({ suite: nombre, status: 'failed', exitCode: 99, passed: 0, failed: 0, causa: 'infraestructura', durationMs: 0 }); });
    hijo.on('close', (code) => {
      const r = Object.assign(
        { suite: nombre, titulo: suite.titulo, status: code === 0 ? 'passed' : 'failed', exitCode: code, durationMs: Date.now() - inicio },
        contar(nombre, salida)
      );
      if (code !== 0) r.causa = causa(salida);
      if (logDir) {
        fs.mkdirSync(logDir, { recursive: true });
        r.log = path.join(logDir, `${nombre}.log`);
        fs.writeFileSync(r.log, sinColor(salida));
      }
      resolve(r);
    });
  });
}

(async () => {
  const resultados = [];
  for (const nombre of only) {
    if (!SUITES[nombre]) { console.error(`Suite desconocida: ${nombre}`); process.exit(2); }
    const r = await correr(nombre);
    resultados.push(r);
    if (bail && r.status === 'failed') break;
  }
  console.log('\n=== RESUMEN ===');
  for (const r of resultados) {
    const marca = r.status === 'passed' ? 'OK  ' : 'FAIL';
    console.log(`${marca} ${r.titulo.padEnd(32)} pasan=${r.passed} fallan=${r.failed} (${(r.durationMs / 1000).toFixed(1)}s)${r.causa ? ' causa=' + r.causa : ''}`);
  }
  const ok = resultados.every((r) => r.status === 'passed');
  if (jsonOut) {
    fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify({ ok, suites: resultados }, null, 2));
  }
  process.exit(ok ? 0 : 1);
})();
