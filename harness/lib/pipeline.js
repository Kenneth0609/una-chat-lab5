'use strict';
// Orquestador: un requerimiento -> especificacion (OpenSpec) -> pruebas del Juez en rojo -> implementacion del Autor
// -> verificacion FoFo -> revision -> archivo del cambio -> Pull Request con evidencia.
// Cada fase guarda su estado en .harness/runs/<REQ>/state.json, asi una ejecucion cortada se reanuda donde quedo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cfg, runDirOf, worktreeOf, slug, loadRequirement, allocatePort } = require('./config');
const { Run } = require('./state');
const { exec, which } = require('./proc');
const git = require('./git');
const fofo = require('./fofo');
const prompts = require('./prompts');
const { runAgent } = require('./agent');
const report = require('./report');

class Blocked extends Error {}   // requiere una decision humana (dudas de negocio, integridad, dependencias nuevas)
class Failure extends Error {}   // los reintentos controlados se agotaron

const NPM = which('npm') || 'npm';
const OPENSPEC = which('openspec') || 'openspec';
const RUN_SUITES = path.join(cfg.repo, 'harness', 'scripts', 'run-suites.js');
const CHANGED_ALL = 'public/**/* libs/**/* server.js index.html test/**/* tests/**/*';
const CHANGED_TESTS = 'test/**/* tests/**/*';

