/**
 * ARRASTRAR DE VERDAD, EN LA PÁGINA REAL, CON EL RATÓN.
 *
 * ⚠️ NO SIMULA NADA. Abre Chromium, coge una barra con `mouse.down()`, la mueve píxel a píxel, la
 * suelta, y MIRA lo que quedó en la pantalla y en la base de datos.
 *
 * Los casos, todos cebados a propósito:
 *
 *   1. Soltar en un IMPOSIBLE            → ¿explica y devuelve la barra?
 *   2. Forzar un INCUMPLIMIENTO          → ¿se registra quién/cuándo/por qué?
 *   3. Mover un turno que ROMPE OTRO     → ¿se ve el otro en rojo tras el repintado?
 *   4. Colocar a alguien NO CUALIFICADO  → ¿lo dice?
 *   5. Colocar a alguien DE BAJA         → ¿lo dice?
 *   6. Soltar EN EL MISMO SITIO          → ¿no-op, sin escritura?
 *   7. Quitar arrastrando a la papelera  → ¿desaparece?
 *   8. Quitar con la tecla Supr          → ¿desaparece?
 *
 *   node tests/Visual/arrastrar.mjs
 */
import { chromium } from 'playwright';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdirSync, writeFileSync } from 'fs';
import { entrar, lunesDe } from './pixel.mjs';

const BASE = 'http://turnia.test';
const LUNES = lunesDe(0);
const SEMANA = `/companies/1/calendars/1/schedule?week=${LUNES}`;

const dia = (n) => {
    const d = new Date(LUNES);
    d.setDate(d.getDate() + n);

    return d.toISOString().slice(0, 10);
};

let salida = '';
const di = (s = '') => { salida += s + String.fromCharCode(10); console.log(s); };

