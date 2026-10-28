'use strict';
// Informe de la ejecucion (evidencias/<REQ>/informe.md) y descripcion del Pull Request.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cfg } = require('./config');
const { which } = require('./proc');

const GIT = which('git') || 'git';
const g = (cwd, args) => { try { return execFileSync(GIT, args, { cwd, encoding: 'utf8' }).trim(); } catch { return ''; } };

function urlRepo(cwd) {
  const r = g(cwd, ['remote', 'get-url', cfg.remote]).replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
  return r;
}

const dur = (a, b) => (a && b ? `${Math.round((new Date(b) - new Date(a)) / 1000)} s` : '-');
const celda = (t) => String(t == null ? '' : t).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function tablaFases(d) {
  const nombres = { setup: 'Preparación (rama, worktree, puerto, dependencias)', spec: 'Especificación (OpenSpec)', judge: 'Pruebas del Juez en rojo (FoFo)', author: 'Implementación del Autor', verify: 'Verificación (gates de FoFo)', review: 'Revisión de ojos frescos', archive: 'Archivo del cambio (OpenSpec)', evidence: 'Evidencia', pr: 'Pull Request' };
  const filas = Object.entries(d.phases).map(([k, f]) => `| ${nombres[k] || k} | ${f.status} | ${dur(f.startedAt, f.endedAt)} | ${celda(f.error || f.reason || '')} |`);
  return ['| Etapa | Estado | Duración | Nota |', '|---|---|---|---|', ...filas].join('\n');
}

function tablaSuites(d) {
  const mapa = (arr) => Object.fromEntries((arr || []).map((s) => [s.suite, s]));
  const rojo = mapa(d.rojo);
  const verde = mapa(d.verde);
  const filas = ['unit', 'integration', 'bdd', 'e2e'].map((k) => {
    const r = rojo[k];
    const v = verde[k];
    const titulo = (r || v || {}).titulo || k;
    return `| ${titulo} | ${r ? `${r.failed} fallan / ${r.passed} pasan` : '-'} | ${v ? `${v.failed} fallan / ${v.passed} pasan` : '-'} |`;
  });
  return ['| Suite | Antes (rojo, solo pruebas del Juez) | Después (verde, con la implementación) |', '|---|---|---|', ...filas].join('\n');
}

function tablaGates(d) {
  if (!d.gates || !d.gates.length) return '_Los gates no llegaron a ejecutarse._';
  return ['| Gate de FoFo | Resultado | Detalle |', '|---|---|---|', ...d.gates.map((x) => `| ${x.gate} | ${x.status} | ${celda(x.summary)} |`)].join('\n');
}

function dudas(d) {
  const qs = d.questions || [];
  if (!qs.length) return '_No quedaron dudas pendientes para negocio._';
  return qs.map((q, i) => [
    `**${i + 1}. ${q.pregunta}**${q.bloqueante ? '  🚧 _BLOQUEANTE_' : ''}`,
    `- **Qué indica el requerimiento:** ${q.que_dice_el_requerimiento}`,
    `- **Qué falta definir:** ${q.que_falta_definir}`,
    `- **Cómo afecta al resultado:** ${q.como_afecta}`,
    `- **Supuesto adoptado mientras tanto:** ${q.supuesto_adoptado}`,
  ].join('\n')).join('\n\n');
}