const tail = (txt, n = 60) => String(txt).split(/\r?\n/).slice(-n).join('\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------------------------------
function crearContexto(run, info) {
  const d = run.data;
  const ctx = {
    run, info, req: d.req, branch: d.branch, wt: d.worktree, runDir: run.dir, port: d.port,
    change: d.change, ev: `evidencias/${d.req}`, evAbs: path.join(d.worktree, 'evidencias', d.req),
    logDir: path.join(run.dir, 'agents'),
    say: (m) => { const l = run.log(m); console.log(`[${d.req}] ${m}`); return l; },
  };
  return ctx;
}

async function llamarAgente(ctx, rol, extra = {}) {
  const { run } = ctx;
  const intento = extra.resume ? 'continuacion' : 'inicial';
  ctx.say(`Agente ${rol.role} (${intento})...`);
  const r = await runAgent({
    role: rol.role, cwd: ctx.wt, prompt: rol.task, systemPrompt: rol.system, allowed: rol.allowed, denied: rol.denied,
    logDir: ctx.logDir, resume: extra.resume, sessionId: extra.sessionId, env: { PORT: String(ctx.port) },
  });
  run.addCost(r.costUsd);
  const lista = run.data.sessions[rol.role] || (run.data.sessions[rol.role] = []);
  if (!lista.includes(r.sessionId)) lista.push(r.sessionId);
  run.save();
  ctx.say(`Agente ${rol.role}: ${r.ok ? 'ok' : 'CON PROBLEMAS'} (${r.turns} turnos, $${r.costUsd.toFixed(2)}, ${(r.durationMs / 1000).toFixed(0)}s, ${r.denials.length} acciones denegadas)`);
  if (r.denials.length) run.data.denials = (run.data.denials || []).concat(r.denials.map((x) => `${rol.role}: ${x.tool_name} ${(x.tool_input && (x.tool_input.file_path || x.tool_input.command)) || ''}`.trim()));
  if (!r.ok && !r.text) throw new Failure(`El agente ${rol.role} no respondio (${r.timedOut ? 'tiempo agotado' : 'error'})`);
  return r;
}

// Corre las cuatro suites en el worktree (puerto propio) y devuelve el JSON del resumen
async function correrSuites(ctx, { only, logSubdir } = {}) {
  const logDir = logSubdir ? path.join(ctx.evAbs, logSubdir) : path.join(ctx.runDir, 'suites');
  fs.rmSync(logDir, { recursive: true, force: true });
  const jsonFile = path.join(logDir, 'suites.json');
  const args = [RUN_SUITES, '--cwd', ctx.wt, '--json', jsonFile, '--log-dir', logDir];
  if (only) args.push('--only', only);
  fs.mkdirSync(logDir, { recursive: true });
  const r = await exec(process.execPath, args, { cwd: ctx.wt, env: { PORT: String(ctx.port) }, timeoutMs: 1000 * 60 * 20 });
  let data = null;
  try { data = JSON.parse(fs.readFileSync(jsonFile, 'utf8')); } catch { /* sin resumen */ }
  if (!data) throw new Failure('run-suites no produjo resumen: ' + tail(r.out + r.err, 20));
  fs.writeFileSync(path.join(logDir, 'resumen.txt'), r.out.split('=== RESUMEN ===')[1] ? '=== RESUMEN ===' + r.out.split('=== RESUMEN ===')[1] : r.out);
  return data;
}

const resumenSuites = (data) => data.suites.map((s) => `- ${s.titulo}: ${s.status === 'passed' ? 'pasa' : 'FALLA'} (pasan ${s.passed}, fallan ${s.failed}${s.causa ? ', causa: ' + s.causa : ''})`).join('\n');

function logsFallidos(ctx, data, subdir) {
  return data.suites.filter((s) => s.status === 'failed').map((s) => {
    let texto = '';
    try { texto = fs.readFileSync(path.join(ctx.evAbs, subdir, s.suite + '.log'), 'utf8'); } catch { /* sin log */ }
    return `### ${s.titulo}\n\`\`\`\n${tail(texto, 45)}\n\`\`\``;
  }).join('\n\n');
}

// ---------------------------------------------------------------------------------------------------------------------
async function faseSetup(ctx) {
  const { run, wt } = ctx;
  const { creado } = await git.crearWorktree(ctx.req, ctx.branch, wt);
  ctx.say(creado ? `Worktree creado: ${wt} (rama ${ctx.branch}, puerto ${ctx.port})` : `Worktree existente: ${wt}`);
  if (!fs.existsSync(path.join(wt, 'node_modules'))) {
    ctx.say('npm ci en el worktree (dependencias propias, sin compartir node_modules)...');
    const r = await exec(NPM, ['ci', '--no-audit', '--no-fund'], { cwd: wt, logFile: path.join(ctx.runDir, 'npm-ci.log'), timeoutMs: 1000 * 60 * 10 });
    if (r.code !== 0) throw new Failure('npm ci fallo: ' + tail(r.err || r.out, 15));
  }
  fs.mkdirSync(ctx.evAbs, { recursive: true });
  fs.writeFileSync(path.join(ctx.evAbs, '00-requerimiento.md'), `# ${ctx.req}: ${ctx.info.title}\n\n${ctx.info.raw}\n`);
  fs.writeFileSync(path.join(ctx.evAbs, 'REQUIREMENTS.md'), `# Requirements\n\n### ${ctx.req}: ${ctx.info.title}\nAcceptance: ${ctx.info.acceptance}\n`);
  const env = await fofo.setup(ctx.say);
  ctx.fofo = env;
  ctx.fofoCfg = fofo.escribirConfig(ctx.runDir, wt, ctx.req, { testCommand: `node "${RUN_SUITES}" --cwd "${wt}"`, baseRef: 'HEAD' });
  const sano = await exec(process.execPath, [RUN_SUITES, '--cwd', wt, '--only', 'unit'], { cwd: wt, env: { PORT: String(ctx.port) } });
  if (sano.code !== 0) throw new Failure('La base (main) no esta en verde en el worktree: ' + tail(sano.out, 15));
  ctx.say('Base verificada (pruebas unitarias existentes en verde).');
}

// ---------------------------------------------------------------------------------------------------------------------
async function faseSpec(ctx) {
  const { run, wt } = ctx;
  const changeDir = path.join(wt, 'openspec', 'changes', ctx.change);
  let retro = null;
  let resume = null;
  for (let intento = 1; intento <= cfg.maxSpecAttempts; intento++) {
    run.bump('spec');
    const rol = prompts.spec(ctx);
    if (retro) rol.task = `# Continuacion: la especificacion tiene problemas\n\n${retro}\n\nCorrigelos y responde con el mismo bloque JSON.`;
    const r = await llamarAgente(ctx, rol, { resume });
    resume = r.sessionId;
    // comprobaciones del Operador (arbitro): estructura + openspec validate --strict + preguntas
    const faltan = ['proposal.md', 'design.md', 'tasks.md'].filter((f) => !fs.existsSync(path.join(changeDir, f)));
    const specs = fs.existsSync(path.join(changeDir, 'specs')) ? listar(path.join(changeDir, 'specs')).filter((f) => f.endsWith('spec.md')) : [];
    const v = fs.existsSync(changeDir) ? await exec(OPENSPEC, ['validate', ctx.change, '--strict'], { cwd: wt }) : { code: 1, out: '', err: 'no existe el cambio' };
    let preguntas = null;
    let errPreg = null;
    try { preguntas = JSON.parse(fs.readFileSync(path.join(ctx.evAbs, 'preguntas.json'), 'utf8')); if (!Array.isArray(preguntas)) throw new Error('debe ser un arreglo'); } catch (e) { errPreg = e.message; }
    const problemas = [];
    if (faltan.length) problemas.push(`Faltan artefactos: ${faltan.join(', ')}`);
    if (!specs.length) problemas.push('No hay specs/<capability>/spec.md');
    if (v.code !== 0) problemas.push('openspec validate --strict fallo:\n' + tail(v.out + v.err, 25));
    if (errPreg) problemas.push(`evidencias/${ctx.req}/preguntas.json invalido: ${errPreg}`);
    if (!problemas.length) {
      const lint = await fofo.runGate(ctx.fofo, 'spec-lint', ['--policy', ctx.fofoCfg.policy, '--context', wt], wt);
      if (lint.code !== 0) { problemas.push('FoFo spec-lint: ' + JSON.stringify(lint.verdict || lint.out).slice(0, 400)); }
    }
    if (!problemas.length) {
      run.data.capabilities = specs.map((f) => path.basename(path.dirname(f)));
      run.data.questions = preguntas.map((q, i) => ({ id: q.id || `Q${i + 1}`, ...q }));
      run.data.blocking = run.data.questions.some((q) => q.bloqueante === true);
      run.save();
      await git.commitTodo(wt, `spec(${ctx.req}): cambio de OpenSpec ${ctx.change}`);
      ctx.say(`Especificacion lista: capability(s) ${run.data.capabilities.join(', ')}; ${run.data.questions.length} duda(s) para negocio${run.data.blocking ? ' (BLOQUEANTE)' : ''}.`);
      if (run.data.blocking) throw new Blocked('Hay dudas bloqueantes: el comportamiento correcto no se puede determinar sin una decision de negocio.');
      return;
    }
    retro = problemas.join('\n\n');
    ctx.say(`La especificacion no paso las comprobaciones (intento ${intento}/${cfg.maxSpecAttempts}): ${problemas[0].split('\n')[0]}`);
  }
  throw new Failure('No se obtuvo una especificacion valida de OpenSpec.');
}

function listar(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listar(p)); else out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
function archivosDelJuez(ctx) {
  const r = ctx.req.toLowerCase();
  const buscar = (dir, re) => { const d = path.join(ctx.wt, dir); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => re.test(f)).map((f) => `${dir}/${f}`) : []; };
  return {
    unit: buscar('test', new RegExp(`^${r}.*\\.js$`)),
    integration: buscar('tests/integration', new RegExp(`^${r}.*\\.js$`)),
    bdd: buscar('tests/bdd/features', new RegExp(`^${r}.*\\.feature$`)),
    e2e: buscar('tests/e2e', new RegExp(`^${r}.*\\.js$`)),
    steps: buscar('tests/bdd/steps', new RegExp(`^${r}.*\\.js$`)),
  };
}

