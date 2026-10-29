#!/usr/bin/env node
'use strict';
// Demostracion reproducible de los tres requisitos, sin agentes ni servicios externos.
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const { http, io } = require('../../server');

(async () => {
  const dir = path.resolve(__dirname, '../../evidencias/demo');
  fs.mkdirSync(dir, { recursive: true });
  let browser;
  try {
    await new Promise((resolve, reject) => { http.once('error', reject); http.listen(0, '127.0.0.1', resolve); });
    browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${http.address().port}`);
    const nombre = page.getByRole('textbox', { name: 'Username' });
    const mensaje = page.getByRole('textbox', { name: 'Escriba un mensaje' });
    const enviar = page.getByRole('button', { name: 'Send' });
    const casos = [
      { id: 'REQ-010', nombre: 'Ana', mensaje: '   ', aviso: 'Escribe un mensaje', conservado: '' },
      { id: 'REQ-011', nombre: '   ', mensaje: 'Hola clase', aviso: 'nombre', conservado: 'Hola clase' },
      { id: 'REQ-012', nombre: 'Ana', mensaje: 'Mensaje para demostrar el limite de longitud. '.repeat(7), aviso: 'demasiado largo' },
      { id: 'REQ-010-REQ-012', nombre: 'Ana', mensaje: ' '.repeat(281), aviso: 'demasiado largo' },
    ];
    for (const caso of casos) {
      await nombre.fill(caso.nombre);
      await mensaje.fill(caso.mensaje);
      await enviar.click();
      await expect(page.getByRole('alert')).toContainText(caso.aviso);
      await expect(mensaje).toHaveValue(caso.conservado === undefined ? caso.mensaje : caso.conservado);
      await expect(page.locator('#messages li')).toHaveCount(0);
      if (caso.id === 'REQ-011') await expect(nombre).toHaveValue('');
      await page.screenshot({ path: path.join(dir, caso.id + '.jpg'), type: 'jpeg', quality: 95 });
      console.log('OK ' + caso.id + ': ' + await page.locator('#aviso').textContent());
    }
    await nombre.fill('Ana');
    await mensaje.fill('Los tres requerimientos funcionan juntos.');
    await enviar.click();
    await expect(page.locator('#messages li')).toHaveCount(1);
    await expect(page.locator('#aviso')).toBeEmpty();
    await page.screenshot({ path: path.join(dir, 'envio-correcto.jpg'), type: 'jpeg', quality: 95 });
    console.log('OK envio corregido: un solo mensaje publicado. Capturas en evidencias/demo/.');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => io.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
