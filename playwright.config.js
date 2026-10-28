// @ts-check
// Configuracion de Playwright (paso 10): pruebas end-to-end del chat en Chromium.
//
// Frontend y backend de UNA Chat son el mismo proceso (Express sirve index.html y Socket.IO
// atiende los mensajes), asi que "npm start" levanta ambos componentes.
// Si ya hay un servidor activo en baseURL se reutiliza; si no, Playwright lo inicia con "npm start".
const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

module.exports = defineConfig({
  testDir: './tests/e2e',
  // el chat es una sala compartida (io.emit): se ejecuta en serie para que las pruebas no se mezclen
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm start',
    url: BASE_URL,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
});