// Comprobaciones del arbitro sobre lo que entrego el Juez. Devuelve la lista de problemas (vacia = rojo valido).
// revision=true: el Juez revisa las pruebas cuando YA existe la implementacion; no se exige rojo, solo que las pruebas corran.
async function validarRojo(ctx, { revision = false } = {}) {
  const { wt, req } = ctx;
  const problemas = [];
  const arch = archivosDelJuez(ctx);
  for (const capa of ['unit', 'integration', 'bdd', 'e2e']) {
    if (!arch[capa].length) problemas.push(`Falta la capa ${capa}: no hay archivos *${req.toLowerCase()}* en su carpeta.`);
    for (const f of arch[capa]) {
      if (!new RegExp(req).test(fs.readFileSync(path.join(wt, f), 'utf8'))) problemas.push(`${f} no menciona ${req} (trazabilidad).`);
    }
  }
  if (!fs.existsSync(path.join(ctx.evAbs, 'TEST-REQS.yaml'))) problemas.push(`Falta evidencias/${req}/TEST-REQS.yaml`);
  if (problemas.length) return { problemas };

  const trace = await fofo.runGate(ctx.fofo, 'trace-gate', ['--policy', ctx.fofoCfg.policy, '--context', wt, '--changed', CHANGED_TESTS], wt);
  if (trace.code !== 0) problemas.push('FoFo trace-gate: ' + JSON.stringify(trace.verdict || trace.out).slice(0, 500));
  const nuevos = [...arch.unit, ...arch.integration, ...arch.e2e].join(',');
  const intent = await fofo.runGate(ctx.fofo, 'intent-gate', ['--policy', ctx.fofoCfg.policy, '--context', wt, '--changed', nuevos], wt);
  if (intent.code !== 0) problemas.push('FoFo intent-gate (calidad de las pruebas): ' + JSON.stringify(intent.verdict || intent.out).slice(0, 900));

  const rojo = await correrSuites(ctx, { logSubdir: revision ? '02b-revision-del-juez' : '02-rojo' });
  if (!revision) ctx.rojo = rojo;
  for (const s of rojo.suites) {
    if (s.status === 'passed') { if (!revision) problemas.push(`La suite ${s.titulo} PASA, pero deberia estar en rojo: las pruebas nuevas no estan detectando la falta de la funcionalidad.`); }
    else if (s.causa === 'infraestructura') problemas.push(`La suite ${s.titulo} falla por un error de infraestructura (sintaxis, import, paso Gherkin indefinido o ambiguo), no por una asercion:\n${logsFallidos(ctx, { suites: [s] }, revision ? '02b-revision-del-juez' : '02-rojo')}`);
  }
  return { problemas };
}

