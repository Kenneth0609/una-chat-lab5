# Harness de desarrollo autónomo (Parte 2)

Con **un solo comando** y **un requerimiento claro**, coordina [OpenSpec](https://github.com/Fission-AI/OpenSpec) (especificar) y
[FoFo / Agentic-SDLC](https://github.com/Sweet-Papa-Technologies/Agentic-SDLC) (el árbitro que revisa si las pruebas sirven y si el código
las pasa) con agentes de Claude Code, hasta dejar un **Pull Request con la evidencia de cada etapa**.

```bash
npm run harness -- run REQ-010      # una sesión por requerimiento (abra 3 terminales para 3 requerimientos a la vez)
npm run harness -- status           # estado de todas las ejecuciones
npm run harness -- integrate REQ-010 REQ-011 REQ-012   # fusiona las 3 ramas y corre TODAS las pruebas juntas
npm run harness -- doctor           # comprueba herramientas (git, gh, openspec, claude, python, Playwright)
npm run test:harness                # pruebas del propio harness
```

Requisitos: Node 20+, `git`, `gh` autenticado, `openspec`, `claude` con sesión iniciada (`claude auth login`) y Python 3 para los gates de FoFo
(si el `python` del PATH es solo el acceso directo de la Store, defina `HARNESS_PYTHON=<ruta a python.exe>`).
Un requerimiento nuevo: `npm run harness -- run REQ-013 --text "REQ-013: Título  Acceptance: WHEN ... THEN the system SHALL ..."`.

## Flujo (cada fase tiene una compuerta de salida; nada avanza si no pasa)

| Fase | Quién | Qué hace | Compuerta |
|------|-------|----------|-----------|
| `setup` | harness | Rama `req/REQ-NNN-…` + **git worktree propio** + `npm ci` propio + **puerto propio** (`4000 + NNN`) | la base está en verde |
| `spec` | Operador (agente) | Cambio de OpenSpec: proposal, specs con escenarios WHEN/THEN, design ("Testable interface"), tasks; dudas para negocio | `openspec validate --strict` + FoFo `spec-lint` |
| `judge` | **Juez** (sesión nueva, sin leer el código) | Escribe las 4 capas de pruebas desde la especificación: unitarias (Mocha), integración (Jest/Supertest), **BDD** (Cucumber) y E2E (Playwright) | FoFo `trace-gate`, `intent-gate`, `redgreen-gate --expect red` (rojo por aserción, no por errores) y `test-lock --write` |
| `author` | **Autor** (otra sesión; no puede editar pruebas) | Implementa hasta que las 4 suites pasen (reintentos controlados) | suites en verde |
| `verify` | FoFo `gate-runner` | `trace`, `intent`, `redgreen`, `secret-scan`, `test-lock`, `oversight-integrity`, `deps-gate`, `separation-gate`, `diff-budget` | todos los gates; fallos de pruebas vuelven al Juez, de código al Autor, de integridad a una persona |
| `review` | Revisor (ojos frescos, solo lectura) | Busca trampas, vulnerabilidades, cambios fuera de alcance | sin hallazgos altos |
| `archive` | harness | `openspec archive` (actualiza las specs principales) | solo si todo lo anterior pasó |
| `evidence` / `pr` | harness | `evidencias/REQ-NNN/` + PR con tabla de evidencia, rojo→verde y dudas para negocio | — |

**Dudas de negocio.** El Operador deja `preguntas.json`; el PR las explica en lenguaje claro (qué indica el requerimiento, qué falta definir,
cómo afecta al resultado y qué supuesto se adoptó). Si alguna es **bloqueante**, no se escriben pruebas ni código: el PR queda en **borrador**, se
reporta el bloqueo y el cambio **no se archiva**. Lo mismo ocurre si FoFo pide una decisión humana (dependencia nueva, intento de alterar el árbitro)
o si se agotan los reintentos.

## Aislamiento

- **Entre ejecuciones paralelas:** cada requerimiento tiene su rama, su worktree (`../despues-worktrees/REQ-NNN`), su `node_modules`, su puerto para BDD/E2E,
  su `test-results`/`playwright-report` y su estado (`.harness/runs/REQ-NNN/`). Las operaciones sobre el repositorio compartido (`worktree add`, `push`)
  se serializan con un bloqueo de archivo. La configuración del árbitro (`gates.config`, `policy.json`) vive **fuera** del worktree.
- **Entre roles:** cada rol es una sesión distinta de `claude -p` con permisos distintos en modo `dontAsk` (lo no permitido se deniega): el Juez no puede
  leer `public/`, `libs/`, `server.js` ni `index.html`; el Autor no puede editar `test/`, `tests/`, `openspec/`, `harness/` ni la configuración.
  `test-lock` (hashes) y `oversight-integrity` (diff) lo comprueban después. `PROVENANCE.yaml` registra qué sesión escribió las pruebas y cuál el código.
- **Para evitar conflictos al integrar:** las reglas de envío del chat son un punto de extensión (`public/validators/<regla>.js`, ver
  `harness/contracts/send-validator.md`); cada requerimiento agrega **su propio archivo**, así los PR no se pisan.

## Estado y reintentos

`.harness/runs/REQ-NNN/state.json` guarda fase, intentos, sesiones, costos, dudas y resultados (escritura atómica). Si la ejecución se corta,
`npm run harness -- run REQ-NNN` **reanuda** en la fase donde quedó; `--restart` la repite desde cero. Reintentos: especificación ×2, Juez ×3, Autor ×4,
rondas de lazo (Autor/Juez) ×2.

La revisión exige un proceso exitoso y un veredicto JSON válido `pass` sin hallazgos altos. Una interrupción o respuesta
incompleta detiene el cierre. Al reanudar un intento fallido se repiten archivo pendiente, informe y publicación,
sin omitirlos por el estado de un borrador anterior. La CLI devuelve error si la publicación falla.

La integración local final usa prioridades opcionales para las reglas: el límite de longitud tiene prioridad -10;
las otras reglas usan 0 y los empates conservan el orden alfabético. Ver `../DEMO-CLASE.md` para el ejemplo preparado.

## Estructura

```
harness/bin/sdlc.js        CLI
harness/lib/               pipeline, state, git, fofo, agent (claude -p), prompts, report, integrate, doctor
harness/prompts/           instrucciones de sistema de cada rol
harness/contracts/         contrato de la UI y de las reglas de envío (lo único que ve el Juez del frontend)
harness/requirements/      REQ-010, REQ-011, REQ-012
harness/scripts/run-suites.js   corre unit + integration + bdd + e2e (es el comando de prueba de FoFo)
harness/test/              pruebas del harness
```
