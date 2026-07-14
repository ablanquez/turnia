/**
 * EL HOVER SOBRE UNA BARRA CON ALARMA. ¿Sigue viéndose el anillo?
 *
 * Se mide el PÍXEL de la captura, no el CSS: el CSS puede declarar un anillo que el navegador
 * después no pinta. Y si el lector de píxeles devuelve negro puro, LO DICE — comparar dos negros y
 * cantar «son iguales» es un verde sobre nada.
 */
import { chromium } from 'playwright';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync } from 'fs';
import { entrar, lunesDe } from './pixel.mjs';

const BASE = 'http://turnia.test';
const correr = promisify(execFile);
const PHP = String.raw`C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe`;

await correr(PHP, ['artisan', 'migrate:fresh', '--seed', '--quiet']);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await entrar(page, BASE);
await page.goto(`${BASE}/companies/1/calendars/1/schedule?week=${lunesDe(0)}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-t=indicador]', { timeout: 90000 });
await page.waitForTimeout(2500);

const di = console.log;

/** Las barras con anillo ROJO, y su geometría. */
const rojas = await page.$$eval('[data-t=barra]', (e) => e.map((x) => {
    const r = x.getBoundingClientRect();
    return {
        id: x.dataset.assignmentId,
        persona: x.closest('[data-t=carril]')?.dataset.persona,
        sombra: getComputedStyle(x).boxShadow,
        x: r.x, y: r.y, w: r.width, h: r.height,
    };
}).filter((x) => x.sombra.includes('200, 30, 30')));

di(`\nbarras con anillo rojo: ${rojas.length}`);
rojas.forEach((r) => di(`  id ${r.id} · ${r.persona} · ${r.w.toFixed(1)}×${r.h} px en (${r.x.toFixed(0)}, ${r.y.toFixed(0)})`));

// La más ANCHA, para que el ratón caiga limpio dentro y no en una vecina encimada.
const elegida = rojas.slice().sort((a, b) => b.w - a.w)[0];

/*
 * ⚠️ Y HAY QUE BAJAR HASTA ELLA. Tomás cae en y = 1143 con una ventana de 900 px: ESTÁ FUERA DE
 * PANTALLA. Sin esto, la captura no la contiene (el lector devolvía NEGRO PURO) y el ratón se movía
 * a un punto que no existe, así que el hover no se aplicaba nunca. Dos medidas falsas con una causa,
 * y la comparación «son idénticos» habría salido en verde comparando dos nadas.
 */
await page.locator(`[data-t=barra][data-assignment-id="${elegida.id}"]`).first().scrollIntoViewIfNeeded();
await page.waitForTimeout(600);

const t = await page.$eval(`[data-t=barra][data-assignment-id="${elegida.id}"]`, (e) => {
    const r = e.getBoundingClientRect();

    return { id: e.dataset.assignmentId, x: r.x, y: r.y, w: r.width, h: r.height };
});

di(`\nse elige la más ancha: id ${t.id} (${elegida.persona}), ${t.w.toFixed(1)} px`);
di(`tras bajar hasta ella, está en (${t.x.toFixed(0)}, ${t.y.toFixed(0)}) — dentro de la ventana\n`);

const leer = async (nombre) => {
    const buf = await page.screenshot();
    writeFileSync(new URL(`./salida/hover-${nombre}.png`, import.meta.url), buf);

    return page.evaluate(async ([dataUrl, bx, by, bw, bh]) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();

        const c = new OffscreenCanvas(img.width, img.height);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        const escala = img.width / window.innerWidth;
        const px = (x, y) => [...ctx.getImageData(Math.round(x * escala), Math.round(y * escala), 1, 1).data].slice(0, 3);

        const cx = bx + bw / 2;

        return {
            // 2 px POR ENCIMA del borde superior de la barra: ahí vive la franja del anillo.
            anillo: px(cx, by - 2),
            relleno: px(cx, by + bh / 2),
            // 6 px por debajo del anillo de abajo: ahí ya es pista. Es donde caería la sombra.
            fuera: px(cx, by + bh + 6),
            leyoAlgo: img.width > 100,
        };
    }, [`data:image/png;base64,${buf.toString('base64')}`, t.x, t.y, t.w, t.h]);
};

const rgb = (a) => `rgb(${a.join(',')})`;
const negro = (a) => a[0] === 0 && a[1] === 0 && a[2] === 0;

await page.mouse.move(4, 4);
await page.waitForTimeout(500);
const sin = await leer('sin');
const cssSin = await page.$eval(`[data-t=barra][data-assignment-id="${t.id}"]`, (e) => getComputedStyle(e).boxShadow);

await page.mouse.move(t.x + t.w / 2, t.y + t.h / 2);
await page.waitForTimeout(600);
const con = await leer('con');
const cssCon = await page.$eval(`[data-t=barra][data-assignment-id="${t.id}"]`, (e) => getComputedStyle(e).boxShadow);

if (negro(sin.relleno) && negro(con.relleno)) {
    di('❌ EL LECTOR DE PÍXELES NO HA LEÍDO NADA (relleno negro puro). No se compara nada.');
    process.exitCode = 1;
} else {
    di(`SIN el ratón encima:`);
    di(`   anillo (2 px por encima)  ${rgb(sin.anillo)}`);
    di(`   relleno (centro)          ${rgb(sin.relleno)}`);
    di(`   pista (6 px por debajo)   ${rgb(sin.fuera)}`);
    di(`   css: ${cssSin}`);
    di(`\nCON el ratón encima:`);
    di(`   anillo (2 px por encima)  ${rgb(con.anillo)}   ${JSON.stringify(sin.anillo) === JSON.stringify(con.anillo) ? '← IDÉNTICO' : '← ¡¡CAMBIÓ!!'}`);
    di(`   relleno (centro)          ${rgb(con.relleno)}   ${JSON.stringify(sin.relleno) === JSON.stringify(con.relleno) ? '← idéntico' : '← ¡¡cambió!!'}`);
    di(`   pista (6 px por debajo)   ${rgb(con.fuera)}   ${JSON.stringify(sin.fuera) === JSON.stringify(con.fuera) ? '← idéntico (¿se ve la sombra?)' : '← se OSCURECIÓ: ahí está la sombra del hover'}`);
    di(`   css: ${cssCon}`);
    di(`\n   ¿el css añadió la sombra del hover? ${cssCon !== cssSin ? 'SÍ' : 'NO — el hover no se aplicó'}`);
}

await browser.close();
