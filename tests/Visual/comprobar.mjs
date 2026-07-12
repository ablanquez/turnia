/**
 * LAS TRES PREGUNTAS, AUTOMATIZADAS.
 *
 * ⚠️ ESTE FICHERO EXISTE PORQUE MEDIR EL DATO ME ENGAÑÓ DOS VECES.
 *
 * Dije "27 tramos verdes" mirando un array de PHP. En la pantalla no había ni uno: el verde
 * se pintaba a un 18 % de opacidad sobre gris y el color que salía era #DDE6DE — un gris.
 * El dato estaba y el píxel no.
 *
 * Así que estas comprobaciones NO miran props ni JSON. Le preguntan al NAVEGADOR qué color
 * ha calculado de verdad, con qué anchura y en qué sitio.
 *
 *   1. ¿Hay VERDE de verdad en la pantalla?
 *   2. ¿PESA MÁS el borde que separa puestos que el que separa columnas?
 *   3. ¿Se distingue el panel de la parrilla?
 *   4. ¿Se queda quieta la columna de puestos al desplazarse?
 *   5. ¿Cabe en un portátil de 1366 px sin desbordar la página?
 *
 *   node tests/Visual/comprobar.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://turnia.test';
const lunes = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
})();

const rgb = (s) => (s.match(/\d+/g) ?? []).map(Number);
const esVerde = ([r, g, b]) => g > r + 20 && g > b + 10;

const browser = await chromium.launch();

// 1366 px: un portátil normal. NO una pantalla de 2.640.
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'demo@turnia.test');
await page.fill('input[type=password]', 'turnia');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 20000 });

await page.goto(`${BASE}/companies/1/calendars/1/schedule?week=${lunes}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const medida = await page.evaluate(() => {
    const css = (el, p) => getComputedStyle(el)[p];

    const tramos = [...document.querySelectorAll('div')]
        .filter((e) => css(e, 'borderTopWidth') === '2px' && e.getBoundingClientRect().height < 20)
        .map((e) => css(e, 'backgroundColor'));

    const raíl = document.querySelector('.rail-sticky');
    const celda = [...document.querySelectorAll('div')].find((e) => e.className.includes?.('border-line'));
    const panel = document.querySelector('aside');
    const tarjeta = document.querySelector('.bg-card');

    return {
        rellenos: tramos,
        bordeSeccion: raíl ? parseFloat(css(raíl, 'borderRightWidth')) : 0,
        bordeCelda: celda ? parseFloat(css(celda, 'borderRightWidth')) : 0,
        fondoPanel: panel ? css(panel, 'backgroundColor') : null,
        fondoParrilla: tarjeta ? css(tarjeta, 'backgroundColor') : null,
        bordePanel: panel ? parseFloat(css(panel, 'borderLeftWidth')) : 0,
        railPegajoso: raíl ? css(raíl, 'position') : null,
        desborda: document.documentElement.scrollWidth > window.innerWidth,
    };
});

// Y el raíl, al desplazarse de verdad hasta el domingo.
const railVisibleTrasDesplazar = await page.evaluate(() => {
    const scroller = [...document.querySelectorAll('div')].find((e) => e.scrollWidth > e.clientWidth + 50);
    if (!scroller) {
        return false;
    }

    scroller.scrollLeft = scroller.scrollWidth;
    const raíl = document.querySelector('.rail-sticky');

    return raíl.getBoundingClientRect().left < 200;
});

const verdes = medida.rellenos.filter((c) => esVerde(rgb(c))).length;

const pruebas = [
    ['¿HAY VERDE de verdad en la pantalla?', verdes > 0, `${verdes} tramos verdes`],
    ['¿El borde de SECCIÓN pesa más que el de columna?', medida.bordeSeccion > medida.bordeCelda,
        `sección ${medida.bordeSeccion}px vs columna ${medida.bordeCelda}px`],
    ['¿Se distingue el panel de la parrilla?', medida.fondoPanel !== medida.fondoParrilla && medida.bordePanel >= 2,
        `panel ${medida.fondoPanel} · parrilla ${medida.fondoParrilla} · borde ${medida.bordePanel}px`],
    ['¿Se queda la columna de puestos al desplazarse?', railVisibleTrasDesplazar, medida.railPegajoso],
    ['¿Cabe en 1366px sin desbordar la página?', !medida.desborda, medida.desborda ? 'DESBORDA' : 'cabe'],
];

let falla = false;

for (const [pregunta, ok, detalle] of pruebas) {
    console.log(`${ok ? '✅' : '❌'} ${pregunta}  → ${detalle}`);
    if (!ok) {
        falla = true;
    }
}

await browser.close();
process.exit(falla ? 1 : 0);
