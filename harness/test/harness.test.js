'use strict';
// Pruebas del propio harness (node --test harness/test/): lo que no depende de agentes ni de red.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseRequirement, slug, allocatePort, libre } = require('../lib/config');
const { Run, FASES } = require('../lib/state');
const { extraerJson } = require('../lib/agent');
const { conBloqueo } = require('../lib/proc');
const prompts = require('../lib/prompts');

test('parseRequirement lee id, titulo y criterio de aceptacion (formato FoFo)', () => {
  const r = parseRequirement('### REQ-010: Empty messages are not published\nAcceptance: WHEN a THEN the system SHALL b.\n');
  assert.strictEqual(r.id, 'REQ-010');
  assert.strictEqual(r.title, 'Empty messages are not published');
  assert.match(r.acceptance, /^WHEN a THEN/);
});

test('parseRequirement rechaza un requerimiento sin Acceptance', () => {
  assert.throws(() => parseRequirement('### REQ-001: Solo titulo'), /Acceptance/);
});

test('slug normaliza el titulo para ramas y nombres de cambio', () => {
  assert.strictEqual(slug('Empty messages are not published'), 'empty-messages-are-not-published');
  assert.strictEqual(slug('¡Mensajes cortos, por favor!'), 'mensajes-cortos-por-favor');
});

test('allocatePort es estable por requerimiento y evita puertos usados u ocupados', async () => {
  const a = await allocatePort('REQ-010');
  assert.strictEqual(a, 4010);
  assert.strictEqual(await allocatePort('REQ-011'), 4011);
  assert.strictEqual(await allocatePort('REQ-010', [4010]), 4011);
  assert.strictEqual(await libre(a), true);
});

test('el estado se guarda de forma atomica y se puede reanudar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-state-'));
  const run = new Run(dir).init({ req: 'REQ-010' });
  assert.deepStrictEqual(Object.keys(run.data.phases), FASES);
  run.start('spec');
  run.finish('spec', 'done');
  run.bump('judge');
  run.addCost(0.5);
  const otra = new Run(dir).load();
  assert.strictEqual(otra.phase('spec').status, 'done');
  assert.strictEqual(otra.data.attempts.judge, 1);
  assert.strictEqual(otra.data.costUsd, 0.5);
  assert.ok(!fs.existsSync(path.join(dir, 'state.json.tmp')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('extraerJson toma el ultimo bloque json de la respuesta del agente', () => {
  const t = 'Listo.\n```json\n{"a":1}\n```\ny luego\n```json\n{"verdict":"pass","findings":[]}\n```';
  assert.deepStrictEqual(extraerJson(t), { verdict: 'pass', findings: [] });
  assert.strictEqual(extraerJson('sin json'), null);
});

test('conBloqueo serializa a dos ejecuciones que compiten por el mismo recurso', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-lock-'));
  const orden = [];
  const tarea = (n) => conBloqueo(dir, 'git', async () => { orden.push(`ini${n}`); await new Promise((r) => setTimeout(r, 120)); orden.push(`fin${n}`); });
  await Promise.all([tarea(1), tarea(2)]);
  assert.ok(orden.join() === 'ini1,fin1,ini2,fin2' || orden.join() === 'ini2,fin2,ini1,fin1', orden.join());
  fs.rmSync(dir, { recursive: true, force: true });
});

test('el aislamiento de roles queda en los permisos: el Juez no lee el codigo y el Autor no edita pruebas', () => {
  const ctx = { req: 'REQ-010', info: { raw: 'x', title: 't', acceptance: 'a' }, change: 'req-010-x', ev: 'evidencias/REQ-010', port: 4010 };
  const juez = prompts.judge(ctx);
  assert.ok(juez.denied.includes('Read(./public/**)') && juez.denied.includes('Read(./server.js)'));
  assert.ok(!juez.allowed.some((p) => p.startsWith('Edit(./public')));
  const autor = prompts.author(ctx);
  assert.ok(autor.denied.includes('Edit(./tests/**)') && autor.denied.includes('Edit(./test/**)') && autor.denied.includes('Edit(./openspec/**)'));
  assert.ok(autor.allowed.includes('Edit(./public/**)'));
  const revisor = prompts.review(ctx, { baseCommit: 'abc' });
  assert.ok(!revisor.allowed.some((p) => p.startsWith('Edit(')));
});