function escribirInforme(ctx) {
  const { run, wt, ev } = ctx;
  const d = run.data;
  const base = d.testsCommit || cfg.baseBranch;
  const stat = g(wt, ['diff', '--stat', `${cfg.baseBranch}...HEAD`, '--', ':!evidencias', ':!openspec']);
  const sesiones = Object.entries(d.sessions).map(([rol, ids]) => `- **${rol}**: ${ids.map((i) => '`' + i + '`').join(', ')}`).join('\n');
  const md = `# Informe de ejecución del harness — ${ctx.req}: ${ctx.info.title}

- **Resultado:** ${d.outcome === 'ready' ? 'listo para integrar' : d.outcome === 'blocked' ? 'BLOQUEADO (requiere decisión humana)' : 'verificación incompleta'}${d.blockReason ? `\n- **Motivo:** ${d.blockReason}` : ''}
- **Rama:** \`${ctx.branch}\` · **Worktree:** \`${d.worktree}\` · **Puerto de pruebas:** ${ctx.port}
- **Costo de los agentes:** $${d.costUsd.toFixed(2)} · **Intentos:** ${Object.entries(d.attempts).map(([k, v]) => `${k}=${v}`).join(', ')}

## Etapas
${tablaFases(d)}

## Aislamiento entre roles
Cada rol corrió en su **propia sesión** de Claude Code con permisos distintos (modo \`dontAsk\`):
${sesiones}

- El Juez no podía leer \`public/\`, \`libs/\`, \`server.js\` ni \`index.html\`, y solo escribir sus archivos de prueba.
- El Autor no podía editar pruebas, \`openspec/\`, \`harness/\` ni la configuración (y \`test-lock\`/\`oversight-integrity\` lo verifican con hashes y diff).
- Acciones denegadas por el sistema de permisos durante la ejecución: ${(d.denials || []).length}${(d.denials || []).length ? '\n' + (d.denials || []).slice(0, 12).map((x) => `  - ${x}`).join('\n') : ''}

## Pruebas: rojo → verde
${tablaSuites(d)}

## Gates de FoFo (resultado global: ${d.gatesOverall || 'sin ejecutar'})
${tablaGates(d)}

## Revisión de ojos frescos
${d.review ? `Veredicto **${d.review.verdict}**: ${d.review.summary}` : '_No se ejecutó._'}

## Dudas para negocio
${dudas(d)}

## Cambios en el código (sin pruebas ni especificaciones)
\`\`\`
${stat || '(sin cambios de código)'}
\`\`\`

_Commit de las pruebas bloqueadas: \`${(d.testsCommit || '').slice(0, 7)}\` · Commit de la implementación: \`${(d.codeCommit || '').slice(0, 7)}\`_
`;
  fs.writeFileSync(path.join(ctx.evAbs, 'informe.md'), md);
  fs.writeFileSync(path.join(ctx.evAbs, 'preguntas-negocio.md'), `# Dudas para negocio — ${ctx.req}\n\n${dudas(d)}\n`);
}

