'use strict';
// Prompts y permisos de cada rol. Los permisos son la parte "dura" del aislamiento entre roles:
// el CLI los hace cumplir (modo dontAsk), no dependen de que el modelo se porte bien.
const fs = require('fs');
const path = require('path');
const { cfg } = require('./config');

const sistema = (nombre) => fs.readFileSync(path.join(cfg.repo, 'harness', 'prompts', nombre + '.system.md'), 'utf8').trim();

const BASH_PRUEBAS = [
  'Bash(node harness/scripts/run-suites.js:*)', 'Bash(npm run test:*)', 'Bash(npx mocha:*)',
  'Bash(npx jest:*)', 'Bash(npx cucumber-js:*)', 'Bash(npx playwright test:*)',
];
const LECTURA = ['Read', 'Glob', 'Grep'];

const PREGUNTAS_SCHEMA = `[
  {
    "id": "Q1",
    "pregunta": "Duda en lenguaje claro para una persona de negocio (1-2 frases, sin jerga tecnica)",
    "que_dice_el_requerimiento": "que indica exactamente el texto",
    "que_falta_definir": "que dato o decision no esta en el texto",
    "como_afecta": "que cambia en el resultado segun la respuesta",
    "supuesto_adoptado": "lo que se implemento mientras tanto",
    "bloqueante": false
  }
]`;

function spec(ctx) {
  const { req, info, change, ev } = ctx;
  return {
    role: 'spec',
    system: sistema('spec'),
    allowed: [...LECTURA, 'Bash(openspec:*)', 'Edit(./openspec/changes/**)', `Edit(./${ev}/preguntas.json)`],
    denied: ['Edit(./public/**)', 'Edit(./libs/**)', 'Edit(./server.js)', 'Edit(./test/**)', 'Edit(./tests/**)', 'Edit(./harness/**)'],
    task: `# Tarea: especificar ${req} con OpenSpec

Requerimiento (texto aprobado e inmutable):

> ${info.raw.replace(/\n/g, '\n> ')}

Nombre del cambio de OpenSpec: **${change}** (usalo exactamente asi).

Pasos:
1. \`openspec new change ${change} --description "${req}: ${info.title}"\`
2. Para cada artefacto, en este orden: proposal, specs, design, tasks, ejecuta
   \`openspec instructions <artefacto> --change ${change} --json\`, sigue sus instrucciones y escribe el archivo en \`openspec/changes/${change}/\`.
3. **specs**: una capability propia y especifica de este requerimiento (kebab-case, p. ej. "empty-message-validation"), solo con
   \`## ADDED Requirements\`. Redacta cada requisito con SHALL y menciona ${req} en su texto. Escribe escenarios \`#### Scenario:\`
   con \`- **WHEN** ...\` / \`- **THEN** ...\` que cubran CADA clausula de la aceptacion y sus bordes (solo espacios, tabulaciones,
   limite exacto, etc.).
4. **design.md** debe incluir la seccion "Testable interface" con: la ruta del archivo nuevo en \`public/validators/\` (nombre unico para este
   requerimiento), el contrato \`validate(ctx)\` (lee \`harness/contracts/send-validator.md\`), los textos EXACTOS de los avisos (espanol),
   los valores de \`campo\` y \`limpiar\`, y lo que queda FUERA de alcance (por ejemplo validar tambien en el servidor) con el motivo.
5. **tasks.md**: checklist para quien implemente (sin tocar pruebas).
6. \`openspec validate ${change} --strict\` hasta que pase.
7. Escribe \`${ev}/preguntas.json\`: un arreglo con las dudas que negocio deberia resolver (puede ser vacio \`[]\`). Esquema:
\`\`\`json
${PREGUNTAS_SCHEMA}
\`\`\`
   Marca \`"bloqueante": true\` SOLO si no existe un supuesto razonable y elegir mal haria que el comportamiento sea incorrecto.
   Las dudas de redaccion, idioma, orden entre avisos o casos limite con un supuesto sensato NO son bloqueantes.

Antes de disenar, lee el codigo actual (\`public/\`, \`server.js\`, \`index.html\`) y \`harness/contracts/*.md\` para que la solucion encaje.
No modifiques nada fuera de \`openspec/changes/${change}/\` y \`${ev}/preguntas.json\`.

Respuesta final (obligatoria):
\`\`\`json
{"change":"${change}","capabilities":["..."],"design_file":"public/validators/<archivo>.js","questions":0,"blocking":false}
\`\`\``,
  };
}

