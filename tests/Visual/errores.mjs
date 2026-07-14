/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * QUÉ PASA CUANDO EL SERVIDOR **NO** CONTESTA LO QUE ESPERÁBAMOS.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ ESTE INSTRUMENTO EXISTE PORQUE NO EXISTÍA, Y ESA ES LA HISTORIA ENTERA.
 *
 * `arrastrar.mjs` tenía doce casos y los doce recorrían el CAMINO FELIZ: el servidor contesta 200,
 * 409 o 422 y la aplicación reacciona. Ninguno preguntaba **qué pasa si el servidor contesta otra
 * cosa** — un 419 de CSRF, un 500, la red caída.
 *
 * Y la respuesta era: **NADA**. El usuario arrastraba, soltaba, y no ocurría absolutamente nada.
 * Peor: mientras arrastraba, **la celda de destino se pintaba de VERDE**, porque pintaba verde
 * siempre que no hubiera una gravedad… y una respuesta fallida tampoco tiene gravedad.
 *
 *     LA INTERFAZ DECÍA «SÍ» Y EL MOTOR NO SE HABÍA ENTERADO.
 *
 * ⚠️ Y POR QUÉ NINGÚN INSTRUMENTO LO VIO: todos hacen `migrate:fresh` y **VUELVEN A ENTRAR**. Nunca
 * tienen la sesión caducada, así que nunca provocan un 419. Un instrumento que solo sabe entrar bien
 * no puede descubrir qué pasa cuando se entra mal. **Los doce casos probaban que la app funciona
 * cuando todo va bien.**
 *
 * ⚠️ Y POR QUÉ ESTE INSTRUMENTO NO ROMPE EL `<meta>`: porque su primera versión lo hacía, y en
 * cuanto el token pasó a salir de la COOKIE (que es el arreglo), romper el meta dejó de romper
 * nada — y el instrumento se quedó midiendo un fallo que ya no podía ocurrir, **en verde**. Aquí
 * las respuestas se INTERCEPTAN: el fallo se provoca, no se espera.
 *
 *   node tests/Visual/errores.mjs
 */
import { chromium } from 'playwright';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdirSync, writeFileSync } from 'fs';
import { entrar, lunesDe } from './pixel.mjs';

const BASE = 'http://turnia.test';
const LUNES = lunesDe(0);
const correr = promisify(execFile);
const PHP = String.raw`C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe`;

const dia = (n) => { const d = new Date(LUNES); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

let salida = '';
const di = (s = '') => { salida += s + '\n'; console.log(s); };
const fallos = [];
const ok = (n, c, d = '') => { di(`  ${c ? '✅' : '❌'} ${n}${d ? `  → ${d}` : ''}`); if (!c) fallos.push(n); };

await correr(PHP, ['artisan', 'migrate:fresh', '--seed', '--quiet']);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });
const foto = async (n) => writeFileSync(new URL(`./salida/errores-${n}.png`, import.meta.url), await page.screenshot());

await entrar(page, BASE);

