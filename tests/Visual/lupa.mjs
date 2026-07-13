/**
 * LA LUPA. Recorta una celda de la página REAL y la amplía, para MIRARLA.
 *
 * ⚠️ No mide nada. No da verde ni rojo. Está aquí porque NINGÚN TEST MIDE «SE ENTIENDE», y a
 * 12 px la diferencia entre un anillo que comunica y uno que no comunica no se decide con un
 * número: se decide con los ojos. Pero los ojos necesitan ver el píxel, y a 1366 la barra de
 * Sara mide 12 px de alto en una captura de 1366 de ancho.
 *
 * Así que se captura EL LAYOUT REAL a 1366 (que es lo único que decide la geometría) y se recorta
 * la celda con deviceScaleFactor alto. Lo que se amplía es la imagen que el navegador pintó de
 * verdad, no un mockup a otra escala.
 *
 *   node tests/Visual/lupa.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'http://turnia.test';

const lunesDe = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);

    return d.toISOString().slice(0, 10);
};

const browser = await chromium.launch();

// ⚠️ EL ANCHO ES 1366 Y NO SE TOCA: es lo único que cambia el diseño (las columnas son fluidas).
// Lo que sube es el deviceScaleFactor, o sea CUÁNTOS PÍXELES DE IMAGEN por píxel CSS. La barra
// sigue midiendo 12 px CSS; solo se ve más grande.
const page = await browser.newPage({
    viewport: { width: 1366, height: 2400 },
    deviceScaleFactor: 4,
});

for (let intento = 1; intento <= 3; intento++) {
    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 60000 });
    await page.fill('input[type=email]', 'demo@turnia.test');
    await page.fill('input[type=password]', 'turnia');
    await page.click('button[type=submit]');

    try {
        await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 20000 });
        break;
    } catch (e) {
        if (intento === 3) throw new Error('no se pudo entrar tras tres intentos');
    }
}

const lunes = lunesDe(0);

// Un argumento que empieza por "/" es la URL; los demás son celdas ("Puesto|fecha").
const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith('/')) ?? `/companies/1/calendars/1/schedule?week=${lunes}`;
const pedidas = args.filter((a) => !a.startsWith('/'));

const recortes = [{
    url,
    celdas: pedidas.length ? pedidas : [`Cocina|${lunes}`, `Caja|${lunes}`],
}];

mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });

for (const { url, celdas } of recortes) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-t=indicador]', { timeout: 60000 });
    await page.waitForTimeout(800);

    for (const celda of celdas) {
        const el = page.locator(`[data-celda="${celda}"]`).first();

        if (! await el.count()) {
            console.log(`⚠️  no existe la celda «${celda}»`);
            continue;
        }

        const png = await el.screenshot();
        const nombre = celda.replace(/[^\wáéíóúñ]+/gi, '-');

        writeFileSync(new URL(`./salida/lupa-${nombre}.png`, import.meta.url), png);
        console.log(`   salida/lupa-${nombre}.png`);
    }
}

await browser.close();
