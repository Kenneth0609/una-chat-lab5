'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('reanudar una revision fallida ejecuta archivo e informe y limpia errores antiguos', async (t) => {
  const file = path.join(__dirname, '../lib/pipeline.js');
  const localRequire = createRequire(file);
  const { Run } = localRequire('./state');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab5-resume-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'evidencias/REQ-099'), { recursive: true });
  const run = new Run(dir).init({ req: 'REQ-099', title: 'Resume', branch: 'req/test',
    worktree: dir, port: 4999, change: 'req-099-test', testsCommit: 'fixture' });
  for (const name of Object.keys(run.data.phases)) run.finish(name, 'done');
  run.finish('review', 'failed', { error: 'Session limit' });
  run.finish('archive', 'skipped', { reason: 'no se archiva un cambio bloqueado o fallido' });
  Object.assign(run.data, { status: 'failed', outcome: 'failed', blockReason: 'Session limit', publishError: 'Old network error' });
  run.save();
  let archivos = 0;
  let informes = 0;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module, exports: module.exports, __dirname: path.dirname(file), process, console: { log() {} }, setTimeout,
    require: (nombre) => {
      if (nombre === './config') return { ...localRequire(nombre), runDirOf: () => dir,
        loadRequirement: () => ({ title: 'Resume', raw: 'REQ-099: Resume', acceptance: 'WHEN THEN' }) };
      if (nombre === './fofo') return { setup: async () => ({}), escribirConfig: () => ({}) };
      if (nombre === './agent') return { runAgent: async () => ({ ok: true,
        json: { verdict: 'pass', summary: 'Review complete', findings: [] },
        text: '', sessionId: 'review-fixture', costUsd: 0, turns: 1, durationMs: 1, denials: [] }) };
      if (nombre === './proc') return { ...localRequire(nombre), exec: async (cmd, args) => {
        if (args[0] === 'archive') archivos++;
        return { code: 0, out: 'ok', err: '' };
      } };
      if (nombre === './report') return { escribirInforme() { informes++; } };
      if (nombre === './git') return new Proxy({ commitTodo: async () => 'fixture' }, {
        get: (obj, key) => obj[key] || (() => { throw new Error('Unexpected git operation: ' + key); }),
      });
      return localRequire(nombre);
    },
  }, { filename: file });
  const resultado = await module.exports.runPipeline({ req: 'REQ-099', noPr: true });
  assert.equal(archivos, 1, 'debe archivar despues de completar la revision');
  assert.equal(informes, 1, 'debe actualizar el informe del intento fallido');
  assert.equal(resultado.phases.archive.status, 'done');
  assert.equal(resultado.status, 'done');
  assert.equal(resultado.outcome, 'ready');
  assert.equal(resultado.publishError, undefined);
  assert.equal(resultado.blockReason, undefined);
});