function cuerpoPr(ctx, { draft }) {
  const { run, wt, ev } = ctx;
  const d = run.data;
  const raw = urlRepo(wt);
  const blob = (rel) => `${raw}/blob/${ctx.branch}/${rel}`;
  const tree = (rel) => `${raw}/tree/${ctx.branch}/${rel}`;
  const estado = d.outcome === 'ready'
    ? '✅ **Listo para integrar.** Especificación validada, pruebas independientes en rojo → verde, gates de FoFo en verde y cambio archivado en OpenSpec.'
    : d.outcome === 'blocked'
      ? `🚧 **BORRADOR — bloqueado.** ${d.blockReason}\n\nEl cambio **no se archivó** en OpenSpec. Ver las dudas para negocio más abajo.`
      : `⚠️ **BORRADOR — verificación incompleta.** ${d.blockReason || ''}\n\nEl cambio **no se archivó** en OpenSpec.`;
  const archivada = fs.existsSync(path.join(wt, 'openspec', 'changes', 'archive'))
    ? fs.readdirSync(path.join(wt, 'openspec', 'changes', 'archive')).find((x) => x.endsWith(ctx.change)) : null;
  const specRel = archivada ? `openspec/changes/archive/${archivada}` : `openspec/changes/${ctx.change}`;
  const arch = d.judgeFiles || {};
  const lista = (a) => (a || []).map((f) => `[\`${f}\`](${blob(f)})`).join(', ') || '-';
  const stat = g(wt, ['diff', '--stat', `${cfg.baseBranch}...HEAD`, '--', ':!evidencias', ':!openspec', ':!test', ':!tests']);
  const archivosSrc = g(wt, ['diff', '--name-only', `${cfg.baseBranch}...HEAD`, '--', 'public', 'libs', 'server.js', 'index.html']).split('\n').filter(Boolean);
  const reglas = archivosSrc.filter((f) => f.startsWith('public/validators/'));

  return `## ${ctx.req}: ${ctx.info.title}

${estado}

### Qué pide el requerimiento
> ${ctx.info.acceptance}

### Evidencia de cada etapa
| # | Etapa | Qué pasó | Evidencia |
|---|---|---|---|
| 1 | **Especificación (OpenSpec)** | Cambio \`${ctx.change}\` con proposal, specs (escenarios WHEN/THEN), design y tasks; \`openspec validate --strict\` en verde; ${(d.questions || []).length} duda(s) para negocio | [\`${specRel}\`](${tree(specRel)}) |
| 2 | **Pruebas independientes (Juez, sesión propia)** | Las 4 capas se escribieron **antes** del código, desde la especificación, sin leer la implementación. Rojo verificado y archivos bloqueados con \`test-lock\` | [\`${ev}/02-rojo/\`](${tree(ev + '/02-rojo')}) · [TEST-REQS](${blob(ev + '/TEST-REQS.yaml')}) |
| 3 | **Implementación (Autor, otra sesión)** | ${d.attempts.author || 0} intento(s); no puede editar las pruebas; suites en verde | [\`${ev}/03-verde/\`](${tree(ev + '/03-verde')}) |
| 4 | **Verificación (FoFo gate-runner)** | Resultado global: **${d.gatesOverall || 'sin ejecutar'}** | [\`04-gates.json\`](${blob(ev + '/04-gates.json')}) |
| 5 | **Revisión de ojos frescos** | ${d.review ? `${d.review.verdict}: ${d.review.summary}` : 'no se ejecutó'} | [\`05-revision.json\`](${blob(ev + '/05-revision.json')}) |
| 6 | **Archivo del cambio** | ${d.outcome === 'ready' ? 'Archivado y specs principales actualizadas' : 'NO archivado'} | [\`06-openspec-archive.txt\`](${blob(ev + '/06-openspec-archive.txt')}) |
| 7 | **Informe completo** | Tiempos, sesiones, costos e intentos | [\`informe.md\`](${blob(ev + '/informe.md')}) |

### Pruebas: rojo → verde
${tablaSuites(d)}

Archivos de prueba — unitarias: ${lista(arch.unit)} · integración: ${lista(arch.integration)} · BDD: ${lista(arch.bdd)}${arch.steps && arch.steps.length ? ' (pasos: ' + lista(arch.steps) + ')' : ''} · E2E (Playwright): ${lista(arch.e2e)}

### Gates de FoFo
${tablaGates(d)}

### Dudas pendientes para negocio
${dudas(d)}

### Notas de integración
- Código que cambia: ${archivosSrc.length ? archivosSrc.map((f) => '`' + f + '`').join(', ') : '_ninguno_'}.
- ${reglas.length ? `La regla vive en su **propio archivo** (${reglas.map((f) => '`' + f + '`').join(', ')}), así que no choca con las de los otros requerimientos. Las reglas corren en **orden alfabético** de archivo; si varias fallan a la vez, gana la primera (ver dudas).` : 'Sin reglas nuevas en `public/validators/`.'}
- Para comprobar que los requerimientos funcionan **juntos** antes de fusionar: \`npm run harness -- integrate REQ-010 REQ-011 REQ-012\`.
\`\`\`
${stat || ''}
\`\`\`

### Datos de la ejecución
Rama \`${ctx.branch}\` · puerto aislado ${ctx.port} · sesiones: ${Object.entries(d.sessions).map(([r, ids]) => `${r}=${ids.length}`).join(', ')} · costo de agentes $${d.costUsd.toFixed(2)}${draft ? '\n\n> Este PR queda como **borrador** a propósito: no debe fusionarse hasta resolver lo indicado arriba.' : ''}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
`;
}

module.exports = { escribirInforme, cuerpoPr };