async function faseJudge(ctx, { escalacion } = {}) {
  const { run, wt } = ctx;
  const revision = !!escalacion;
  let retro = null;
  let resume = null;
  for (let intento = 1; intento <= cfg.maxJudgeAttempts; intento++) {
    run.bump('judge');
    const rol = prompts.judge(ctx, { retroalimentacion: retro, escalacion });
    if (resume) rol.task = `# Continuacion: tu entrega anterior tiene problemas\n\n${retro}\n\nCorrigelos y responde con el mismo bloque JSON.`;
    const r = await llamarAgente(ctx, rol, { resume });
    resume = r.sessionId;
    const { problemas } = await validarRojo(ctx, { revision });
    if (!problemas.length && revision) {
      // El Juez puede concluir que las pruebas estan bien: entonces no cambia nada y no se vuelve a bloquear.
      const cambios = (await git.gitOut(wt, ['diff', '--name-only', run.data.testsCommit, '--', 'test', 'tests'])).split('\n').filter(Boolean);
      const nuevos = (await git.gitOut(wt, ['ls-files', '--others', '--exclude-standard', '--', 'test', 'tests'])).split('\n').filter(Boolean);
      if (!cambios.length && !nuevos.length) {
        ctx.say('Revision del Juez: las pruebas son correctas y no se modificaron.');
        run.data.judgeReviews = (run.data.judgeReviews || []).concat({ cambios: false, session: r.sessionId, motivo: String(escalacion).slice(0, 300) });
        run.save();
        return;
      }
      const lock = await fofo.runGate(ctx.fofo, 'test-lock', ['--write', '--policy', ctx.fofoCfg.policy, '--context', wt, '--changed', CHANGED_TESTS], wt);
      if (lock.code !== 0) throw new Failure('test-lock --write (revision) fallo: ' + JSON.stringify(lock.verdict || lock.out).slice(0, 300));
      fs.writeFileSync(path.join(ctx.evAbs, 'PROVENANCE.yaml'), `units:\n  - unit: ${ctx.req}\n    tests_by: judge-${r.sessionId}\n    code_by: author-${run.data.authorSessionId}\n`);
      run.data.testsCommit = (await git.commitRutas(wt, `test(${ctx.req}): revision del Juez (sesion nueva) y nuevo bloqueo con test-lock`, ['test', 'tests', `evidencias/${ctx.req}`])) || run.data.testsCommit;
      run.data.judgeReviews = (run.data.judgeReviews || []).concat({ cambios: true, session: r.sessionId, archivos: cambios.concat(nuevos) });
      run.save();
      ctx.say(`Revision del Juez: pruebas corregidas y bloqueadas de nuevo (${run.data.testsCommit.slice(0, 7)}).`);
      return;
    }
    if (!problemas.length) {
      // Fase 2 de FoFo: se confirma el rojo con el gate oficial y se bloquean las pruebas (test-lock)
      const rg = await fofo.runGate(ctx.fofo, 'redgreen-gate', ['--expect', 'red', '--policy', ctx.fofoCfg.policy, '--context', wt], wt, { env: { PORT: String(ctx.port) } });
      if (rg.code !== 0) { retro = 'FoFo redgreen-gate --expect red: ' + JSON.stringify(rg.verdict || rg.out).slice(0, 500); ctx.say('redgreen-gate rechazo el rojo.'); continue; }
      const lock = await fofo.runGate(ctx.fofo, 'test-lock', ['--write', '--policy', ctx.fofoCfg.policy, '--context', wt, '--changed', CHANGED_TESTS], wt);
      if (lock.code !== 0) throw new Failure('test-lock --write fallo: ' + JSON.stringify(lock.verdict || lock.out).slice(0, 300));
      const autorId = run.data.authorSessionId || (run.data.authorSessionId = crypto.randomUUID());
      const juezId = r.sessionId;
      fs.writeFileSync(path.join(ctx.evAbs, 'PROVENANCE.yaml'), `units:\n  - unit: ${ctx.req}\n    tests_by: judge-${juezId}\n    code_by: author-${autorId}\n`);
      fs.copyFileSync(path.join(ctx.evAbs, 'TEST-LOCK.json'), path.join(ctx.runDir, 'TEST-LOCK.copia.json'));
      run.data.testsCommit = await git.commitTodo(wt, `test(${ctx.req}): pruebas del Juez en rojo, bloqueadas con test-lock\n\nRojo verificado: ${ctx.rojo.suites.map((s) => `${s.suite}=${s.failed} fallan`).join(', ')}`);
      run.data.rojo = ctx.rojo.suites.map((s) => ({ suite: s.suite, titulo: s.titulo, passed: s.passed, failed: s.failed, causa: s.causa }));
      run.data.judgeFiles = archivosDelJuez(ctx);
      run.save();
      ctx.say(`Pruebas del Juez en rojo y bloqueadas (${run.data.testsCommit.slice(0, 7)}).`);
      return;
    }
    retro = problemas.join('\n\n');
    ctx.say(`Entrega del Juez rechazada (intento ${intento}/${cfg.maxJudgeAttempts}): ${problemas[0].split('\n')[0]}`);
  }
  throw new Failure('El Juez no logro entregar pruebas validas en rojo.');
}

