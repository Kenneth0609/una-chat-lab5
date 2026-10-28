'use strict';
// Rutas, limites y utilidades de requerimientos del harness.
const fs = require('fs');
const net = require('net');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const STATE_ROOT = path.join(REPO, '.harness');
const WORKTREES = path.join(path.dirname(REPO), path.basename(REPO) + '-worktrees');

const cfg = {
  repo: REPO,
  stateRoot: STATE_ROOT,
  runsDir: path.join(STATE_ROOT, 'runs'),
  locksDir: path.join(STATE_ROOT, 'locks'),
  vendorDir: path.join(STATE_ROOT, 'vendor'),
  worktrees: WORKTREES,
  baseBranch: process.env.HARNESS_BASE || 'main',
  remote: process.env.HARNESS_REMOTE || 'origin',
  model: process.env.HARNESS_MODEL || 'sonnet',
  basePort: parseInt(process.env.HARNESS_BASE_PORT || '4000', 10),
  // reintentos controlados
  maxSpecAttempts: 2,
  maxJudgeAttempts: 3,
  maxAuthorAttempts: 4,
  maxLoopbacks: 2,
  agentTimeoutMs: 25 * 60 * 1000,
  agentMaxTurns: parseInt(process.env.HARNESS_MAX_TURNS || '60', 10),
  fofoRepo: 'https://github.com/Sweet-Papa-Technologies/Agentic-SDLC.git',
  fofoCommit: '50d9220b6a1ebbf4be5ab11329bb4264683403b3',
};

function runDirOf(req) { return path.join(cfg.runsDir, req); }
function worktreeOf(req) { return path.join(cfg.worktrees, req); }

const slug = (texto) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').slice(0, 5).join('-');

// harness/requirements/REQ-010.md  ->  { id, title, acceptance, raw }
function parseRequirement(texto) {
  const m = texto.match(/(REQ-\d+)\s*:\s*([^\r\n]+)/);
  if (!m) throw new Error('El requerimiento debe tener el formato "REQ-NNN: titulo" seguido de "Acceptance: ..."');
  const acc = texto.match(/Acceptance\s*:\s*([\s\S]+)$/i);
  if (!acc) throw new Error(`${m[1]} no tiene una linea "Acceptance:"`);
  return { id: m[1], title: m[2].trim(), acceptance: acc[1].trim().replace(/\s+/g, ' '), raw: texto.trim() };
}

function loadRequirement(req, textoNuevo) {
  const file = path.join(REPO, 'harness', 'requirements', `${req}.md`);
  if (textoNuevo) {
    // "un solo comando y un requerimiento claro": se puede dar el texto directo
    const t = textoNuevo.includes(req) ? textoNuevo : `### ${req}: ${textoNuevo.split(/Acceptance/i)[0].trim()}\nAcceptance: ${(textoNuevo.split(/Acceptance\s*:/i)[1] || textoNuevo).trim()}`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, t.trim() + '\n');
  }
  if (!fs.existsSync(file)) throw new Error(`No existe ${path.relative(REPO, file)}. Cree el archivo o use --text "..."`);
  return parseRequirement(fs.readFileSync(file, 'utf8'));
}

function libre(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}

// Puerto estable por requerimiento (REQ-010 -> 4010) para que las pruebas de varias sesiones no choquen.
async function allocatePort(req, usados = []) {
  const n = parseInt(req.replace(/\D/g, ''), 10) || 0;
  let port = cfg.basePort + (n % 1000);
  while (usados.includes(port) || !(await libre(port))) port += 1;
  return port;
}

module.exports = { cfg, runDirOf, worktreeOf, slug, parseRequirement, loadRequirement, allocatePort, libre };
