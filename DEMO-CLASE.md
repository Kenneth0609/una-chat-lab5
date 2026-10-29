# Demostración del Laboratorio 5

Repositorio: https://github.com/Kenneth0609/una-chat-lab5

## Preparación

Usar la rama `codex/finalizacion-lab5`, que contiene la integración propuesta para `main`.
Desde la carpeta `despues`, ejecutar `npm ci` y `npx playwright install chromium` en una máquina nueva.

## Ejemplo rápido

Ejecutar `npm run demo -- --headed`. Se abre Chromium, se prueban los tres requisitos contra el servidor real,
se comprueba su resultado y se guardan cinco capturas JPG en `evidencias/demo/`. El script cierra navegador y servidor.
La demostración usa un puerto libre y no requiere credenciales, Claude ni llamadas a servicios externos.
Para explicarlo manualmente con más calma: `npm start`, abrir `http://localhost:3000` y repetir los casos siguientes.

| Caso | Entrada | Resultado |
|---|---|---|
| REQ-010 | Nombre Ana, mensaje vacío o tres espacios | No publica, limpia mensaje y pide escribir algo |
| REQ-011 | Nombre vacío, mensaje Hola clase | No publica, limpia nombre, conserva mensaje y pide nombre |
| REQ-012 | Nombre Ana, texto de 281 caracteres | No publica, conserva texto y avisa longitud |
| Superposición | Nombre Ana, 281 espacios | Conserva texto y avisa longitud, según decisión del usuario |
| Corrección | Nombre Ana, mensaje corto | Publica una sola vez y borra el aviso |

## Explicación del harness

Enseñar `harness/README.md` y los PR: [REQ-010](https://github.com/Kenneth0609/una-chat-lab5/pull/2),
[REQ-011](https://github.com/Kenneth0609/una-chat-lab5/pull/3), [REQ-012](https://github.com/Kenneth0609/una-chat-lab5/pull/1).
Cada ejecución usa rama, worktree, puerto y sesiones por rol propios. OpenSpec define comportamiento;
el Juez escribe pruebas sin leer implementación; el Autor implementa sin editar pruebas; FoFo verifica trazabilidad,
intención, hashes y separación. El revisor comprueba el resultado antes de archivar.

Mostrar en `evidencias/REQ-010/` las carpetas `02-rojo`, `03-verde`, `04-gates.json` y el archivo `informe.md`.
Los resultados individuales se preservan y la ejecución conjunta tiene su propia carpeta `evidencias/integracion/`.

## Qué ocurrió al completar el trabajo

Las tres sesiones generaron los tres PR. La revisión de REQ-011 se interrumpió por el límite de Claude y el harness
la había aceptado incorrectamente; se corrigió para exigir aprobación estructurada válida. También se corrigió
la reanudación para que un intento fallido no deje omitidos el archivo y la actualización del informe.
La integración encontró un caso que las ramas aisladas no detectaban: 281 espacios activaban dos reglas incompatibles.
Se consultó al usuario y se dio prioridad al límite, conservando las pruebas originales del Juez.

No volver a ejecutar el pipeline completo durante la exposición: necesita credenciales y puede crear commits y publicar PR.
`npm run harness -- status` muestra el historial local; `npm run test:all` vuelve a verificar la integración sin agentes.
Los estados históricos no sustituyen la revisión posterior ni representan una nueva publicación.
