# Verificación conjunta del Laboratorio 5

Fecha local: 28 de octubre de 2026, Costa Rica. Rama: `codex/finalizacion-lab5`.
Base local: `38a46cb`. Se incorporaron los cambios de REQ-010 (`405243b`), REQ-011 (`c6f52c2`) y REQ-012 (`73f842d`)
sin crear commits ni modificar `main` durante la verificación. El usuario autorizó posteriormente crear el commit,
subir esta rama y abrir el PR de integración. La fusión hacia `main` requiere aprobación separada.

## Resultado

| Verificación | Resultado |
|---|---:|
| Unitarias Mocha | 117 aprobadas |
| Integración Jest + Supertest + Socket.IO | 42 aprobadas |
| Escenarios BDD Cucumber + navegador real | 16 aprobados |
| E2E Chromium | 27 aprobadas |
| Harness y regresiones del pipeline | 13 aprobadas |
| Demostración real contra servidor local | 5 capturas JPG generadas |
| Revisión independiente posterior | pass, sin hallazgos pendientes |

Resumen legible por herramientas: `suites.json`. Salidas completas: `unit.txt`, `integration.txt`, `bdd.txt`, `e2e.txt`.
Las pruebas originales del Juez no se editaron. Los 14 archivos de cada bloqueo histórico conservan su contenido;
las diferencias físicas de hash se deben a LF/CRLF entre checkouts de Windows. `integridad-pruebas.json` registra
la comparación contra ambas representaciones de salto de línea, sin reemplazar los bloqueos originales de FoFo.
Las pruebas de composición y las regresiones del harness son adicionales.

## Problemas encontrados y corregidos

La primera ejecución conjunta aprobó 117 unitarias, 42 de integración y 16 BDD, pero falló un E2E:
281 espacios mostraban el aviso de mensaje vacío y borraban el texto, en conflicto con REQ-012.
El usuario decidió que la longitud debía tener prioridad. Ahora esa regla corre con prioridad -10 y las demás con 0,
manteniendo el orden alfabético para empates. La ejecución final aprueba los 27 E2E, incluidos tres nuevos de composición.

El harness aceptaba una revisión sin JSON porque la transformaba en un hallazgo medio y continuaba si no había altos.
Ahora exige proceso exitoso, respuesta estructurada válida y aprobación explícita sin hallazgos altos.
Una revisión interrumpida falla antes del archivo; un rechazo válido sin correcciones accionables queda bloqueado.
La misma validación se aplica a la segunda revisión después de corregir.

La revisión independiente detectó otro fallo: al reanudar se conservaban archive=skipped e informes/PR marcados done.
Se corrigió para repetir el cierre pendiente y eliminar errores antiguos. Las regresiones reproducen la fase real
y el pipeline real con respuestas externas sustituidas; no ejecutan agentes ni crean commits.

REQ-011 ya tiene una revisión independiente válida en `../REQ-011/05b-revision-independiente.json`.
Se conserva `05-revision.json` como registro de la interrupción original.

## Dependencias y límites

`npm audit` final: 0 críticas, 0 altas, 5 bajas. Snyk con dependencias de desarrollo vuelve a reportar
un hallazgo alto de ReDoS en picomatch y uno medio en deepmerge, ambos por Jest y sin actualización ni parche disponible.
La ejecución de Snyk sale con código 1 por esos hallazgos; no se presenta como un escaneo limpio.
Snyk de producción sí sale con código 0: 82 dependencias y ninguna ruta vulnerable (`../snyk-final-produccion.json`).
Ver `../snyk-final-dev.json`, `../npm-audit-final.json` y `../../SEGURIDAD-DEPENDENCIAS.md`.

Los gates FoFo originales en `evidencias/REQ-*/04-gates.json` corresponden a cada ejecución aislada.
Este informe registra pruebas y revisión de la composición local; no afirma una nueva ejecución conjunta de todos los gates.
Este informe registra la verificación previa a publicar. El PR de integración de esta rama contiene el resultado;
los tres PR originales conservan las evidencias de sus ejecuciones independientes.
El cambio de finalización fue validado y archivado en `openspec/changes/archive/2026-10-28-finalize-lab5-integration/`;
las seis especificaciones mantenidas pasan `openspec validate --specs --strict`.

## Reproducir

```bash
npm ci
npx playwright install chromium
npm run test:harness
npm run test:all
npm run demo
openspec validate --specs --strict
```
