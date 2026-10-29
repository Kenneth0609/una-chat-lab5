'use strict';
// Operaciones git/gh del harness. Las que tocan el repositorio compartido se serializan con un bloqueo.
const fs = require('fs');
const { cfg } = require('./config');
const { exec, which, conBloqueo } = require('./proc');

const GIT = which('git') || 'git';
const GH = which('gh') || 'gh';

async function git(cwd, args, opts = {}) {
  const r = await exec(GIT, args, { cwd, ...opts });
  if (r.code !== 0 && !opts.allowFail) {
    throw new Error(`git ${args.join(' ')} fallo (${r.code}): ${(r.err || r.out).trim().slice(0, 600)}`);
  }
  return r;
}

const gitOut = async (cwd, args) => (await git(cwd, args)).out.trim();

// crea rama + worktree propios del requerimiento (idempotente)
async function crearWorktree(req, branch, dir) {
  if (fs.existsSync(dir)) return { creado: false };
  fs.mkdirSync(cfg.worktrees, { recursive: true });
  await conBloqueo(cfg.locksDir, 'git', async () => {
    const existe = (await git(cfg.repo, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { allowFail: true })).code === 0;
    if (existe) await git(cfg.repo, ['worktree', 'add', dir, branch]);
    else await git(cfg.repo, ['worktree', 'add', '-b', branch, dir, cfg.baseBranch]);
  });
  return { creado: true };
}

async function commitTodo(cwd, mensaje) {
  await git(cwd, ['add', '-A']);
  const estado = await gitOut(cwd, ['status', '--porcelain']);
  if (!estado) return null;
  await git(cwd, ['-c', 'core.autocrlf=false', 'commit', '-q', '-m', mensaje + '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>']);
  return gitOut(cwd, ['rev-parse', 'HEAD']);
}

// Como commitTodo, pero solo con las rutas indicadas (por ejemplo, para no arrastrar el trabajo en curso del Autor)
async function commitRutas(cwd, mensaje, rutas) {
  await git(cwd, ['add', '-A', '--', ...rutas]);
  const estado = await gitOut(cwd, ['diff', '--cached', '--name-only']);
  if (!estado) return null;
  await git(cwd, ['-c', 'core.autocrlf=false', 'commit', '-q', '-m', mensaje + '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>']);
  return gitOut(cwd, ['rev-parse', 'HEAD']);
}

async function push(cwd, branch) {
  return conBloqueo(cfg.locksDir, 'git', () => git(cwd, ['push', '-u', cfg.remote, branch, '--force-with-lease']));
}

async function gh(cwd, args, opts = {}) {
  const r = await exec(GH, args, { cwd, ...opts });
  if (r.code !== 0 && !opts.allowFail) throw new Error(`gh ${args.join(' ')} fallo: ${(r.err || r.out).trim().slice(0, 600)}`);
  return r;
}

module.exports = { git, gitOut, crearWorktree, commitTodo, commitRutas, push, gh };