function judge(ctx, { retroalimentacion, escalacion } = {}) {
  const { req, info, change, ev, port } = ctx;
  const r = req.toLowerCase();
  return {
    role: 'judge',
    system: sistema('judge'),
    allowed: [
      ...LECTURA, ...BASH_PRUEBAS,
      `Edit(./test/${r}*)`, `Edit(./tests/integration/${r}*)`, `Edit(./tests/e2e/${r}*)`,
      `Edit(./tests/bdd/features/${r}*)`, `Edit(./tests/bdd/steps/${r}*)`, `Edit(./${ev}/TEST-REQS.yaml)`,
    ],
    denied: ['Read(./public/**)', 'Read(./libs/**)', 'Read(./server.js)', 'Read(./index.html)', 'Read(./.harness/**)', 'Edit(./public/**)', 'Edit(./libs/**)'],
    task: `# Tarea: escribir las pruebas de ${req} (rojo, antes de que exista el codigo)

Requerimiento:
> ${info.raw.replace(/\n/g, '\n> ')}

Fuentes que SI puedes leer: \`openspec/changes/${change}/\` (proposal, specs, design, tasks), \`harness/contracts/*.md\`, las pruebas existentes
como ejemplo de estilo, \`playwright.config.js\`, \`cucumber.js\`.
NO puedes leer \`public/\`, \`libs/\`, \`server.js\` ni \`index.html\`: el permiso esta bloqueado (aprende del contrato, no del codigo).
${escalacion ? `\n## Revision pedida\nEl Autor sostiene que esta prueba es incorrecta. No ves su razonamiento, solo la reclamacion:\n${escalacion}\nRevisa si la prueba contradice la especificacion; corrigela SOLO si realmente la contradice y explicalo en la respuesta final.\n` : ''}${retroalimentacion ? `\n## Problemas encontrados en tu entrega anterior (corrigelos)\n${retroalimentacion}\n` : ''}
Entregables (nombres EXACTOS):
1. \`${ev}/TEST-REQS.yaml\` — mapa ${req} -> intenciones de prueba, una linea por escenario de la especificacion:
   \`\`\`yaml
   ${req}:
     - intent: "<que comportamiento verifica>"
   \`\`\`
2. Unitarias (Mocha + assert): \`test/${r}.unit.test.js\` — pruebas de la regla de envio descrita en design.md ("Testable interface"), importando el modulo con \`require\`.
3. Integracion (Jest + Supertest): \`tests/integration/${r}.test.js\` — integra el servidor real con la regla: por ejemplo, \`GET /validators.js\`
   evaluado en un sandbox \`vm\` con un \`UNAChat\` de mentira que registre las reglas, y/o el flujo del evento Socket.IO. Sigue el estilo de \`tests/integration/chat.test.js\`.
4. BDD (Gherkin): \`tests/bdd/features/${r}.feature\` (un escenario por escenario WHEN/THEN de la especificacion, con ${req} en el nombre) y, solo para los
   pasos que NO existan ya en \`tests/bdd/support/common.steps.js\`, \`tests/bdd/steps/${r}.steps.js\` (texto de paso propio, sin duplicar pasos comunes).
5. End-to-end (Playwright): \`tests/e2e/${r}.spec.js\` — recorrido real en Chromium con \`page.goto('/')\`, \`getByRole\`, \`fill\`, \`click\`, \`expect\`.

Reglas:
- Cada prueba, escenario o titulo incluye \`${req}\`.
- Sin dependencias de internet (no uses URLs externas), deterministas, sin \`waitForTimeout\` largos.
- No modifiques ni borres pruebas existentes.
- En las pruebas unitarias haz el \`require\` del modulo nuevo DENTRO de un \`before\`/\`it\` (nunca al inicio del archivo): un \`require\` que falla al
  cargar aborta todo Mocha y taparia las pruebas existentes. Que el modulo aun no exista es el rojo esperado.
- Para comprobar que corren y que fallan por la razon correcta usa \`PORT=${port} node harness/scripts/run-suites.js --only unit\` (y \`integration\`, \`bdd\`, \`e2e\`).
  Deben fallar por ASERCION (falta la funcionalidad), nunca por sintaxis, imports ni pasos indefinidos.

Respuesta final (obligatoria):
\`\`\`json
{"files":["..."],"scenarios":[{"scenario":"nombre del escenario","tests":["archivo: titulo de la prueba"]}]}
\`\`\``,
  };
}