const cargar = async () => {
    await page.goto(`${BASE}/companies/1/calendars/1/schedule?week=${LUNES}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-t=indicador]', { timeout: 90000 });
    await page.waitForTimeout(2500);
};

/*
 * ⚠️ SE SIEMBRA DE CERO ANTES DE CADA BLOQUE, PORQUE ESTE INSTRUMENTO ESCRIBE.
 *
 * Sin esto, el caso 0 deja a Iker movido al domingo y los bloques siguientes miden sobre un
 * cuadrante que el propio instrumento cambió: la última comprobación decía «impossible» —solape de
 * Iker consigo mismo— y era VERDAD. El instrumento denunciaba un fallo que él mismo había causado.
 * Ya pasó en `arrastrar.mjs`, y vuelve a pasar aquí: la lección no se aprende una vez.
 *
 * (`migrate:fresh` borra la tabla de usuarios, así que hay que volver a entrar.)
 */
const sembrar = async () => {
    await correr(PHP, ['artisan', 'migrate:fresh', '--seed', '--quiet']);
    await entrar(page, BASE);
    await cargar();
};

const barras = () => page.$$eval('[data-t=barra][data-assignment-id]', (e) => e.length);
const idDe = async (p) => (await page.$$eval(`[data-t=carril][data-persona="${p}"] [data-t=barra][data-assignment-id]`, (e) => e.map((x) => x.dataset.assignmentId)))[0];
const centroDe = async (id) => { const c = await page.locator(`[data-t=barra][data-assignment-id="${id}"]`).first().boundingBox(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; };
const celda = async (pos, d) => { const c = await page.locator(`[data-position-id="${pos}"][data-date="${d}"]`).first().boundingBox(); return { x: c.x + c.width / 2, y: c.y + 40 }; };

/** Lo que la celda de destino ESTÁ DICIENDO ahora mismo. Ver WeekGrid::estadoDeDestino. */
const loQueDiceLaCelda = () => page.$eval('[data-celda-destino][data-previa]', (e) => e.dataset.previa).catch(() => null);

/** ⚠️ SE INTERCEPTA LA RESPUESTA DEL SERVIDOR. El fallo se PROVOCA; no se espera a que caiga. */
const romper = async (como) => {
    await page.unroute('**/assignments/**').catch(() => {});
    await page.route('**/assignments/**', async (route) => {
        if (como === 'red') {
            return route.abort('failed');
        }

        return route.fulfill({ status: como, contentType: 'text/html', body: '<html>nope</html>' });
    });
};

const arreglar = () => page.unroute('**/assignments/**').catch(() => {});

di('\nCUANDO EL SERVIDOR NO CONTESTA LO QUE ESPERÁBAMOS');
di('═'.repeat(96));

/* ── 0. EL TOKEN DEL <meta> CADUCA, Y NO PASA NADA ─────────────────────────────── */

di('\n0. EL TOKEN DEL <meta> CADUCA. (El bug que mató la app: el meta se pinta UNA vez,');
di('   y esto es una SPA. La cookie XSRF, en cambio, Laravel la refresca en CADA respuesta.)');

await sembrar();
await page.evaluate(() => { document.querySelector('meta[name=csrf-token]').content = 'caducado'; });

{
    const id = await idDe('Iker Blanco');
    const antes = await barras();
    const codigos = [];
    const oir = (r) => { if (/\/assignments/.test(r.url())) codigos.push(r.status()); };
    page.on('response', oir);

    await page.mouse.move(...Object.values(await centroDe(id)));
    await page.mouse.down();
    await page.mouse.move(200, 300, { steps: 4 });
    const d = await celda(1, dia(6));
    await page.mouse.move(d.x, d.y, { steps: 20 });
    await page.waitForTimeout(900);
    await page.mouse.up();
    await page.waitForTimeout(2500);

    page.off('response', oir);

    ok('con el meta roto, el servidor SIGUE aceptando (el token sale de la cookie)',
        codigos.length > 0 && ! codigos.includes(419), `códigos: ${[...new Set(codigos)].join(', ')}`);

    await cargar();
    const donde = await page.$eval(`[data-t=barra][data-assignment-id="${id}"]`, (e) => e.closest('[data-celda-destino]')?.dataset.date).catch(() => null);
    ok('y el turno se movió DE VERDAD (sigue movido tras recargar)', donde === dia(6), `está en ${donde}`);
    ok('sin duplicar nada', await barras() === antes, `${await barras()} (antes ${antes})`);
}

/* ── LOS TRES FALLOS, PROVOCADOS ───────────────────────────────────────────────── */

for (const [nombre, como, esperado] of [
    ['419 · la sesión ha caducado', 419, 'sesión'],
    ['500 · el servidor ha reventado', 500, 'servidor'],
    ['la RED se ha caído', 'red', 'conexión'],
]) {
    di(`\n${nombre.toUpperCase()}`);

    await arreglar();
    await sembrar();

    const id = await idDe('Iker Blanco');
    const antes = await barras();

    await romper(como);

    /* ── mientras se arrastra: ¿qué dice la celda de destino? ── */
    await page.mouse.move(...Object.values(await centroDe(id)));
    await page.mouse.down();
    await page.mouse.move(200, 300, { steps: 4 });
    const d = await celda(1, dia(6));
    await page.mouse.move(d.x, d.y, { steps: 20 });
    await page.waitForTimeout(1200);

    const dice = await loQueDiceLaCelda();
    di(`   la celda de destino dice: «${dice}»`);

    ok('la celda NO dice que se pueda soltar', dice !== 'limpio',
        dice === 'limpio' ? '¡¡VERDE!! La interfaz dice «sí» y el motor no se ha enterado' : `dice «${dice}»`);

    await foto(`${como}-arrastrando`);

    await page.mouse.up();
    await page.waitForTimeout(2000);

    /* ── al soltar: ¿se entera el usuario? ── */
    const dlg = page.locator('[data-t=dialogo]');
    const hayDlg = await dlg.isVisible().catch(() => false);

    ok('al soltar, el usuario SE ENTERA', hayDlg, hayDlg ? '' : 'SILENCIO TOTAL');

    if (hayDlg) {
        const txt = (await dlg.innerText()).replace(/\s+/g, ' ');
        di(`   dice: «${txt.slice(0, 130)}»`);
        ok(`y explica que fue ${esperado}`, new RegExp(esperado, 'i').test(txt), txt.slice(0, 60));
        ok('y deja claro que NO se ha escrito nada', /no se ha escrito/i.test(txt));

        if (como === 419) {
            ok('y OFRECE RECARGAR (cerrar no arreglaría nada: todo seguiría fallando)',
                await page.locator('[data-t=recargar]').isVisible().catch(() => false));
        }

        await foto(`${como}-dialogo`);
    }

    await arreglar();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-t=indicador]', { timeout: 60000 });
    await page.waitForTimeout(2000);

    ok('y NADA se ha escrito en la base', await barras() === antes, `${await barras()} (antes ${antes})`);
}

/* ── LA PREVISUALIZACIÓN EN VUELO ──────────────────────────────────────────────── */

di('\nLA PREVISUALIZACIÓN TODAVÍA NO HA CONTESTADO. ¿Qué se pinta MIENTRAS?');
di('(Esto pintaba VERDE. «No sé» y «sí» eran el mismo píxel.)');

await arreglar();
await sembrar();

{
    // Se retrasa la respuesta 4 segundos: el hueco donde la celda no sabe nada.
    await page.route('**/assignments/**/preview', async (route) => {
        await new Promise((r) => setTimeout(r, 4000));
        await route.continue();
    });

    const id = await idDe('Iker Blanco');

    await page.mouse.move(...Object.values(await centroDe(id)));
    await page.mouse.down();
    await page.mouse.move(200, 300, { steps: 4 });
    const d = await celda(1, dia(6));
    await page.mouse.move(d.x, d.y, { steps: 20 });
    await page.waitForTimeout(800);   // la respuesta AÚN no ha llegado

    const enVuelo = await loQueDiceLaCelda();
    di(`   con la petición EN VUELO, la celda dice: «${enVuelo}»`);

    ok('mientras no sabe, la celda NO dice que se pueda', enVuelo !== 'limpio',
        enVuelo === 'limpio' ? '¡¡VERDE!! se lo está inventando' : `dice «${enVuelo}»`);

    await foto('en-vuelo');

    await page.waitForTimeout(4200);   // ahora sí

    const yaSabe = await loQueDiceLaCelda();
    di(`   cuando el servidor contesta, la celda dice: «${yaSabe}»`);
    ok('y cuando el servidor contesta, lo dice', yaSabe === 'limpio', `dice «${yaSabe}»`);

    await page.mouse.up();
    await page.waitForTimeout(1500);
}

/* ══════════════════════════════════════════════════════════════════════════════ */

di();
di('═'.repeat(96));

if (fallos.length) {
    di(`❌ ${fallos.length} FALLOS:`);
    fallos.forEach((f) => di(`   · ${f}`));
} else {
    di('✅ Cuando el servidor dice que no —o no dice nada—, la interfaz NO pinta que sí,');
    di('   y el usuario se entera de que no se ha escrito.');
}

di();

await browser.close();
writeFileSync(new URL('./salida/errores.txt', import.meta.url), salida);
process.exitCode = fallos.length ? 1 : 0;