// ---------------------------------------------------------------------------------------------------------------------
async function faseAuthor(ctx, { nota, retroInicial } = {}) {
  const { run, wt } = ctx;
  const sesiones = run.data.sessions.author || [];
  let resume = sesiones.length ? sesiones[sesiones.length - 1] : null;
  let retro = retroInicial || null;
  const escFile = path.join(ctx.evAbs, 'author-escalation.md');
  for (let intento = 1; intento <= cfg.maxAuthorAttempts; intento++) {
    run.bump('author');
    const rol = prompts.author(ctx, { retroalimentacion: resume ? (retro || 'Revisa el estado actual y vuelve a ejecutar las suites.') : null, nota });
    const r = await llamarAgente(ctx, rol, resume ? { resume } : { sessionId: run.data.authorSessionId });
    resume = r.sessionId;
    if (fs.existsSync(escFile)) {
      const reclamo = fs.readFileSync(escFile, 'utf8');
      fs.rmSync(escFile);
      run.data.loopbacks = (run.data.loopbacks || 0) + 1;
      run.save();
      if (run.data.loopbacks > cfg.maxLoopbacks) throw new Failure('El Autor insiste en que las pruebas estan mal y se agotaron las revisiones del Juez.');
      ctx.say('El Autor escalo al Juez: una prueba parece incorrecta. Revision del Juez en una sesion nueva...');
      await faseJudge(ctx, { escalacion: reclamo });
      retro = `El Juez reviso las pruebas (sesion nueva) y las volvio a bloquear. Vuelve a leerlas.`;
      continue;
    }
    const verde = await correrSuites(ctx, { logSubdir: '03-verde' });
    if (verde.ok) {
      run.data.verde = verde.suites.map((s) => ({ suite: s.suite, titulo: s.titulo, passed: s.passed, failed: s.failed }));
      run.data.codeCommit = await git.commitTodo(wt, `feat(${ctx.req}): implementacion del Autor (todas las suites en verde)`);
      run.save();
      ctx.say(`Suites en verde tras ${run.data.attempts.author} intento(s) del Autor.`);
      return;
    }
    retro = `Resultado de las suites:\n${resumenSuites(verde)}\n\n${logsFallidos(ctx, verde, '03-verde')}`;
    ctx.say(`Suites aun en rojo (intento ${intento}/${cfg.maxAuthorAttempts}).`);
  }
  throw new Failure('El Autor no logro poner en verde las suites con los reintentos permitidos.');
}

