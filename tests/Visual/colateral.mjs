/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ¿ME ENTERO DE **TODO** LO QUE HE ROTO? ¿Y DE LO QUE HE ARREGLADO?
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * La primera versión del aviso solo miraba los HUECOS. Y mover a Iker del lunes al domingo hace DOS
 * cosas: deja un hueco en el lunes (avisaba) y crea un EXCESO en el domingo (**no decía nada**).
 *
 * ⚠️ Y EL RIESGO DE ESTE INSTRUMENTO ES EL DE SIEMPRE: probar solo el caso que ya funciona.
 *
 * Así que los casos están cebados para reventarlo: dos colaterales a la vez, uno que salta en CINCO
 * turnos de la misma persona, uno que ARREGLA algo, uno que no cambia nada (¿calla, o se inventa un
 * «sin novedad»?), y uno donde el informe NO HA LLEGADO todavía (¿se calla, o afirma «todo bien»?).
 *
 *   node tests/Visual/colateral.mjs
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });
const foto = async (n) => writeFileSync(new URL(`./salida/colateral-${n}.png`, import.meta.url), await page.screenshot());

/** Siembra de cero. ⚠️ `migrate:fresh` borra los usuarios: hay que volver a entrar. */
const sembrar = async ({ esperarInforme = true } = {}) => {
    await correr(PHP, ['artisan', 'migrate:fresh', '--seed', '--quiet']);
    await entrar(page, BASE);
    await page.evaluate(() => localStorage.setItem('turnia.panel-plantilla', 'abierto'));
    await page.goto(`${BASE}/companies/1/calendars/1/schedule?week=${LUNES}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-t=barra]', { timeout: 60000 });

    if (esperarInforme) {
        /*
         * ⚠️ SE ESPERA A UN **TRAMO DE COBERTURA**, NO AL INDICADOR. Y esto me costó tres pasadas.
         *
         * El indicador EXISTE DESDE EL PRIMER PINTADO, porque su fallback honesto es «comprobando el
         * cuadrante…» — precisamente para no mentir mientras el informe viaja. O sea que esperarlo a
         * él **no garantiza absolutamente nada**: es lo primero que aparece.
         *
         * Los tramos, en cambio, SALEN DE `coverage`: si hay uno, el informe ha llegado de verdad.
         *
         * Con el indicador, el instrumento escribía a veces ANTES de tener informe, así que no había
         * «antes» con el que comparar, el aviso se callaba —correctamente— y el test cantaba «no
         * avisa del hueco». Un fallo de reloj disfrazado de hallazgo, y en el sitio de siempre:
         * midiendo una cosa y creyendo medir otra.
         */
        await page.waitForSelector('[data-t=tramo]', { timeout: 90000 });
        await page.waitForTimeout(800);
    }
};

const idsDe = (p) => page.$$eval(`[data-t=carril][data-persona="${p}"] [data-t=barra][data-assignment-id]`, (e) => e.map((x) => x.dataset.assignmentId));
/**
 * El centro de una barra.
 *
 * ⚠️ SE BAJA HASTA ELLA PRIMERO. Los turnos de Tomas caen en y = 1143 con una ventana de 950:
 * ESTAN FUERA DE PANTALLA. Sin el scroll, el raton se mueve a un punto que no existe, no coge nada,
 * y el caso entero mide el vacio -- sin fallar: simplemente no pasa nada, y el instrumento lo canta
 * como "no dice la buena noticia". Ya me paso en hover.mjs, y la leccion no se aprende una vez.
 */
const centroDe = async (id) => {
    const loc = page.locator(`[data-t=barra][data-assignment-id="${id}"]`).first();

    await loc.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const c = await loc.boundingBox();

    return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
};
const celda = async (pos, d) => { const c = await page.locator(`[data-position-id="${pos}"][data-date="${d}"]`).first().boundingBox(); return { x: c.x + c.width / 2, y: c.y + 40 }; };

const fichaDe = async (nombre) => {
    const f = page.locator(`[data-t=ficha][data-persona="${nombre}"]`).first();
    await f.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const c = await f.boundingBox();

    return { x: c.x + c.width / 2, y: c.y + 20 };
};

const arrastrar = async (a, b) => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 8, a.y + 8, { steps: 3 });
    await page.mouse.move(b.x, b.y, { steps: 22 });
    await page.waitForTimeout(700);
    await page.mouse.up();
};

/** Lo que el aviso está contando AHORA: el texto, las malas, las buenas, y si dice que hay más. */
const leerAviso = async () => ({
    texto: await page.locator('[data-t=aviso-texto]').first().innerText().catch(() => null),
    // ⚠️ ¿SE PUDO COMPARAR? Sin este dato, «no dice nada» es AMBIGUO: puede ser «no ha cambiado
    // nada» o «no había informe con el que comparar». Dos cosas distintas, y se veían igual.
    comparado: await page.locator('[data-t=aviso]').first().getAttribute('data-comparado').catch(() => null),
    comprobando: await page.locator('[data-t=aviso-comprobando]').isVisible().catch(() => false),
    malas: await page.$$eval('[data-t=aviso-colateral][data-tipo=mala]', (e) => e.map((x) => x.innerText.trim())),
    buenas: await page.$$eval('[data-t=aviso-colateral][data-tipo=buena]', (e) => e.map((x) => x.innerText.trim())),
    mas: await page.locator('[data-t=aviso-mas]').innerText().catch(() => null),
});

const pinta = (a) => {
    di(`      «${a.texto}»   [¿pudo comparar con un ANTES? ${a.comparado}]`);
    a.malas.forEach((m) => di(`        ${m}`));
    a.buenas.forEach((b) => di(`        ${b}`));
    if (a.mas) di(`        ${a.mas}`);
    if (! a.malas.length && ! a.buenas.length && ! a.mas) di('        (no dice nada más)');
};

/**
 * Espera a que el colateral llegue (el informe es diferido, ~900 ms después del aviso).
 *
 * ⚠️ PRIMERO SE ESPERA A QUE EL AVISO **EXISTA**. La primera versión solo comprobaba que no hubiera
 * un «comprobando…» — y si el aviso todavía no había aparecido, TAMPOCO había «comprobando», así que
 * la condición se cumplía de inmediato y el instrumento leía la tarjeta ANTES de que llegara nada.
 * Daba «no dice nada» sobre un aviso que sí lo decía. Un fallo de reloj disfrazado de hallazgo.
 */
const esperarColateral = async () => {
    await page.waitForSelector('[data-t=aviso]', { timeout: 15000 }).catch(() => {});

    await page.waitForFunction(
        () => {
            const aviso = document.querySelector('[data-t=aviso]');

            return aviso && ! aviso.querySelector('[data-t=aviso-comprobando]');
        },
        { timeout: 20000 },
    ).catch(() => {});

    await page.waitForTimeout(700);
};

/** El último aviso leído. El caso 4 mira el MISMO que el 3: se desvanece a los 6 s. */
let ultimo = { malas: [], buenas: [] };

di('\nEL COLATERAL: ¿ME ENTERO DE TODO LO QUE HE CAMBIADO?');
di('═'.repeat(100));

/* ══ 1. UN MOVIMIENTO QUE ROMPE **DOS** COSAS A LA VEZ ═══════════════════════════ */

di('\n1. HUECO **Y** EXCESO, EN LOS DOS EXTREMOS DE LA SEMANA.');
di('   Iker: Barra lunes → Barra domingo. El lunes se queda corto; el domingo, de sobra.');

await sembrar();
{
    const id = (await idsDe('Iker Blanco'))[0];

    await arrastrar(await centroDe(id), await celda(1, dia(6)));
    await esperarColateral();

    const a = await leerAviso();
    pinta(a);

    ok('avisa del HUECO que deja en el lunes', a.malas.some((m) => /falta gente/i.test(m) && /Lun/.test(m)));
    ok('y del EXCESO que crea en el domingo', a.malas.some((m) => /sobra gente/i.test(m) && /Dom/.test(m)),
        a.malas.some((m) => /sobra/i.test(m)) ? '' : 'NO LO DICE');
    ok('y «falta» y «sobra» se distinguen LEYENDO, no solo por el color',
        a.malas.some((m) => /falta/i.test(m)) && a.malas.some((m) => /sobra/i.test(m)));

    await foto('1-hueco-y-exceso');
}

/* ══ 2. EL TOPE SEMANAL: SALTA EN **TODOS** SUS TURNOS ═══════════════════════════ */

di('\n2. EL TOPE SEMANAL. Marco va a 25/25 h: un turno más y se pasa —y eso salta en TODOS');
di('   sus turnos a la vez. ¿El aviso dice «en N turnos», o escupe N líneas iguales?');

await sembrar();
{
    const antes = (await idsDe('Marco Ruiz')).length;
    di(`      Marco tiene ${antes} turnos esta semana`);

    await arrastrar(await fichaDe('Marco Ruiz'), await celda(1, dia(6)));   // Barra, domingo
    await page.waitForTimeout(800);
    await page.locator('[data-t=start]').fill('10:00');
    await page.locator('[data-t=end]').fill('14:00');
    await page.waitForTimeout(1000);
    await page.locator('[data-t=colocar]').click();
    await page.waitForTimeout(1200);

    // Incumple el tope: hay que forzarlo.
    const hayDialogo = await page.locator('[data-t=dialogo]').isVisible().catch(() => false);
    di(`      el candado pide decisión: ${hayDialogo}`);

    if (hayDialogo) {
        await page.locator('[data-t=motivo]').fill('Refuerzo del domingo. Se compensa la semana que viene.');
        await page.locator('[data-t=forzar]').click();
    }

    await page.waitForTimeout(2500);
    await esperarColateral();

    const a = await leerAviso();
    pinta(a);

    const tope = a.malas.filter((m) => /tope de horas/i.test(m));

    ok('avisa de que OTRA gente (sus otros turnos) se ve afectada por el tope', tope.length >= 1,
        tope.length ? '' : 'NO LO DICE');
    ok('y lo dice en UNA línea agrupada, no en cinco iguales', tope.length === 1, `${tope.length} líneas`);
    ok('y dice EN CUÁNTOS TURNOS (el dato no se pierde al agrupar)',
        tope.some((m) => /en \d+ turnos/i.test(m)), tope[0] ?? '—');

    await foto('2-tope-semanal');
}

/* ══ 3. UN MOVIMIENTO QUE **ARREGLA** ALGO ══════════════════════════════════════ */

di('\n3. UNA BUENA NOTICIA. Tomás tiene DOS turnos que se pisan el martes (solape imposible).');
di('   Si muevo uno a otro día, el otro DEJA de ser imposible. ¿Se dice?');

await sembrar();
{
    const tomas = await idsDe('Tomás Vega');
    di(`      Tomás tiene ${tomas.length} turnos visibles`);

    // El primero de los dos que se pisan, a otro día del mismo puesto.
    await arrastrar(await centroDe(tomas[0]), await celda(4, dia(2)));   // Caja, miércoles
    await page.waitForTimeout(1200);

    const dlg = await page.locator('[data-t=dialogo]').isVisible().catch(() => false);

    if (dlg) {
        di(`      ⚠️ salió el DIÁLOGO: «${(await page.locator('[data-t=motivos]').innerText()).replace(/\s+/g, ' ')}»`);
        di('         (el movimiento no se escribió: este caso no está midiendo lo que cree)');
    }

    await page.waitForTimeout(1500);
    await esperarColateral();

    const a = await leerAviso();
    pinta(a);

    ok('el movimiento se escribió (si no, este caso no prueba nada)', ! dlg, dlg ? 'salió el diálogo' : '');
    ok('dice la BUENA noticia: el solape del otro turno se ha resuelto',
        a.buenas.some((b) => /solape/i.test(b)), a.buenas.length ? a.buenas[0] : 'NO DICE NINGUNA BUENA NOTICIA');
    ok('y la buena noticia lleva SUJETO (de quién)', a.buenas.some((b) => /Tomás/.test(b)));
    ok('y se lee como una frase, no como un telegrama sin verbo', a.buenas.every((b) => ! /ya no [a-z]+ (imposible|corto)/i.test(b)),
        a.buenas[0] ?? '');

    await foto('3-arregla');

    // ⚠️ El caso 4 mira ESTE MISMO aviso: leerlo más tarde no vale, porque se desvanece a los 6 s.
    ultimo = a;
}

/* ══ 4. UN MOVIMIENTO QUE ROMPE **Y** ARREGLA ═══════════════════════════════════ */

di('\n4. LAS DOS COSAS A LA VEZ. El mismo movimiento del caso 3 deja un hueco donde estaba.');
di('   ¿Cuenta la buena Y la mala, o se queda solo con una?');

{
    ok('cuenta las MALAS y las BUENAS en el mismo aviso', ultimo.malas.length > 0 && ultimo.buenas.length > 0,
        `${ultimo.malas.length} malas · ${ultimo.buenas.length} buenas`);
}

/* ══ 5. UN MOVIMIENTO SIN COLATERAL NINGUNO ═════════════════════════════════════ */

di('\n5. UN MOVIMIENTO QUE NO CAMBIA NADA MÁS. ¿Se calla, o se inventa un «sin novedad»?');

await sembrar();
{
    // Soltar en la MISMA celda: no-op. Ni siquiera se escribe.
    const id = (await idsDe('Iker Blanco'))[0];
    const c = await centroDe(id);

    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 25, c.y + 6, { steps: 8 });
    await page.mouse.move(c.x, c.y, { steps: 8 });
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(1500);

    const hayAviso = await page.locator('[data-t=aviso]').isVisible().catch(() => false);

    ok('soltar en el MISMO sitio no escribe, y no dice nada', ! hayAviso,
        hayAviso ? 'sale un aviso de una escritura que no ocurrió' : 'silencio, y es correcto');
}

/* ══ 6. ⚠️ EL INFORME NO HA LLEGADO ════════════════════════════════════════════ */

di('\n6. ⚠️ SE ESCRIBE **ANTES** DE QUE EL INFORME LLEGUE. No hay «antes» con el que comparar.');
di('   ¿Se calla, o afirma un «no has roto nada» que NO PUEDE SABER? (el silencio falso)');

await sembrar();

{
    /*
     * ⚠️ EL INFORME SE RETRASA **DE VERDAD**, INTERCEPTÁNDOLO.
     *
     * La primera versión solo cargaba la página sin esperar al indicador… y para cuando el ratón
     * terminaba de arrastrar, el informe YA había llegado. El caso decía medir «sin informe» y medía
     * exactamente lo contrario. Aquí se demora la petición PARCIAL de Inertia —la que trae las props
     * diferidas— y así el «antes» es de verdad inexistente.
     */
    await page.route('**/schedule**', async (route) => {
        const parcial = route.request().headers()['x-inertia-partial-data'];

        if (parcial) {
            await new Promise((r) => setTimeout(r, 12000));
        }

        await route.continue();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-t=barra]', { timeout: 60000 });

    const hayInforme = await page.locator('[data-t=indicador]').isVisible().catch(() => false);

    di(`      ¿ha llegado el informe? ${hayInforme}  (tiene que ser false)`);

    const id = (await idsDe('Iker Blanco'))[0];

    await arrastrar(await centroDe(id), await celda(1, dia(6)));
    await page.waitForTimeout(1500);

    const a = await leerAviso();

    di(`      aviso: «${a.texto}»`);
    di(`      ¿dice «comprobando»?  ${a.comprobando}`);
    di(`      malas: ${a.malas.length} · buenas: ${a.buenas.length}`);

    ok('el aviso de la escritura SÍ sale (eso sí lo sabe)', !! a.texto);
    ok('⚠️ y NO promete una comprobación que no puede hacer', ! a.comprobando,
        a.comprobando ? 'dice «comprobando» sin tener un ANTES con el que comparar' : '');
    ok('⚠️ y NO se inventa ningún colateral', a.malas.length === 0 && a.buenas.length === 0,
        (a.malas[0] ?? a.buenas[0]) ?? 'no dice nada, y es lo correcto');

    await foto('6-sin-informe');

    // Y cuando el informe llega (tarde), ¿se lo inventa a posteriori?
    await page.waitForSelector('[data-t=indicador]', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.unroute('**/schedule**');

    const b = await leerAviso();

    ok('y cuando el informe llega, TAMPOCO se lo inventa (no había ANTES)',
        b.malas.length === 0 && b.buenas.length === 0, (b.malas[0] ?? b.buenas[0]) ?? 'sigue callado');
}

/* ══════════════════════════════════════════════════════════════════════════════ */

await browser.close();

di();
di('═'.repeat(100));

if (fallos.length) {
    di(`❌ ${fallos.length} FALLOS:`);
    fallos.forEach((f) => di(`   · ${f}`));
} else {
    di('✅ El aviso cuenta TODO lo que la acción cambió —huecos, excesos, incumplimientos—, en las');
    di('   dos direcciones, agrupado por regla, y se calla cuando no lo sabe.');
}

di();
writeFileSync(new URL('./salida/colateral.txt', import.meta.url), salida);
process.exitCode = fallos.length ? 1 : 0;