function author(ctx, { retroalimentacion, nota } = {}) {
  const { req, info, change, ev, port } = ctx;
  const inicial = !retroalimentacion;
  return {
    role: 'author',
    system: sistema('author'),
    allowed: [
      ...LECTURA, ...BASH_PRUEBAS, 'Edit(./public/**)', 'Edit(./libs/**)', 'Edit(./server.js)', 'Edit(./index.html)',
      `Edit(./${ev}/author-escalation.md)`,
    ],
    denied: [
      'Edit(./test/**)', 'Edit(./tests/**)', 'Edit(./openspec/**)', 'Edit(./harness/**)', 'Edit(./package.json)',
      'Edit(./package-lock.json)', 'Edit(./playwright.config.js)', 'Edit(./cucumber.js)', 'Edit(./.claude/**)',
    ],
    task: inicial ? `# Tarea: implementar ${req} para que pasen las pruebas del Juez

Requerimiento:
> ${info.raw.replace(/\n/g, '\n> ')}

Lee \`openspec/changes/${change}/\` (specs, design.md con "Testable interface", tasks.md), el contrato \`harness/contracts/send-validator.md\`
y las pruebas del Juez (\`test/${req.toLowerCase()}*\`, \`tests/**/${req.toLowerCase()}*\`). Las pruebas estan BLOQUEADAS: no las puedes cambiar.
Implementa solo lo necesario (normalmente un archivo nuevo en \`public/validators/\`). Ejecuta
\`PORT=${port} node harness/scripts/run-suites.js\` hasta que las cuatro suites pasen.
Si crees que una prueba contradice la especificacion, escribe \`${ev}/author-escalation.md\` (que prueba, que dice, por que es incorrecta) y termina.

Respuesta final (obligatoria):
\`\`\`json
{"files_changed":["..."],"summary":"que hiciste","suites_green":true}
\`\`\`` : `# Continuacion: las verificaciones siguen fallando

${nota || ''}
${retroalimentacion}

Corrige el CODIGO (no las pruebas), vuelve a ejecutar \`PORT=${port} node harness/scripts/run-suites.js\` y responde con el mismo bloque JSON.`,
  };
}

function review(ctx, { baseCommit }) {
  const { req, info, change } = ctx;
  return {
    role: 'review',
    system: sistema('review'),
    allowed: [...LECTURA, 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git status:*)', 'Bash(git ls-files:*)'],
    denied: ['Edit(./**)'],
    task: `# Tarea: revision de ojos frescos de ${req}

Requerimiento:
> ${info.raw.replace(/\n/g, '\n> ')}

Especificacion: \`openspec/changes/${change}/\`. Codigo nuevo: \`git diff ${baseCommit}..HEAD -- public libs server.js index.html\`.
Pruebas del Juez: \`git diff ${cfg.baseBranch}..${baseCommit} --stat\` y los archivos \`*${req.toLowerCase()}*\`.

Responde SOLO con:
\`\`\`json
{"verdict":"pass|fail","summary":"1-2 frases","findings":[{"severity":"low|med|high","route":"code|tests","location":"archivo:linea","detail":"..."}]}
\`\`\`
Usa "fail" solo si hay al menos un hallazgo "high" (trampa, vulnerabilidad, aceptacion no cubierta o regresion).`,
  };
}

module.exports = { spec, judge, author, review, PREGUNTAS_SCHEMA };
