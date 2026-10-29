#!/usr/bin/env node
'use strict';
// Harness de desarrollo autonomo: OpenSpec (especificar) + FoFo (arbitro de pruebas) + Claude Code (agentes).
//
//   npm run harness -- run REQ-010            un requerimiento, de punta a punta, hasta el Pull Request
//   npm run harness -- run REQ-010 --text "REQ-013: titulo  Acceptance: ..."
//   npm run harness -- status                 estado de todas las ejecuciones
//   npm run harness -- integrate REQ-010 REQ-011 REQ-012
//   npm run harness -- doctor                 comprueba las herramientas necesarias
const fs = require('fs');
const path = require('path');
const { cfg, runDirOf } = require('../lib/config');
const { Run } = require('../lib/state');

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => args.includes(n);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

async function main() {
  if (cmd === 'run') {
    const req = args[1];
    if (!req || !/^REQ-\d+$/.test(req)) throw new Error('Uso: harness run REQ-NNN [--text "..."] [--restart] [--no-pr]');
    const { runPipeline } = require('../lib/pipeline');
    const r = await runPipeline({ req, text: valor('--text'), restart: flag('--restart'), noPr: flag('--no-pr') });
    process.exit(r.status === 'done' && r.outcome === 'ready' ? 0 : r.outcome === 'blocked' ? 3 : 1);
  } else if (cmd === 'status') {
    if (!fs.existsSync(cfg.runsDir)) return console.log('Sin ejecuciones.');
    for (const d of fs.readdirSync(cfg.runsDir)) {
      const s = new Run(path.join(cfg.runsDir, d)).load().data;
      const fases = Object.entries(s.phases).map(([k, f]) => `${k}:${f.status}`).join(' ');
      console.log(`${s.req.padEnd(8)} ${String(s.status).padEnd(8)} ${String(s.outcome || '-').padEnd(8)} puerto=${s.port} costo=$${s.costUsd.toFixed(2)} ${s.pr ? s.pr.url : ''}\n         ${fases}`);
    }
  } else if (cmd === 'integrate') {
    const { integrar } = require('../lib/integrate');
    const reqs = args.slice(1).filter((a) => /^REQ-\d+$/.test(a));
    if (!reqs.length) throw new Error('Uso: harness integrate REQ-010 REQ-011 ...');
    const ok = await integrar(reqs, { pr: flag('--pr') });
    process.exit(ok ? 0 : 1);
  } else if (cmd === 'doctor') {
    await require('../lib/doctor').doctor();
  } else {
    console.log('Comandos: run REQ-NNN | status | integrate REQ-A REQ-B ... | doctor');
  }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(2); });
