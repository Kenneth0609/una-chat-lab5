# Evidencias del laboratorio

| Archivo | Contenido |
|---------|-----------|
| `evidencia1.jpg` | Paso 2/3: el `alert` se ejecuta con el proyecto **original** (`antes/`): vulnerable a inyeccion de scripts |
| `evidencia2.jpg` | Paso 8: pruebas unitarias (`npm test`, 97 pruebas) |
| `evidencia3.jpg` | Paso 9: pruebas de integracion (`npx jest tests/integration --runInBand --env=node`, 27 pruebas) |
| `evidencia4.jpg` | Paso 10: pruebas end-to-end (`npx playwright test --project=chromium --headed`, 10 pruebas) |
| `extras/chat-funcionando.jpg` | El chat corregido mostrando texto, imagen, video y el script bloqueado |
| `extras/reporte-playwright.jpg` | Reporte HTML de Playwright (`npx playwright show-report`) |
| `snyk-antes.txt`, `snyk-despues*.txt`, `npm-audit-antes.txt` | Salidas del escaneo de dependencias (ver `../SEGURIDAD-DEPENDENCIAS.md`) |

Las capturas 1 a 4 son capturas reales de pantalla (ventana de Windows Terminal / navegador Chromium).
Corresponden a la Parte 1 original y se conservan sin reemplazarlas por los resultados de la Parte 2.

La verificación conjunta posterior está en `integracion/informe.md`: 117 unitarias, 42 de integración,
16 escenarios BDD, 27 E2E y 13 pruebas del harness. `demo/` contiene cinco JPG reales nuevos de la
demostración automatizada. Los escaneos finales están en `snyk-final-produccion.json`, `snyk-final-dev.json`
y `npm-audit-final.json`; Snyk de desarrollo conserva un hallazgo alto sin parche disponible.