// ---------------------------------------------------------------------------------------------------------------------
async function faseVerify(ctx) {
  const { run, wt } = ctx;
  for (let ronda = 1; ; ronda++) {
    // el gate-runner compara contra el commit de las pruebas: solo se juzga lo que hizo el Autor
    ctx.fofoCfg = fofo.escribirConfig(ctx.runDir, wt, ctx.req, { testCommand: `node "${RUN_SUITES}" --cwd "${wt}"`, baseRef: run.data.testsCommit });
    ctx.say(`FoFo gate-runner (ronda ${ronda})...`);
    const g = await fofo.runRunner(ctx.fofo, ctx.fofoCfg, CHANGED_ALL, wt, { env: { PORT: String(ctx.port) } });
    if (!g.report) throw new Failure('gate-runner no devolvio un veredicto: ' + tail(g.err || g.out, 15));
    fs.writeFileSync(path.join(ctx.evAbs, '04-gates.json'), JSON.stringify(g.report, null, 2));
    run.data.gates = g.report.gates.map((x) => ({ gate: x.gate, status: x.status, summary: x.summary }));
    run.data.gatesOverall = g.report.overall_status;
    run.save();
    ctx.say(`Gates: ${g.report.overall_status} (${run.data.gates.map((x) => `${x.gate}=${x.status}`).join(', ')})`);
    if (g.report.overall_status === 'pass') return;
    // ERROR-DE-GATE: un gate que no pudo ejecutarse es un problema de infraestructura, no del Autor ni del Juez
    const roto = g.report.gates.filter((x) => x.status === 'error');
    if (roto.length) throw new Failure(`Un gate de FoFo no pudo ejecutarse: ${roto.map((x) => `${x.gate} (${x.summary})`).join('; ')}`);

    const esc = g.report.escalation || [];
    const fallos = g.report.gates.filter((x) => x.status === 'fail' || x.status === 'escalate');
    const rutaDe = (x) => (esc.find((e) => e.gate === x.gate) || {}).route || (x.route) || 'code';
    const humano = fallos.filter((x) => rutaDe(x) === 'review');
    if (humano.length) throw new Blocked(`Los gates piden decision humana: ${humano.map((x) => `${x.gate} (${x.summary})`).join('; ')}`);
    if (ronda > cfg.maxLoopbacks) throw new Failure(`Los gates siguen fallando tras ${cfg.maxLoopbacks} rondas: ${fallos.map((x) => x.gate).join(', ')}`);
    const deTests = fallos.filter((x) => rutaDe(x) === 'tests');
    const detalle = fallos.map((x) => `- ${x.gate} [${x.status}] ruta=${rutaDe(x)}: ${x.summary}\n${(x.findings || []).slice(0, 5).map((f) => `    ${f.severity} ${f.location}: ${f.detail}`).join('\n')}`).join('\n');
    if (deTests.length) {
      ctx.say('Ruta de lazo: hallazgos sobre las PRUEBAS -> Juez (sesion nueva).');
      await faseJudge(ctx, { escalacion: `Los gates de FoFo reportaron problemas en las pruebas:\n${detalle}` });
      await faseAuthor(ctx, { nota: 'El Juez corrigio y volvio a bloquear las pruebas.' });
    } else {
      ctx.say('Ruta de lazo: hallazgos sobre el CODIGO -> Autor.');
      await faseAuthor(ctx, { retroInicial: `Los gates de FoFo fallaron:\n${detalle}`, nota: 'Verificacion FoFo (Fase 4).' });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
async function faseReview(ctx) {
  const { run, wt } = ctx;
  const r = await llamarAgente(ctx, prompts.review(ctx, { baseCommit: run.data.testsCommit }));
  let v = r.json;
  if (!v || !['pass', 'fail'].includes(v.verdict)) v = { verdict: 'fail', summary: 'El revisor no devolvio un veredicto valido', findings: [{ severity: 'med', route: 'code', location: '-', detail: r.text.slice(0, 300) }] };
  fs.writeFileSync(path.join(ctx.evAbs, '05-revision.json'), JSON.stringify(v, null, 2));
  run.data.review = v;
  run.save();
  ctx.say(`Revision de ojos frescos: ${v.verdict} - ${v.summary}`);
  const altos = (v.findings || []).filter((f) => f.severity === 'high');
  if (v.verdict === 'pass' || !altos.length) return;
  const detalle = altos.map((f) => `- [${f.severity}] ${f.location}: ${f.detail}`).join('\n');
  if (altos.some((f) => f.route === 'tests')) {
    await faseJudge(ctx, { escalacion: `El revisor encontro problemas en las pruebas:\n${detalle}` });
    await faseAuthor(ctx, { nota: 'El Juez corrigio las pruebas tras la revision.' });
  } else {
    await faseAuthor(ctx, { retroInicial: `El revisor de ojos frescos encontro:\n${detalle}`, nota: 'Revision (Fase 5).' });
  }
  await faseVerify(ctx);
  const r2 = await llamarAgente(ctx, prompts.review(ctx, { baseCommit: run.data.testsCommit }));
  const v2 = r2.json || { verdict: 'fail', summary: 'sin veredicto', findings: [] };
  fs.writeFileSync(path.join(ctx.evAbs, '05-revision.json'), JSON.stringify(v2, null, 2));
  run.data.review = v2;
  run.save();
  if (v2.verdict !== 'pass' && (v2.findings || []).some((f) => f.severity === 'high')) {
    throw new Blocked('La revision de ojos frescos sigue reportando hallazgos altos despues de la correccion.');
  }
}

// ---------------------------------------------------------------------------------------------------------------------
async function faseArchive(ctx) {
  const { run, wt } = ctx;
  const r = await exec(OPENSPEC, ['archive', ctx.change, '--yes'], { cwd: wt, timeoutMs: 120000 });
  if (r.code !== 0) throw new Failure('openspec archive fallo: ' + tail(r.err || r.out, 15));
  fs.writeFileSync(path.join(ctx.evAbs, '06-openspec-archive.txt'), r.out);
  const v = await exec(OPENSPEC, ['validate', '--specs', '--strict'], { cwd: wt });
  fs.appendFileSync(path.join(ctx.evAbs, '06-openspec-archive.txt'), '\n--- openspec validate --specs --strict ---\n' + v.out + v.err);
  if (v.code !== 0) throw new Failure('Las specs principales no validan tras archivar: ' + tail(v.out + v.err, 10));
  await git.commitTodo(wt, `chore(${ctx.req}): archivar el cambio ${ctx.change} y actualizar las specs principales de OpenSpec`);
  ctx.say('Cambio archivado en OpenSpec y specs principales actualizadas.');
}

async function faseEvidence(ctx) {
  const { run, wt } = ctx;
  report.escribirInforme(ctx);
  await git.commitTodo(wt, `docs(${ctx.req}): evidencia de cada etapa del harness`);
}

async function fasePr(ctx, opts) {
  const { run, wt } = ctx;
  if (opts.noPr) { ctx.say('--no-pr: no se crea el Pull Request.'); return; }
  const draft = run.data.outcome !== 'ready';
  const cuerpo = report.cuerpoPr(ctx, { draft });
  const bodyFile = path.join(ctx.runDir, 'pr-body.md');
  fs.writeFileSync(bodyFile, cuerpo);
  await git.push(wt, ctx.branch);
  const titulo = `${ctx.req}: ${ctx.info.title}${draft ? ' [BORRADOR]' : ''}`;
  const ya = await git.gh(wt, ['pr', 'list', '--head', ctx.branch, '--state', 'open', '--json', 'number,url'], { allowFail: true });
  let pr = null;
  try { pr = JSON.parse(ya.out)[0]; } catch { /* sin PR */ }
  if (pr) {
    await git.gh(wt, ['pr', 'edit', String(pr.number), '--title', titulo, '--body-file', bodyFile]);
    if (!draft) await git.gh(wt, ['pr', 'ready', String(pr.number)], { allowFail: true });
  } else {
    const args = ['pr', 'create', '--base', cfg.baseBranch, '--head', ctx.branch, '--title', titulo, '--body-file', bodyFile];
    if (draft) args.push('--draft');
    const r = await git.gh(wt, args);
    const url = (r.out.match(/https:\/\/github\.com\/\S+/) || [])[0];
    pr = { url, number: url ? parseInt(url.split('/').pop(), 10) : null };
  }
  run.data.pr = { url: pr.url, number: pr.number, draft };
  run.save();
  ctx.say(`Pull Request ${draft ? '(BORRADOR) ' : ''}${pr.url}`);
}

// ---------------------------------------------------------------------------------------------------------------------
async function ejecutarFase(ctx, nombre, fn) {
  const { run } = ctx;
  const f = run.phase(nombre);
  if (f.status === 'done' || f.status === 'skipped') { ctx.say(`Fase ${nombre}: ya completada, se omite.`); return; }
  run.start(nombre);
  ctx.say(`>>> Fase ${nombre}`);
  try {
    await fn();
    run.finish(nombre, 'done');
  } catch (e) {
    run.finish(nombre, e instanceof Blocked ? 'blocked' : 'failed', { error: e.message });
    throw e;
  }
}

async function runPipeline(opts) {
  const req = opts.req;
  const info = loadRequirement(req, opts.text);
  const runDir = runDirOf(req);
  if (opts.restart && Run.existe(runDir)) {
    const viejo = new Run(runDir).load().data;
    if (viejo.worktree && fs.existsSync(viejo.worktree)) await git.git(cfg.repo, ['worktree', 'remove', '--force', viejo.worktree], { allowFail: true });
    await git.git(cfg.repo, ['branch', '-D', viejo.branch], { allowFail: true });
    fs.rmSync(runDir, { recursive: true, force: true });
  }
  const run = new Run(runDir);
  if (Run.existe(runDir)) run.load();
  else {
    const otros = fs.existsSync(cfg.runsDir) ? fs.readdirSync(cfg.runsDir).map((d) => { try { return new Run(path.join(cfg.runsDir, d)).load().data.port; } catch { return null; } }).filter(Boolean) : [];
    run.init({
      req, title: info.title, branch: `req/${req}-${slug(info.title)}`, worktree: worktreeOf(req),
      port: await allocatePort(req, otros), change: `${req.toLowerCase()}-${slug(info.title)}`, base: cfg.baseBranch,
    });
  }
  const ctx = crearContexto(run, info);
  if (run.data.status === 'done' && !opts.restart) { ctx.say('La ejecucion ya termino. Use --restart para repetirla.'); return run.data; }
  run.set('status', 'running');
  ctx.say(`Inicio. Rama ${ctx.branch} | puerto ${ctx.port} | estado ${path.relative(cfg.repo, runDir)}`);

  const aTraves = async () => {
    await ejecutarFase(ctx, 'setup', () => faseSetup(ctx));
    // si se reanuda, se reconstruye lo que setup dejo en memoria
    if (!ctx.fofo) { ctx.fofo = await fofo.setup(ctx.say); ctx.fofoCfg = fofo.escribirConfig(ctx.runDir, ctx.wt, ctx.req, { testCommand: `node "${RUN_SUITES}" --cwd "${ctx.wt}"`, baseRef: run.data.testsCommit || 'HEAD' }); }
    await ejecutarFase(ctx, 'spec', () => faseSpec(ctx));
    await ejecutarFase(ctx, 'judge', () => faseJudge(ctx));
    await ejecutarFase(ctx, 'author', () => faseAuthor(ctx));
    await ejecutarFase(ctx, 'verify', () => faseVerify(ctx));
    await ejecutarFase(ctx, 'review', () => faseReview(ctx));
    run.data.outcome = 'ready';
    await ejecutarFase(ctx, 'archive', () => faseArchive(ctx));
  };

  try {
    await aTraves();
  } catch (e) {
    run.data.outcome = e instanceof Blocked ? 'blocked' : 'failed';
    run.data.blockReason = e.message;
    run.set('status', run.data.outcome);
    ctx.say(`${e instanceof Blocked ? 'BLOQUEADO' : 'FALLO'}: ${e.message}`);
    // el cambio NO se archiva: se deja un PR en borrador que reporta el bloqueo
    if (run.phase('archive').status === 'pending') run.finish('archive', 'skipped', { reason: 'no se archiva un cambio bloqueado o fallido' });
  }
  try {
    await ejecutarFase(ctx, 'evidence', () => faseEvidence(ctx));
    await ejecutarFase(ctx, 'pr', () => fasePr(ctx, opts));
  } catch (e) {
    ctx.say(`Error al publicar el resultado: ${e.message}`);
    run.data.publishError = e.message;
    run.set('status', 'failed');
  }
  if (run.data.outcome === 'ready' && !run.data.publishError) run.set('status', 'done');
  ctx.say(`Fin: ${run.data.outcome}. Costo de agentes: $${run.data.costUsd.toFixed(2)}`);
  return run.data;
}

module.exports = { runPipeline, Blocked, Failure };
