'use strict';
// Lanza un agente de Claude Code en modo headless (claude -p) con permisos propios del rol.
// El aislamiento es real: cada rol corre en su PROPIA sesion y con reglas de permisos que el
// CLI hace cumplir (dontAsk: lo que no esta permitido se deniega, no se pregunta).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cfg } = require('./config');
const { exec, which, WIN } = require('./proc');

function resolveClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const shim = which('claude');
  if (shim && WIN) {
    const exe = path.join(path.dirname(shim), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return shim || 'claude';
}

const CLAUDE = resolveClaude();

// Extrae el ultimo bloque ```json ... ``` (o un objeto JSON suelto) del texto final del agente
function extraerJson(texto) {
  const bloques = [...texto.matchAll(/```json\s*([\s\S]*?)```/g)];
  const candidatos = bloques.map((m) => m[1]);
  const suelto = texto.match(/\{[\s\S]*\}\s*$/);
  if (suelto) candidatos.push(suelto[0]);
  for (const c of candidatos.reverse()) {
    try { return JSON.parse(c); } catch { /* siguiente */ }
  }
  return null;
}

/**
 * opts: role, cwd, prompt, systemPrompt, allowed[], denied[], logDir, resume (session id), model, maxTurns
 * devuelve { ok, text, json, sessionId, costUsd, turns, denials, durationMs, rawFile }
 */
async function runAgent(opts) {
  const sessionId = opts.resume || opts.sessionId || crypto.randomUUID();
  const args = ['-p', '--output-format', 'json', '--model', opts.model || cfg.model,
    '--permission-mode', 'dontAsk', '--setting-sources', 'project', '--strict-mcp-config'];
  if (opts.resume) args.push('--resume', opts.resume);
  else args.push('--session-id', sessionId);
  if (opts.systemPrompt) args.push('--append-system-prompt', opts.systemPrompt);
  args.push('--max-turns', String(opts.maxTurns || cfg.agentMaxTurns));
  if (opts.allowed && opts.allowed.length) args.push('--allowedTools', ...opts.allowed);
  if (opts.denied && opts.denied.length) args.push('--disallowedTools', ...opts.denied);

  fs.mkdirSync(opts.logDir, { recursive: true });
  const n = (fs.readdirSync(opts.logDir).filter((f) => f.startsWith(opts.role + '-') && f.endsWith('.json')).length) + 1;
  const base = path.join(opts.logDir, `${opts.role}-${String(n).padStart(2, '0')}`);
  fs.writeFileSync(base + '.prompt.md', opts.prompt);

  const r = await exec(CLAUDE, args, {
    cwd: opts.cwd, input: opts.prompt, timeoutMs: opts.timeoutMs || cfg.agentTimeoutMs,
    env: Object.assign({ CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' }, opts.env || {}),
  });
  fs.writeFileSync(base + '.json', r.out || r.err);

  let j = null;
  try { j = JSON.parse(r.out); } catch { /* salida inesperada */ }
  const text = (j && j.result) || r.err || r.out || '';
  fs.writeFileSync(base + '.result.md', text);
  return {
    ok: !!j && !j.is_error && r.code === 0,
    text,
    json: extraerJson(text),
    sessionId: (j && j.session_id) || sessionId,
    costUsd: (j && j.total_cost_usd) || 0,
    turns: (j && j.num_turns) || 0,
    denials: (j && j.permission_denials) || [],
    durationMs: r.ms,
    timedOut: r.timedOut,
    rawFile: base + '.json',
  };
}

module.exports = { runAgent, extraerJson, CLAUDE };
