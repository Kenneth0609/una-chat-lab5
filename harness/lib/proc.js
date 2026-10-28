'use strict';
// Utilidades de procesos: ejecutar comandos con tiempo limite, ubicar herramientas y bloqueos entre ejecuciones.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WIN = process.platform === 'win32';

// Busca un ejecutable en el PATH (respeta PATHEXT en Windows). Devuelve la ruta o null.
function which(nombre) {
  const exts = WIN ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of (WIN ? [...exts, ''] : [''])) {
      const p = path.join(dir, nombre + ext);
      try { if (fs.statSync(p).isFile()) return p; } catch { /* siguiente */ }
    }
  }
  return null;
}

function quote(arg) {
  if (/^[\w@%+=:,./\\-]+$/.test(arg)) return arg;
  return '"' + String(arg).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
}

// Ejecuta un comando. Si es un .cmd/.bat (npm, openspec) lo lanza a traves de cmd.exe.
// opts: cwd, env, input, timeoutMs, logFile, tee (replica la salida con prefijo)
function exec(cmd, args = [], opts = {}) {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const esShim = WIN && /\.(cmd|bat)$/i.test(cmd);
    const env = Object.assign({}, process.env, opts.env || {});
    delete env.NO_COLOR; // Playwright avisa cuando conviven NO_COLOR y FORCE_COLOR
    let hijo;
    if (esShim) {
      hijo = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', '"' + [quote(cmd), ...args.map(quote)].join(' ') + '"'], {
        cwd: opts.cwd, env, windowsVerbatimArguments: true, stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      hijo = spawn(cmd, args, { cwd: opts.cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    }
    let out = '';
    let err = '';
    let timedOut = false;
    const log = opts.logFile ? fs.createWriteStream(opts.logFile, { flags: 'a' }) : null;
    const emitir = (flujo, texto) => {
      if (log) log.write(texto);
      if (opts.tee) {
        for (const linea of texto.split(/\r?\n/)) if (linea.length) opts.tee(linea, flujo);
      }
    };
    hijo.stdout.on('data', (d) => { const s = d.toString(); out += s; emitir('out', s); });
    hijo.stderr.on('data', (d) => { const s = d.toString(); err += s; emitir('err', s); });
    const temporizador = opts.timeoutMs
      ? setTimeout(() => { timedOut = true; matar(hijo); }, opts.timeoutMs)
      : null;
    hijo.on('error', (e) => { err += String(e); });
    hijo.on('close', (code) => {
      if (temporizador) clearTimeout(temporizador);
      if (log) log.end();
      resolve({ code: timedOut ? 124 : code, out, err, timedOut, ms: Date.now() - inicio });
    });
    if (opts.input != null) hijo.stdin.write(opts.input);
    hijo.stdin.end();
  });
}

function matar(hijo) {
  try {
    if (WIN) spawn('taskkill', ['/pid', String(hijo.pid), '/t', '/f'], { stdio: 'ignore' });
    else hijo.kill('SIGKILL');
  } catch { /* ya termino */ }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Exclusion mutua entre sesiones del harness (por ejemplo git worktree add / push). Basada en mkdir.
async function conBloqueo(dirBloqueos, nombre, fn, { esperaMs = 180000, viejoMs = 300000 } = {}) {
  fs.mkdirSync(dirBloqueos, { recursive: true });
  const dir = path.join(dirBloqueos, nombre + '.lock');
  const limite = Date.now() + esperaMs;
  for (;;) {
    try {
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'owner'), `${process.pid} ${os.hostname()} ${new Date().toISOString()}`);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(dir).mtimeMs > viejoMs) { fs.rmSync(dir, { recursive: true, force: true }); continue; } } catch { /* sigue */ }
      if (Date.now() > limite) throw new Error(`No se obtuvo el bloqueo '${nombre}'`);
      await dormir(250 + Math.random() * 250);
    }
  }
  try { return await fn(); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

module.exports = { WIN, which, exec, quote, dormir, conBloqueo };
