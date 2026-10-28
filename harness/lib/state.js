'use strict';
// Estado persistente de una ejecucion (.harness/runs/<REQ>/state.json). Permite reanudar:
// cada fase queda marcada como pending | running | done | failed | skipped.
const fs = require('fs');
const path = require('path');

const FASES = ['setup', 'spec', 'judge', 'author', 'verify', 'review', 'archive', 'evidence', 'pr'];

class Run {
  constructor(runDir) {
    this.dir = runDir;
    this.file = path.join(runDir, 'state.json');
    this.logFile = path.join(runDir, 'run.log');
    fs.mkdirSync(runDir, { recursive: true });
    this.data = null;
  }

  static existe(runDir) { return fs.existsSync(path.join(runDir, 'state.json')); }

  init(datos) {
    this.data = Object.assign({
      version: 1,
      status: 'running', // running | done | blocked | failed
      createdAt: new Date().toISOString(),
      phases: Object.fromEntries(FASES.map((f) => [f, { status: 'pending' }])),
      sessions: {},
      attempts: {},
      costUsd: 0,
      questions: [],
      blocking: false,
      events: [],
    }, datos);
    this.save();
    return this;
  }

  load() {
    this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    return this;
  }

  // escritura atomica: nunca queda un state.json a medias si se corta la ejecucion
  save() {
    this.data.updatedAt = new Date().toISOString();
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  get(k) { return this.data[k]; }
  set(k, v) { this.data[k] = v; this.save(); }

  log(msg) {
    const linea = `${new Date().toISOString()} ${msg}`;
    fs.appendFileSync(this.logFile, linea + '\n');
    this.data.events.push(linea);
    if (this.data.events.length > 200) this.data.events.shift();
    return linea;
  }

  phase(nombre) { return this.data.phases[nombre]; }

  start(nombre) {
    const f = this.phase(nombre);
    f.status = 'running';
    f.startedAt = new Date().toISOString();
    delete f.endedAt;
    delete f.error;
    this.data.currentPhase = nombre;
    this.save();
  }

  finish(nombre, status, extra = {}) {
    const f = this.phase(nombre);
    Object.assign(f, extra, { status, endedAt: new Date().toISOString() });
    this.save();
  }

  bump(nombre) {
    this.data.attempts[nombre] = (this.data.attempts[nombre] || 0) + 1;
    this.save();
    return this.data.attempts[nombre];
  }

  addCost(usd) {
    this.data.costUsd = Math.round((this.data.costUsd + (usd || 0)) * 10000) / 10000;
    this.save();
  }
}

module.exports = { Run, FASES };
