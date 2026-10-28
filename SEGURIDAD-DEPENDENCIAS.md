# Escaneo de vulnerabilidades en dependencias (paso 11)

Herramienta: **Snyk CLI** (`snyk test`, con la cuenta autenticada mediante `snyk auth`).
La reparación la hizo un agente de IA (Claude Code) y después se volvieron a ejecutar las tres suites de pruebas.

## Antes (proyecto original, `antes/`)

```bash
cd antes && npm ci && npx snyk test
```

`Tested 147 dependencies for known issues, found 55 issues, 77 vulnerable paths.`

| Severidad | Cantidad |
|-----------|---------:|
| Crítica   | 1 (`proxy-addr@2.0.7`, User Impersonation) |
| Alta      | 31 (`qs`, `body-parser`, `brace-expansion`, `minimatch`, `serialize-javascript`, `braces`, `picomatch`, `js-yaml`, `nanoid`, `engine.io`, ...) |
| Media     | 18 |
| Baja      | 6 |

Salida completa: [`evidencias/snyk-antes.txt`](evidencias/snyk-antes.txt).
(`npm audit` del mismo proyecto: 22 vulnerabilidades, 1 crítica y 16 altas.)

## Reparación

1. `package.json` usaba `"express": "*"` y `"socket.io": "*"`, pero el `package-lock.json` entregado fijaba
   versiones viejas (express 4.18.2, socket.io 4.7.2). `npm audit fix` actualizó las transitivas
   (`proxy-addr`, `qs`, `body-parser`, `path-to-regexp`, `engine.io`, `ws`, `socket.io-parser`, ...).
2. `mocha` quedaba con `serialize-javascript` vulnerable (alta, ejecución de código por `RegExp.flags`):
   se actualizó a `mocha@^12.0.3`.
3. Se reemplazaron los comodines `*` por rangos explícitos: `express@^5.3.0` y `socket.io@^4.8.4`.
4. `mocha` pasó a `devDependencies` (no se usa en producción).
5. Se eliminó jQuery 1.11.1 (cargado desde un CDN, con XSS conocidos) y el cliente de Socket.IO ya no viene de un CDN.

## Después

```bash
npx snyk test              # dependencias de produccion
npx snyk test --dev        # produccion + desarrollo (Jest, Playwright, Mocha, ...)
```

| Comando | Resultado |
|---------|-----------|
| `snyk test` | `Tested 82 dependencies for known issues, no vulnerable paths found.` |
| `snyk test --dev` | 417 dependencias, 2 hallazgos (ver abajo) |
| `npm audit` | 0 críticas, 0 altas, 5 bajas |

Salidas: [`evidencias/snyk-despues.txt`](evidencias/snyk-despues.txt) y
[`evidencias/snyk-despues-dev.txt`](evidencias/snyk-despues-dev.txt).

### Pendiente que no se puede reparar todavía (solo desarrollo)

Con `--dev` Snyk reporta dos hallazgos que vienen de **Jest 30** (herramienta de pruebas, no se instala en producción):

- `deepmerge@4.3.1` (media, prototype pollution): sin versión corregida publicada.
- `picomatch` (alta, ReDoS, SNYK-JS-PICOMATCH-21248802): Snyk indica *"No upgrade or patch available"*; la última
  versión publicada es la 4.0.7 y también está afectada. Jest lo usa para emparejar rutas de archivos propios del proyecto,
  no recibe patrones de usuarios ni de la red.

Se deja documentado y se revisará cuando exista una versión corregida (`npm audit fix` / `snyk test --dev`).

## Pruebas después de reparar

| Suite | Resultado |
|-------|-----------|
| Unitarias (`npm test`, Mocha 12) | 97 pasan |
| Integración (`npx jest tests/integration --runInBand --env=node`) | 27 pasan |
| End-to-end (`npx playwright test --project=chromium`) | 10 pasan |