const fallos = [];
const ok = (nombre, cierto, detalle = '') => {
    di(`  ${cierto ? '✅' : '❌'} ${nombre}${detalle ? `  → ${detalle}` : ''}`);

    if (! cierto) {
        fallos.push(`${nombre}${detalle ? ` → ${detalle}` : ''}`);
    }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

await entrar(page, BASE);
// El panel ABIERTO: de ahí salen las personas que se colocan.
await page.evaluate(() => localStorage.setItem('turnia.panel-plantilla', 'abierto'));

/**
 * ⚠️ ESTE INSTRUMENTO ESCRIBE EN LA BASE, ASÍ QUE SIEMBRA DE CERO ANTES DE CADA CASO.
 *
 * Y no es celo: sin esto, el instrumento SOLO SE PUEDE CORRER UNA VEZ. La primera pasada borra el
 * turno de Iker del lunes (caso 6) y en la segunda el caso 1 —que necesita ese turno para provocar
 * un solape— ya no encuentra nada y falla. El instrumento denunciaba un fallo que él mismo había
 * causado en la pasada anterior.
 *
 * Un instrumento que muta el mundo y no lo deja como lo encontró no es un instrumento: es un
 * accidente que se acumula.
 */
const correr = promisify(execFile);
const PHP = String.raw`C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe`;

const ir = async () => {
    await correr(PHP, ['artisan', 'migrate:fresh', '--seed', '--quiet']);

    /*
     * ⚠️ Y HAY QUE VOLVER A ENTRAR. `migrate:fresh` BORRA LA TABLA DE USUARIOS.
     *
     * La sesión del navegador apunta a un `user_id` que ya no existe, así que la siguiente petición
     * acaba en /login y el instrumento se queda esperando un indicador que no va a llegar nunca —
     * con un TimeoutError, que es el mismo código de salida que un hallazgo (la mentira número 5).
     */
    await entrar(page, BASE);
    await page.evaluate(() => localStorage.setItem('turnia.panel-plantilla', 'abierto'));

    await page.goto(`${BASE}${SEMANA}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-t=indicador]', { timeout: 90000 });
    // El informe llega DIFERIDO. Sin esperarlo, las barras están pero sin gravedad.
    await page.waitForTimeout(2200);
};

/** Cuántos turnos hay ahora mismo, según la página (no según la base: se mide lo que se ve). */
const barras = () => page.$$eval('[data-t=barra][data-assignment-id]', (e) => e.length);

/** El centro de una barra concreta (por su id de asignación). */
const centroDeBarra = async (id) => {
    const caja = await page.locator(`[data-assignment-id="${id}"]`).first().boundingBox();

    return caja ? { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 } : null;
};

/**
 * ⚠️ LA FICHA HAY QUE TRAERLA A LA VISTA ANTES DE COGERLA. El panel tiene scroll.
 *
 * La ficha de Leo cae en y = 1399 con una ventana de 1100: el ratón la «cogía» en un punto que NO
 * ESTÁ EN LA PANTALLA, así que no la tocaba nadie y el arrastre no empezaba nunca. El instrumento
 * daba «no se abre el popover» sobre una página que funcionaba.
 */
const fichaDe = async (nombre) => {
    const f = page.locator(`[data-t=ficha][data-persona="${nombre}"]`).first();

    await f.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const caja = await f.boundingBox();

    return { x: caja.x + caja.width / 2, y: caja.y + 20 };
};

const centroDeCelda = async (positionId, date) => {
    const caja = await page.locator(`[data-position-id="${positionId}"][data-date="${date}"]`).first().boundingBox();

    return caja ? { x: caja.x + caja.width / 2, y: caja.y + 40 } : null;
};

/**
 * ⚠️ EL ARRASTRE SE HACE CON PASOS. Y no es un capricho de Playwright.
 *
 * `mouse.move(x, y)` de un salto genera UN SOLO pointermove, y la app decide con eso: si el salto
 * pasa por encima de tres celdas, no se entera de ninguna. Con pasos, el navegador dispara la
 * secuencia real —la misma que dispara una mano— y la previsualización se pide como se pediría de
 * verdad.
 */
const arrastrar = async (desde, hasta, pasos = 25) => {
    await page.mouse.move(desde.x, desde.y);
    await page.mouse.down();
    await page.mouse.move(desde.x + 8, desde.y + 8, { steps: 3 });
    await page.mouse.move(hasta.x, hasta.y, { steps: pasos });
    await page.waitForTimeout(700);   // que la previsualización llegue
    await page.mouse.up();
    await page.waitForTimeout(900);
};

const dialogo = () => page.locator('[data-t=dialogo]');
const popover = () => page.locator('[data-t=popover-colocar]');

mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });

const foto = async (nombre) => writeFileSync(
    new URL(`./salida/arrastrar-${nombre}.png`, import.meta.url),
    await page.screenshot(),
);

di();
di('ARRASTRAR — sobre la página real, con el ratón de verdad');
di('═'.repeat(96));

/* ── 1. SOLTAR EN UN IMPOSIBLE ─────────────────────────────────────────────────── */

di();
di('1. SOLTAR EN UN IMPOSIBLE: Tomás ya tiene dos turnos que se pisan el martes.');

await ir();

// Leo, Caja, lunes. Se arrastra al martes de Caja, donde Tomás tiene su solape... eso no lo hace
// imposible para Leo. El imposible de verdad: mover el turno de Tomás encima de su propio gemelo.
{
    const antes = await barras();

    // Los dos turnos de Tomás (martes, Caja) se pisan: cualquiera de los dos, movido al mismo día,
    // sigue solapando. Se coge el turno de Leo del lunes y se lleva al MISMO día que su otro turno.
    // Más simple y más honesto: Iker (Barra, lunes 12–20) tiene turno TODOS los días de 12 a 20.
    // Moverlo del lunes al martes lo hace chocar con el suyo del martes → IMPOSIBLE.
    const iker = await page.$$eval('[data-t=carril][data-persona="Iker Blanco"] [data-assignment-id]', (e) => e.map((x) => x.dataset.assignmentId));
    const id = iker[0];

    const desde = await centroDeBarra(id);
    const hasta = await centroDeCelda(1, dia(1));   // Barra, martes

    await arrastrar(desde, hasta);

    const visible = await dialogo().isVisible().catch(() => false);
    const resultado = visible ? await dialogo().getAttribute('data-resultado') : null;
    const motivos = visible ? await page.locator('[data-t=motivos] li').allInnerTexts() : [];

    ok('sale el diálogo, y dice IMPOSIBLE', resultado === 'imposible', resultado ?? 'no salió');
    ok('y EXPLICA por qué', motivos.length > 0 && /solape/i.test(motivos.join(' ')), motivos[0]?.split('\n')[0] ?? '—');

    await foto('1-imposible');

    await page.locator('[data-t=cancelar]').click();
    await page.waitForTimeout(400);

    ok('NO se ha escrito nada: la barra vuelve a su sitio', await barras() === antes, `${await barras()} barras (antes ${antes})`);
}

/* ── 2. FORZAR UN INCUMPLIMIENTO ───────────────────────────────────────────────── */

di();
di('2. FORZAR UN INCUMPLIMIENTO: Leo (Caja) tiene el descanso corto del lunes.');

await ir();

{
    // Sara, Cocina, martes 08–16. Se mueve al lunes: choca con su descanso corto (la víspera acaba
    // a medianoche) → INCUMPLIMIENTO, no imposible.
    const sara = await page.$$eval('[data-t=carril][data-persona="Sara Gil"] [data-assignment-id]', (e) => e.map((x) => x.dataset.assignmentId));

    // El del lunes ya está forzado; se coge el del MARTES y se lleva al miércoles, que no rompe nada.
    // Para provocar un incumplimiento de verdad: mover el turno de Leo del miércoles al martes,
    // donde Tomás… no. Se usa el camino directo: COLOCAR a Leo el domingo en Caja a las 02:00,
    // que le deja 2 h de descanso respecto a su turno del sábado.
    const antes = await barras();

    di('   (se hace con el panel: se coloca a Leo el domingo de madrugada)');

    const ficha = page.locator('[data-t=ficha][data-persona="Leo Ferrer"]');

    if (! await ficha.count()) {
        ok('la ficha de Leo está en el panel', false, 'no se encontró');
    } else {
        const desde = await fichaDe('Leo Ferrer');
        const hasta = await centroDeCelda(4, dia(6));   // Caja, domingo

        await arrastrar(desde, hasta);

        ok('se abre el popover de horas', await popover().isVisible().catch(() => false));

        await page.locator('[data-t=start]').fill('02:00');
        await page.locator('[data-t=end]').fill('06:00');
        await page.waitForTimeout(900);

        const previa = await page.locator('[data-t=previsualizacion]').getAttribute('data-severidad').catch(() => null);

        ok('la previsualización EN VIVO ya dice que incumple', previa === 'breach', previa ?? 'sin previsualización');

        await foto('2-popover-previsualizacion');

        await page.locator('[data-t=colocar]').click();
        await page.waitForTimeout(900);

        const resultado = await dialogo().getAttribute('data-resultado').catch(() => null);

        ok('al colocar, PREGUNTA antes de escribir', resultado === 'necesita_decision', resultado ?? 'no preguntó');

        // ⚠️ Y no se puede forzar sin decir por qué.
        const deshabilitado = await page.locator('[data-t=forzar]').isDisabled();

        ok('el botón de forzar está BLOQUEADO sin justificación', deshabilitado);

        await page.locator('[data-t=motivo]').fill('Cierra la caja del domingo. Se compensa el martes.');
        await page.waitForTimeout(200);

        await foto('2-dialogo-forzar');

        ok('y se desbloquea al escribirla', ! await page.locator('[data-t=forzar]').isDisabled());

        await page.locator('[data-t=forzar]').click();
        await page.waitForTimeout(2500);

        ok('se ha escrito', await barras() === antes + 1, `${await barras()} barras (antes ${antes})`);
    }
}

/* ── 3. NO CUALIFICADO ─────────────────────────────────────────────────────────── */

di();
di('3. COLOCAR A ALGUIEN NO CUALIFICADO: Sara es de Cocina. Se la lleva a Barra.');

await ir();

{
    /*
     * ⚠️ EL DOMINGO, Y NO EL MIÉRCOLES. Y esto lo destapó el propio instrumento.
     *
     * Con el miércoles, Sara YA TIENE su turno de cocina de 12 a 20, así que colocarla en Barra a
     * esa hora es un SOLAPE — un imposible— y el imposible se come al «no cualificado». El test
     * pasaba (el texto contenía la palabra) y estaba probando OTRA COSA: un aprobado por casualidad.
     *
     * El domingo Sara está libre. Ahí, lo único que falla es la cualificación — que es exactamente
     * lo que este caso viene a probar. Y es un INCUMPLIMIENTO, no un imposible: se puede forzar.
     */
    const desde = await fichaDe('Sara Gil');
    const hasta = await centroDeCelda(1, dia(6));   // Barra, domingo (Sara está libre)

    await arrastrar(desde, hasta);
    await page.waitForTimeout(700);

    await page.locator('[data-t=start]').fill('10:00');
    await page.locator('[data-t=end]').fill('12:00');
    await page.waitForTimeout(900);

    const sev = await page.locator('[data-t=previsualizacion]').getAttribute('data-severidad');
    const texto = await page.locator('[data-t=previsualizacion]').innerText();

    ok('la previsualización dice que NO está cualificada', /cualificad/i.test(texto), texto.split('\n')[0]);
    ok('y es un INCUMPLIMIENTO, no un imposible: se puede forzar', sev === 'breach', sev ?? '—');
    ok('y el botón de colocar NO está bloqueado', ! await page.locator('[data-t=colocar]').isDisabled());

    await foto('3-no-cualificado');

    await page.locator('[data-t=cancelar]').click();
}

/* ── 4. DE BAJA ────────────────────────────────────────────────────────────────── */

di();
di('4. COLOCAR A ALGUIEN DE BAJA: Ana está de baja de miércoles a viernes.');

await ir();

{
    const desde = await fichaDe('Ana López');
    const hasta = await centroDeCelda(1, dia(3));   // Barra, jueves (está de baja)

    await arrastrar(desde, hasta);
    await page.waitForTimeout(700);

    await page.locator('[data-t=start]').fill('12:00');
    await page.locator('[data-t=end]').fill('20:00');
    await page.waitForTimeout(900);

    const sev = await page.locator('[data-t=previsualizacion]').getAttribute('data-severidad');
    const texto = await page.locator('[data-t=previsualizacion]').innerText();

    ok('la previsualización dice IMPOSIBLE', sev === 'impossible', sev ?? '—');
    ok('y dice que está ausente', /ausente|baja/i.test(texto), texto.split('\n')[0]);
    ok('y el botón de colocar está BLOQUEADO', await page.locator('[data-t=colocar]').isDisabled());

    await foto('4-de-baja');

    await page.locator('[data-t=cancelar]').click();
}

/* ── 4bis. MOVER UN TURNO ROMPE OTRO ───────────────────────────────────────────── */

di();
di('4bis. MOVER UN TURNO ROMPE OTRA CELDA. Y el repintado tiene que enseñarlo.');
di('      Barra pide DOS personas el lunes de 12 a 20, y hay dos: Ana e Iker.');
di('      Se lleva a Iker al domingo → el LUNES se queda con uno. Falta uno.');

await ir();

{
    /*
     * ⚠️ ESTE CASO ES EL QUE JUSTIFICA QUE EL INFORME VAYA **DETRÁS** DE LA ESCRITURA.
     *
     * La escritura NO calcula los daños colaterales, y no le hace falta: al terminar, el cliente
     * pide la página otra vez y las props DIFERIDAS (`violations` y `coverage`) se recalculan sobre
     * el estado REAL, para TODA la semana. El hueco que se abre en OTRA celda —una que la escritura
     * ni siquiera tocó— se pinta solo.
     *
     * Y se comprueba que pasa DE VERDAD en la pantalla. «Debería» no es una medida.
     *
     * ⚠️ Con las horas conservadas, MOVER casi nunca crea un incumplimiento nuevo (el descanso y el
     * tope son de la persona, y moverla de día a la misma hora rara vez los toca). Lo que SÍ crea,
     * siempre, es un HUECO DE COBERTURA en la celda de la que se fue. Ese es el colateral de verdad,
     * y es el que la parrilla tiene que enseñar sin que nadie se lo pida.
     */
    const huecosAntes = await page.$$eval('[data-t=tramo][data-estado=missing]', (e) => e.length);
    const indicadorAntes = (await page.locator('[data-t=indicador]').innerText()).replace(/\s+/g, ' ');

    const iker = await page.$$eval(
        '[data-t=carril][data-persona="Iker Blanco"] [data-assignment-id]',
        (e) => e.map((x) => x.dataset.assignmentId),
    );

    const desde = await centroDeBarra(iker[0]);          // Barra, lunes
    const hasta = await centroDeCelda(1, dia(6));        // Barra, domingo

    await arrastrar(desde, hasta);
    await page.waitForTimeout(3500);   // el informe diferido tarda; sin esperarlo se mide lo viejo

    const huecosDespues = await page.$$eval('[data-t=tramo][data-estado=missing]', (e) => e.length);
    const indicadorDespues = (await page.locator('[data-t=indicador]').innerText()).replace(/\s+/g, ' ');

    di(`      tramos en rojo: ${huecosAntes} → ${huecosDespues}`);
    di(`      indicador: «${indicadorAntes}»`);
    di(`             →   «${indicadorDespues}»`);

    ok('la celda que PERDIÓ el turno se queda con un hueco rojo', huecosDespues > huecosAntes,
        `${huecosAntes} → ${huecosDespues}`);

    ok('y el indicador se recalcula solo (el informe volvió a correr)', indicadorDespues !== indicadorAntes);

    await foto('4bis-colateral');
}

/* ── 5. SOLTAR EN EL MISMO SITIO ───────────────────────────────────────────────── */

di();
di('5. SOLTAR EN EL MISMO SITIO: no es una escritura. Es un no-op.');

await ir();

{
    const antes = await barras();

    const iker = await page.$$eval('[data-t=carril][data-persona="Iker Blanco"] [data-assignment-id]', (e) => e.map((x) => x.dataset.assignmentId));
    const id = iker[0];

    const desde = await centroDeBarra(id);

    // Se mueve un poco y se vuelve: misma celda.
    await page.mouse.move(desde.x, desde.y);
    await page.mouse.down();
    await page.mouse.move(desde.x + 30, desde.y + 10, { steps: 8 });
    await page.mouse.move(desde.x, desde.y, { steps: 8 });
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(900);

    ok('no sale ningún diálogo', ! await dialogo().isVisible().catch(() => false));
    ok('y el número de turnos NO cambia', await barras() === antes, `${await barras()} (antes ${antes})`);
}

/* ── 6. QUITAR: LA PAPELERA ────────────────────────────────────────────────────── */

di();
di('6. QUITAR ARRASTRANDO A LA PAPELERA.');

await ir();

{
    const antes = await barras();

    const iker = await page.$$eval('[data-t=carril][data-persona="Iker Blanco"] [data-assignment-id]', (e) => e.map((x) => x.dataset.assignmentId));
    const desde = await centroDeBarra(iker[0]);

    await page.mouse.move(desde.x, desde.y);
    await page.mouse.down();
    await page.mouse.move(desde.x + 20, desde.y + 20, { steps: 5 });

    const papelera = await page.locator('[data-t=papelera]').isVisible().catch(() => false);

    ok('la papelera APARECE al empezar a arrastrar', papelera);

    await foto('6-papelera');

    const caja = await page.locator('[data-t=papelera]').boundingBox();

    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2, { steps: 15 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(2500);

    ok('el turno se ha quitado', await barras() === antes - 1, `${await barras()} (antes ${antes})`);
}

/* ── 7. QUITAR: LA TECLA Supr ──────────────────────────────────────────────────── */

di();
di('7. QUITAR CON LA TECLA Supr (el camino sin ratón).');

await ir();

{
    const antes = await barras();

    const iker = await page.$$eval('[data-t=carril][data-persona="Iker Blanco"] [data-assignment-id]', (e) => e.map((x) => x.dataset.assignmentId));

    await page.locator(`[data-assignment-id="${iker[0]}"]`).first().focus();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(2500);

    ok('el turno se ha quitado', await barras() === antes - 1, `${await barras()} (antes ${antes})`);
}

/* ══════════════════════════════════════════════════════════════════════════════ */

await browser.close();

di();
di('═'.repeat(96));

if (fallos.length) {
    di(`❌ ${fallos.length} FALLOS:`);
    di();
    fallos.forEach((f) => di(`   · ${f}`));
} else {
    di('✅ Se arrastra, se coloca, se mueve y se quita. El imposible explica, el incumplimiento');
    di('   pregunta, y sin justificación no se fuerza.');
}

di();

writeFileSync(new URL('./salida/arrastrar.txt', import.meta.url), salida);

process.exit(fallos.length ? 1 : 0);
