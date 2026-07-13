/**
 * ABRIR LA PÁGINA Y MIRARLA. A 1366 px, que es el tamaño al que la mira un humano.
 *
 * ⚠️ NADA DE fullPage. Una captura fullPage expande el documento (2.640 px de alto en su día)
 * y enseña cosas que en un navegador de verdad están FUERA DE PANTALLA. Así se me coló un
 * panel invisible que "salía en la captura".
 *
 *   node tests/Visual/mirar.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = 'http://turnia.test';
const { escenarios } = JSON.parse(readFileSync('tests/Visual/escenarios.json', 'utf8'));

const lunes = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
})();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'demo@turnia.test');
await page.fill('input[type=password]', 'turnia');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 20000 });

const mirar = async (url, fichero) => {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-t=indicador]', { timeout: 20000 });
    await page.screenshot({ path: `tests/Visual/salida/${fichero}.png` });
    console.log(`  ${fichero}.png`);
};

const url = (slug) => escenarios.find((e) => e.slug === slug).url;

console.log('Capturas a 1366×768:');

await mirar(`/companies/1/calendars/1/schedule?week=${lunes}`, 'demo-semana');
await mirar(`/companies/1/calendars/1/schedule/day?day=${lunes}`, 'demo-dia');
await mirar(url('vacia'), 'bt-semana-vacia');
await mirar(url('perfecta'), 'bt-semana-perfecta');
await mirar(url('imposible-con-requisito'), 'bt-imposible');
await mirar(url('sin-candidato-con-deficit'), 'bt-sin-candidato');
await mirar(url('nombre-largo'), 'bt-nombre-largo');

await browser.close();
