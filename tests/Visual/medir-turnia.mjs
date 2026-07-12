/**
 * Mide LA PARRILLA REAL con el mismo instrumento que la referencia.
 *
 * Mismas preguntas al DOM, para poder poner los dos números uno al lado del otro en vez
 * de comparar de memoria.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(raiz, 'tests/Visual/salida');
const BASE = 'http://turnia.test';

const lunes = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
})();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'demo@turnia.test');
await page.fill('input[type=password]', 'turnia');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 20000 });

await page.goto(`${BASE}/companies/1/calendars/1/schedule?week=${lunes}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/turnia-semana.png`, fullPage: true });

const medidas = await page.evaluate(() => {
    const css = (el, p) => (el ? getComputedStyle(el)[p] : null);
    const caja = (el) => (el ? { w: +el.getBoundingClientRect().width.toFixed(1), h: +el.getBoundingClientRect().height.toFixed(1) } : null);

    const grid = [...document.querySelectorAll('div')]
        .find((d) => getComputedStyle(d).gridTemplateColumns.split(' ').length === 8);

    const panel = document.querySelector('aside');

    // Primera celda de puesto (la fila de puestos empieza después de cabecera+ausencias+conceptos).
    const celdas = grid ? [...grid.children] : [];
    const conCarriles = celdas.filter((c) => c.querySelector('div[style*="linear-gradient"]'));
    const celda = conCarriles[0];

    const pistas = celda ? [...celda.querySelectorAll('div')].filter((d) => {
        const s = getComputedStyle(d);
        return s.position === 'relative' && parseFloat(s.height) > 6 && parseFloat(s.height) < 12;
    }) : [];

    const tira = celda ? [...celda.querySelectorAll('div')].find((d) => {
        const s = getComputedStyle(d);
        return s.position === 'relative' && Math.round(parseFloat(s.height)) === 15;
    }) : null;

    // ¿Hay algún segmento VERDE de cobertura correcta en toda la página?
    const verdes = [...document.querySelectorAll('div')].filter(
        (d) => getComputedStyle(d).borderTopColor === 'rgb(21, 128, 61)',
    ).length;

    return {
        body: {
            fondo: css(document.body, 'backgroundColor'),
            fuente: css(document.body, 'fontFamily'),
            color: css(document.body, 'color'),
        },
        grid: {
            columnas: grid ? getComputedStyle(grid).gridTemplateColumns : null,
            radio: css(grid, 'borderRadius'),
        },
        celda: {
            caja: caja(celda),
            padding: css(celda, 'padding'),
            minHeight: css(celda, 'minHeight'),
        },
        carriles: {
            cuantos: pistas.length,
            altoPista: pistas[0] ? css(pistas[0], 'height') : null,
        },
        tiraCobertura: {
            existe: !!tira,
            alto: css(tira, 'height'),
            segmentosVerdesEnLaPagina: verdes,
        },
        panel: {
            existe: !!panel,
            caja: caja(panel),
            padding: css(panel, 'padding'),
            fondo: css(panel, 'backgroundColor'),
        },
        filasExtra: celdas.slice(0, 40)
            .map((c) => c.textContent.trim())
            .filter((t) => t === 'Ausencias' || t === 'Conceptos' || t === 'Sumiller'),
        textos: [...document.querySelectorAll('main *, header *')]
            .filter((e) => e.children.length === 0 && e.textContent.trim())
            .map((e) => e.textContent.trim())
            .filter((t, i, a) => a.indexOf(t) === i)
            .slice(0, 60),
    };
});

console.log(JSON.stringify(medidas, null, 2));
await browser.close();
