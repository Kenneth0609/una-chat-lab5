'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Ejecuta la fase real, sustituyendo solo el proceso externo de Claude.
// No llama agentes ni permite commits/publicaciones durante esta regresion.
function faseConRespuesta(respuesta) {
  const file = path.join(__dirname, '../lib/pipeline.js');
  const localRequire = createRequire(file);
  const module = { exports: {} };
  const fuente = fs.readFileSync(file, 'utf8');
  vm.runInNewContext(fuente + '\nmodule.exports.faseReview = faseReview;', {
    module, exports: module.exports, __dirname: path.dirname(file), process, console, setTimeout,
    require: (nombre) => nombre === './agent'
      ? { runAgent: async () => ({
        ok: true, json: null, text: '', sessionId: 'review-fixture', costUsd: 0,
        turns: 1, durationMs: 1, denials: [], ...respuesta,
      }) }
      : localRequire(nombre),
  }, { filename: file });
  return module.exports.faseReview;
}

async function contexto(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab5-review-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return {
    req: 'REQ-011', wt: dir, ev: 'evidencias/REQ-011', evAbs: dir, logDir: dir, port: 4011,
    info: { title: 'Messages need a name', raw: 'REQ-011: Messages need a name', acceptance: 'WHEN empty THEN reject' },
    say() {},
    run: { data: { testsCommit: 'fixture', sessions: {} }, addCost() {}, save() {} },
  };
}

test('una interrupcion del revisor impide cerrar y archivar el requerimiento', async (t) => {
  const revisar = faseConRespuesta({ ok: false, text: "You've hit your session limit" });
  await assert.rejects(revisar(await contexto(t)), /revisor|revision/i);
});

test('un resultado sin JSON de revision no cuenta como aprobacion', async (t) => {
  const revisar = faseConRespuesta({ text: 'No pude terminar la revision' });
  await assert.rejects(revisar(await contexto(t)), /revisor|revision/i);
});

test('un veredicto fail sin hallazgos altos tampoco aprueba el cambio', async (t) => {
  const revisar = faseConRespuesta({ json: { verdict: 'fail', summary: 'Revision incompleta', findings: [] } });
  await assert.rejects(revisar(await contexto(t)), /revision|hallazgos/i);
});

test('una revision explicita y valida permite continuar', async (t) => {
  const revisar = faseConRespuesta({ json: { verdict: 'pass', summary: 'Criterios revisados', findings: [] } });
  const ctx = await contexto(t);
  await revisar(ctx);
  const evidencia = JSON.parse(fs.readFileSync(path.join(ctx.evAbs, '05-revision.json')));
  assert.equal(evidencia.verdict, 'pass');
});
