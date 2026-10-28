'use strict';
// Integracion coordinada: fusiona las ramas de varios requerimientos en una rama de integracion y vuelve a correr
// TODAS las pruebas (las de cada requerimiento + las existentes) para comprobar que funcionan juntos.
const fs = require('fs');
const path = require('path');
const { cfg } = require('./config');
const { exec, which } = require('./proc');
const git = require('./git');
const { Run } = require('./state');

const NPM = which('npm') || 'npm';
const RUN_SUITES = path.join(cfg.repo, 'harness', 'scripts', 'run-suites.js');

async function integrar(reqs, { pr = false } = {}) {
  const nombre = `integration/${reqs.join('+')}`;
  const dir = path.join(cfg.worktrees, 'INTEGRATION');
  const informe = path.join(cfg.stateRoot, 'integration');
  fs.mkdirSync(informe, { recursive: true });
  const L = [];
  const say = (m) => { L.push(m); console.log(`[integrate] ${m}`); };

  const ramas = [];
  for (const req of reqs) {
    const f = path.join(cfg.runsDir, req);
    const branch = Run.existe(f) ? new Run(f).load().data.branch : null;
    if (!branch) throw new Error(`No hay ejecucion del harness para ${req}`);
    ramas.push({ req, branch });
  }

  if (fs.existsSync(dir)) await git.git(cfg.repo, ['worktree', 'remove', '--force', dir], { allowFail: true });
  await git.git(cfg.repo, ['branch', '-D', nombre], { allowFail: true });
  await git.git(cfg.repo, ['worktree', 'add', '-b', nombre, dir, cfg.baseBranch]);
  say(`Rama de integracion ${nombre} creada desde ${cfg.baseBranch}.`);

  let ok = true;
  for (const { req, branch } of ramas) {
    const m = await git.git(dir, ['merge', '--no-ff', '-m', `Merge ${req} (${branch})`, branch], { allowFail: true });
    if (m.code !== 0) {
      const conflictos = (await git.gitOut(dir, ['diff', '--name-only', '--diff-filter=U'])).split('\n').filter(Boolean);
      say(`CONFLICTO al fusionar ${req}: ${conflictos.join(', ') || m.out.trim()}`);
      await git.git(dir, ['merge', '--abort'], { allowFail: true });
      ok = false;
      break;
    }
    say(`Fusionado ${req} sin conflictos.`);
  }

  let suites = null;
  if (ok) {
    say('Instalando dependencias y corriendo TODAS las suites juntas...');
    const ci = await exec(NPM, ['ci', '--no-audit', '--no-fund'], { cwd: dir, timeoutMs: 1000 * 60 * 10 });
    if (ci.code !== 0) { say('npm ci fallo'); ok = false; }
    else {
      const jsonFile = path.join(informe, `${reqs.join('+')}.suites.json`);
      const r = await exec(process.execPath, [RUN_SUITES, '--cwd', dir, '--json', jsonFile, '--log-dir', path.join(informe, reqs.join('+'))], { cwd: dir, env: { PORT: '4900' }, timeoutMs: 1000 * 60 * 20 });
      try { suites = JSON.parse(fs.readFileSync(jsonFile, 'utf8')); } catch { /* sin resumen */ }
      ok = r.code === 0;
      for (const s of (suites || { suites: [] }).suites) say(`${s.status === 'passed' ? 'OK  ' : 'FAIL'} ${s.titulo}: pasan ${s.passed}, fallan ${s.failed}`);
    }
  }
  say(ok ? 'INTEGRACION CORRECTA: los requerimientos funcionan juntos.' : 'INTEGRACION CON PROBLEMAS: revise el detalle.');
  fs.writeFileSync(path.join(informe, `${reqs.join('+')}.md`), `# Integracion ${reqs.join(' + ')}\n\n${L.map((l) => '- ' + l).join('\n')}\n`);

  if (ok && pr) {
    await git.git(dir, ['push', '-u', cfg.remote, nombre, '--force-with-lease']);
    const body = `Integración coordinada de ${reqs.join(', ')}.\n\n${L.map((l) => '- ' + l).join('\n')}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
    const r = await git.gh(dir, ['pr', 'create', '--base', cfg.baseBranch, '--head', nombre, '--title', `Integración: ${reqs.join(' + ')}`, '--body', body]);
    say(`PR de integracion: ${(r.out.match(/https:\/\/github\.com\/\S+/) || [])[0]}`);
  }
  return ok;
}

module.exports = { integrar };
