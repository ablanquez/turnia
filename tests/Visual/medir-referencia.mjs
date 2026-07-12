/**
 * Mide la REFERENCIA con un navegador de verdad.
 *
 * No lee el HTML: lo RENDERIZA y le pregunta al DOM cuánto mide cada cosa. Leer el
 * fichero fue lo que me llevó a creer que mi parrilla se parecía a esto.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REF = `file:///${path.join(raiz, 'docs/design/parrilla-referencia.html').replace(/\\/g, '/')}`;
const OUT = path.join(raiz, 'tests/Visual/salida');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

await page.goto(REF, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

await page.screenshot({ path: `${OUT}/referencia.png`, fullPage: true });

const medidas = await page.evaluate(() => {
    const css = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
    const caja = (el) => (el ? { w: +el.getBoundingClientRect().width.toFixed(1), h: +el.getBoundingClientRect().height.toFixed(1) } : null);

    const grid = [...document.querySelectorAll('div')]
        .find((d) => getComputedStyle(d).gridTemplateColumns.split(' ').length === 8);

    const panel = [...document.querySelectorAll('div')]
        .find((d) => d.textContent.startsWith('Plantilla disponible'));

    // La primera celda con carriles (Barra / Lunes).
    const celda = grid ? grid.children[9] : null;

    // Las pistas de 8px de los carriles.
    const pistas = celda ? [...celda.querySelectorAll('div')].filter((d) => {
        const s = getComputedStyle(d);
        return s.position === 'relative' && parseFloat(s.height) > 6 && parseFloat(s.height) < 12;
    }) : [];

    const tira = celda ? [...celda.querySelectorAll('div')].find((d) => {
        const s = getComputedStyle(d);
        return s.position === 'relative' && Math.round(parseFloat(s.height)) === 15;
    }) : null;

    return {
        body: {
            fondo: css(document.body, 'backgroundColor'),
            fuente: css(document.body, 'fontFamily'),
            color: css(document.body, 'color'),
        },
        grid: {
            columnas: grid ? getComputedStyle(grid).gridTemplateColumns : null,
            radio: css(grid, 'borderRadius'),
            borde: css(grid, 'border'),
        },
        celda: {
            caja: caja(celda),
            padding: css(celda, 'padding'),
            minHeight: css(celda, 'minHeight'),
            bordeDerecho: css(celda, 'borderRight'),
        },
        carriles: {
            cuantos: pistas.length,
            altoPista: pistas[0] ? css(pistas[0], 'height') : null,
            fondoPista: pistas[0] ? css(pistas[0], 'background') : null,
        },
        tiraCobertura: {
            existe: !!tira,
            alto: css(tira, 'height'),
            fondo: css(tira, 'backgroundColor'),
            segmentos: tira ? tira.children.length : 0,
        },
        panel: {
            existe: !!panel,
            caja: caja(panel),
            padding: css(panel, 'padding'),
            fondo: css(panel, 'backgroundColor'),
            bordeIzq: css(panel, 'borderLeft'),
        },
        // Todo el texto, para poder cotejar los rótulos exactos.
        textos: [...document.querySelectorAll('body *')]
            .filter((e) => e.children.length === 0 && e.textContent.trim())
            .map((e) => e.textContent.trim())
            .filter((t, i, a) => a.indexOf(t) === i),
    };
});

console.log(JSON.stringify(medidas, null, 2));
await browser.close();
