'use strict';
// Integracion con FoFo (Agentic-SDLC): el arbitro que revisa si las pruebas sirven y si el codigo las pasa.
// Los gates de FoFo son scripts (Python / Node) con codigo de salida real: 0 pasa, 1 falla, 2 escala, 3 omite.
// FoFo se clona una vez en .harness/vendor/ (fijado a un commit) y se ejecuta desde ahi.
const fs = require('fs');
const path = require('path');
const { cfg } = require('./config');
const { exec, which, conBloqueo } = require('./proc');
const { git } = require('./git');

// Rojo 'por la razon equivocada' (error de carga en vez de comportamiento que falta). Un modulo que aun no existe en
// public/ o libs/ NO cuenta: ese es justamente el rojo esperado de una prueba escrita antes del codigo.
const ROJO_EQUIVOCADO = [String.raw`SyntaxError`, String.raw`ImportError`, String.raw`ModuleNotFoundError`, String.raw`Cannot find module '(?![^']*(?:public|libs)[/\\])`, String.raw`No tests? (ran|found|collected)`, String.raw`collected 0 items`, String.raw`command not found`, String.raw`ReferenceError`, String.raw`Undefined\. Implement with the following snippet`, String.raw`Multiple step definitions match`];

const SCRIPTS_REL = path.join('plugins', 'fofo', 'skills', 'sdlc', 'scripts');
const fofoDir = () => path.join(cfg.vendorDir, 'agentic-sdlc');
const scriptsDir = () => path.join(fofoDir(), SCRIPTS_REL);

// Python 3 real (el "python" de WindowsApps es solo un acceso directo a la Microsoft Store)
async function findPython() {
  const candidatos = [process.env.HARNESS_PYTHON, 'python3', 'python', 'py'].filter(Boolean);
  for (const c of candidatos) {
    const ruta = fs.existsSync(c) ? c : which(c);
    if (!ruta || /WindowsApps/i.test(ruta)) continue;
    const r = await exec(ruta, c === 'py' ? ['-3', '--version'] : ['--version']);
    if (r.code === 0 && /Python 3/.test(r.out + r.err)) return ruta;
  }
  return null;
}

async function setup(log = () => {}) {
  await conBloqueo(cfg.locksDir, 'fofo-setup', async () => {
    if (!fs.existsSync(path.join(scriptsDir(), 'gate-runner'))) {
      log('FoFo: clonando Agentic-SDLC (una sola vez)...');
      fs.mkdirSync(cfg.vendorDir, { recursive: true });
      await git(cfg.vendorDir, ['clone', '-q', cfg.fofoRepo, 'agentic-sdlc']);
      await git(fofoDir(), ['checkout', '-q', cfg.fofoCommit]);
    }
  });
  const python = await findPython();
  if (!python) throw new Error('FoFo necesita Python 3. Instale Python 3 o defina HARNESS_PYTHON con la ruta de python.exe');
  return { python, scripts: scriptsDir() };
}

// Genera gates.config y policy.json PROPIOS de la ejecucion (fuera del worktree, para que el Autor
// no pueda editar a su propio arbitro). Las rutas del contrato viven dentro de evidencias/<REQ>/.
function escribirConfig(runDir, wt, req, opciones) {
  const dir = path.join(runDir, 'fofo');
  fs.mkdirSync(dir, { recursive: true });
  const ev = `evidencias/${req}`;
  const policy = {
    gates: {
      'spec-lint': { spec_file: `${ev}/REQUIREMENTS.md`, id_pattern: 'REQ-\\d+', acceptance_label: 'Acceptance', accept_ears: true },
      'trace-gate': { spec_file: `${ev}/REQUIREMENTS.md`, id_pattern: 'REQ-\\d+', test_reqs: `${ev}/TEST-REQS.yaml`, test_glob: ['test/**/*', 'tests/**/*'] },
      'redgreen-gate': { test_command: opciones.testCommand, timeout_seconds: 900, red_for_reason: ROJO_EQUIVOCADO },
      'intent-gate': { test_launchers: ['it', 'test', 'specify', 'Given', 'When', 'Then'], assertion_roots: ['should'], banned_mocks: [], allow_snapshot_only: false, fail_on: ['assertion-free', 'trivial'] },
      'secret-scan': { min_token_length: 16, allowlist: [], fail_on: ['high'] },
      'separation-gate': { manifest: `${ev}/PROVENANCE.yaml` },
      'test-lock': { lock_file: `${ev}/TEST-LOCK.json`, test_glob: ['test/**/*', 'tests/**/*'] },
      'oversight-integrity': {
        protected: null,
        extra_protected: ['harness/**', 'cucumber.js', 'playwright.config.js', 'openspec/config.yaml', `${ev}/TEST-LOCK.json`, `${ev}/PROVENANCE.yaml`, `${ev}/REQUIREMENTS.md`, `${ev}/TEST-REQS.yaml`],
        base_ref: opciones.baseRef || 'HEAD',
        on_touch: 'fail',
      },
      'deps-gate': { manifests: null, base_ref: opciones.baseRef || 'HEAD', on_new: 'escalate' },
      'diff-budget': { max_lines: 700, base_ref: opciones.baseRef || 'HEAD', count_mode: 'auto', on_exceed: 'escalate' },
    },
  };
  const gate = (name, enabled, extra = {}) => Object.assign({ name, tier: 0, enabled, script: name }, extra);
  const config = {
    policy: path.join(dir, 'policy.json'),
    fail_fast: false,
    gates: [
      gate('spec-lint', true), gate('trace-gate', true), gate('redgreen-gate', true), gate('intent-gate', true),
      gate('secret-scan', true), gate('test-lock', true), gate('oversight-integrity', true, { waivable: true }),
      gate('deps-gate', true), gate('separation-gate', true), gate('diff-budget', true, { waivable: true }),
      gate('flake-gate', false), gate('eval-gate', false),
    ],
  };
  fs.writeFileSync(path.join(dir, 'policy.json'), JSON.stringify(policy, null, 2));
  fs.writeFileSync(path.join(dir, 'gates.config'), JSON.stringify(config, null, 2));
  return { dir, policy: path.join(dir, 'policy.json'), config: path.join(dir, 'gates.config') };
}

// Ejecuta un gate suelto: node para intent-gate, python para el resto
async function runGate(env, nombre, args, wt, opts = {}) {
  const script = path.join(env.scripts, nombre);
  const cmd = nombre === 'intent-gate' ? process.execPath : env.python;
  const r = await exec(cmd, [script, ...args], { cwd: wt, timeoutMs: opts.timeoutMs || 1000 * 60 * 20, env: { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', ...(opts.env || {}) } });
  let verdict = null;
  try { verdict = JSON.parse(r.out.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).pop() || r.out); } catch { /* sin json */ }
  return { code: r.code, verdict, out: r.out, err: r.err };
}

// gate-runner agregado (Fase 4). Devuelve el JSON agregado: overall_status, gates[], escalation[]
async function runRunner(env, cfgFiles, changed, wt, opts = {}) {
  const r = await exec(env.python, [path.join(env.scripts, 'gate-runner'), '--config', cfgFiles.config, '--changed', changed, '--context', wt], {
    cwd: wt, timeoutMs: 1000 * 60 * 25, env: { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', ...(opts.env || {}) },
  });
  let report = null;
  try { report = JSON.parse(r.out); } catch { /* ver abajo */ }
  return { code: r.code, report, out: r.out, err: r.err };
}

module.exports = { setup, escribirConfig, runGate, runRunner, findPython, scriptsDir };
