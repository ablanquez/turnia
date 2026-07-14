/**
 * USAR LA APP. Con el ratón. Como un humano.
 *
 * Esto NO es un test: no hay asserts. Hace los gestos, saca capturas y IMPRIME lo que ve, para
 * poder mirarlo con los ojos. Los tests dicen «pasa». Esto dice «qué se ve».
 *
 *   node tests/Visual/usar.mjs
 */
import { chromium } from 'playwright';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdirSync, writeFileSync } from 'fs';
import { entrar, lunesDe } from './pixel.mjs';

const BASE = 'http://turnia.test';
const LUNES = lunesDe(0);
const SEMANA = `/companies/1/calendars/1/schedule?week=${LUNES}`;
const correr = promisify(execFile);
const PHP = String.raw`C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe`;

const dia = (n) => { const d = new Date(LUNES); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

let salida = '';
const di = (s = '') => { salida += s + '\n'; console.log(s); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });
const foto = async (n) => writeFileSync(new URL(`./salida/usar-${n}.png`, import.meta.url), await page.screenshot());

const ir = async () => {
    await correr(PHP, ['artisan', 'migrate:fresh', '--seed', '--quiet']);
    await entrar(page, BASE);
    await page.evaluate(() => localStorage.setItem('turnia.panel-plantilla', 'abierto'));
    await page.goto(`${BASE}${SEMANA}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-t=indicador]', { timeout: 90000 });
    await page.waitForTimeout(2500);
};

const barra = (id) => page.locator(`[data-t=barra][data-assignment-id="${id}"]`).first();
const centro = async (loc) => { const c = await loc.boundingBox(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; };
const celda = async (pos, d) => { const c = await page.locator(`[data-position-id="${pos}"][data-date="${d}"]`).first().boundingBox(); return { x: c.x + c.width / 2, y: c.y + 40 }; };

const idsDe = (persona) => page.$$eval(
    `[data-t=carril][data-persona="${persona}"] [data-t=barra][data-assignment-id]`,
    (e) => e.map((x) => ({ id: x.dataset.assignmentId, w: +x.getBoundingClientRect().width.toFixed(1) })),
);

const arrastrar = async (a, b, pasos = 25) => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 8, a.y + 8, { steps: 3 });
    await page.mouse.move(b.x, b.y, { steps: pasos });
    await page.waitForTimeout(700);
    await page.mouse.up();
};

/* ═══ 1. AGARRAR UN TURNO DE UNA HORA ═══════════════════════════════════════ */
di('\n1. MARCO, MIÉRCOLES. Su turno de 1 h (21:00–22:00) y su turno de 8 h (12:00–20:00).');
await ir();
{
    const bs = await idsDe('Marco Ruiz');
    const corta = bs.slice().sort((a, b) => a.w - b.w)[0];
    const larga = bs.slice().sort((a, b) => b.w - a.w)[0];
    di(`   la barra de 1 h mide ${corta.w} px de ancho · la de 8 h, ${larga.w} px`);

    const rot = page.locator(`[data-rotulo-de="${corta.id}"]`).first();
    const cajaRot = await rot.boundingBox();
    di(`   su rótulo mide ${cajaRot.width.toFixed(0)} × ${cajaRot.height.toFixed(0)} px`);

    const leer = () => page.$$eval('[data-t=carril][data-persona="Marco Ruiz"] [data-t=barra]', (e) => Object.fromEntries(
        e.map((x) => [x.dataset.assignmentId, getComputedStyle(x).boxShadow]),
    ));
    const rotBg = () => page.$$eval('[data-t=carril][data-persona="Marco Ruiz"] [data-t=rotulo]', (e) => Object.fromEntries(
        e.map((x) => [x.dataset.rotuloDe, getComputedStyle(x).backgroundColor]),
    ));

    const antesB = await leer(); const antesR = await rotBg();
    await page.mouse.move(cajaRot.x + cajaRot.width / 2, cajaRot.y + cajaRot.height / 2);
    await page.waitForTimeout(400);
    const conB = await leer(); const conR = await rotBg();

    di(`   ratón SOBRE el rótulo de la barra de 1 h (id ${corta.id}):`);
    for (const id of Object.keys(conB)) {
        const cambioBarra = conB[id] !== antesB[id];
        const cambioRot = conR[id] !== antesR[id];
        di(`     barra ${id} (${bs.find((b) => b.id === id).w} px) → barra ${cambioBarra ? 'RESALTADA' : 'igual'} · rótulo ${cambioRot ? 'RESALTADO' : 'igual'}`);
    }
    di(`     fondo del rótulo resaltado: ${conR[corta.id]}`);
    await foto('1a-hover-rotulo-1h');

    // Y ahora el hover sobre el rótulo del turno LARGO, para ver si se distinguen.
    const rotL = await page.locator(`[data-rotulo-de="${larga.id}"]`).first().boundingBox();
    await page.mouse.move(rotL.x + rotL.width / 2, rotL.y + rotL.height / 2);
    await page.waitForTimeout(400);
    const conB2 = await leer();
    di(`   ratón SOBRE el rótulo de la barra de 8 h (id ${larga.id}):`);
    for (const id of Object.keys(conB2)) {
        di(`     barra ${id} → ${conB2[id] !== antesB[id] ? 'RESALTADA' : 'igual'}`);
    }
    await foto('1b-hover-rotulo-8h');

    // Arrastrarlo POR EL RÓTULO al domingo.
    const antes = (await idsDe('Marco Ruiz')).length;
    await arrastrar({ x: cajaRot.x + cajaRot.width / 2, y: cajaRot.y + cajaRot.height / 2 }, await celda(1, dia(6)));
    await page.waitForTimeout(2500);
    const donde = await page.$eval(`[data-t=barra][data-assignment-id="${corta.id}"]`, (e) => e.closest('[data-celda-destino]')?.dataset.date).catch(() => null);
    di(`   arrastrado por el rótulo → acabó en ${donde} (domingo = ${dia(6)}) · turnos de Marco antes ${antes}`);
    await foto('1c-movido-por-rotulo');
}

/* ═══ 2. MOVER Y EL COLATERAL ═══════════════════════════════════════════════ */
di('\n2. IKER, LUNES → DOMINGO (Barra). El hueco se abre en el LUNES.');
await ir();
{
    const bs = await idsDe('Iker Blanco');
    const huecosAntes = await page.$$eval('[data-t=tramo][data-estado=missing]', (e) => e.length);
    const indAntes = (await page.locator('[data-t=indicador]').innerText()).replace(/\s+/g, ' ');

    const t0 = Date.now();
    await arrastrar(await centro(barra(bs[0].id)), await celda(1, dia(6)));

    // ¿Cuándo aparece el aviso? ¿Y cuándo el colateral?
    await page.waitForSelector('[data-t=aviso]', { timeout: 10000 });
    const tAviso = Date.now() - t0;
    const texto = await page.locator('[data-t=aviso-texto]').first().innerText();
    di(`   [${tAviso} ms] AVISO: «${texto}»`);
    await foto('2a-aviso');

    await page.waitForSelector('[data-t=aviso-colateral]', { timeout: 15000 });
    const tCol = Date.now() - t0;
    const col = await page.locator('[data-t=aviso-colateral]').first().innerText();
    di(`   [${tCol} ms] COLATERAL: «${col}»   (${tCol - tAviso} ms después del aviso)`);

    const huecosDespues = await page.$$eval('[data-t=tramo][data-estado=missing]', (e) => e.length);
    const indDespues = (await page.locator('[data-t=indicador]').innerText()).replace(/\s+/g, ' ');
    di(`   tramos rojos: ${huecosAntes} → ${huecosDespues}`);
    di(`   indicador: «${indAntes}»`);
    di(`          →   «${indDespues}»`);

    // ¿Dónde está el hueco nuevo, en píxeles? ¿Lejos del sitio donde solté?
    const rojos = await page.$$eval('[data-t=tramo][data-estado=missing]', (e) => e.map((x) => {
        const c = x.closest('[data-celda-destino]');
        const r = x.getBoundingClientRect();
        return { date: c?.dataset.date, pos: c?.dataset.positionId, x: Math.round(r.x) };
    }));
    di(`   huecos rojos ahora: ${rojos.map((r) => `${r.date}#${r.pos}@x=${r.x}`).join('  ')}`);
    await foto('2b-colateral');
}

/* ═══ 3. CLIC SIN MOVER ═════════════════════════════════════════════════════ */
di('\n3. CLIC SIN MOVER sobre la barra de Ana (lunes 12:00–20:00).');
await ir();
{
    const bs = await idsDe('Ana López');
    const c = await centro(barra(bs[0].id));
    const t0 = Date.now();
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForSelector('[data-t=popover-colocar]', { timeout: 5000 });
    di(`   [${Date.now() - t0} ms] se abre el popover · modo = ${await page.locator('[data-t=popover-colocar]').getAttribute('data-modo')}`);
    di(`   ENTRA = «${await page.locator('[data-t=start]').inputValue()}» · SALE = «${await page.locator('[data-t=end]').inputValue()}»`);
    di(`   pie: «${await page.locator('[data-t=de-donde]').innerText()}»`);
    di(`   botón «${await page.locator('[data-t=colocar]').innerText()}» → ${await page.locator('[data-t=colocar]').isDisabled() ? 'DESHABILITADO (nada que guardar)' : 'habilitado'}`);
    await foto('3a-popover-sin-cambiar');

    await page.locator('[data-t=end]').fill('21:00');
    await page.waitForTimeout(1200);
    const prev = page.locator('[data-t=previsualizacion]');
    di(`   cambio SALE a 21:00 → previsualización: «${(await prev.innerText()).replace(/\n/g, ' | ')}» (severidad=${await prev.getAttribute('data-severidad')})`);
    di(`   botón → ${await page.locator('[data-t=colocar]').isDisabled() ? 'deshabilitado' : 'HABILITADO'}`);
    await foto('3b-popover-21h');
}

/* ═══ 4. ARRASTRAR SIN QUERER (3 px) ════════════════════════════════════════ */
di('\n4. TEMBLOR DE 3 px contra ARRASTRE de 20 px.');
await ir();
{
    const bs = await idsDe('Ana López');
    const c = await centro(barra(bs[0].id));
    const n0 = await page.$$eval('[data-t=barra][data-assignment-id]', (e) => e.length);

    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 3, c.y, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const pop = await page.locator('[data-t=popover-colocar]').isVisible().catch(() => false);
    const fantasma = await page.locator('[data-t=fantasma]').isVisible().catch(() => false);
    di(`   3 px → popover ${pop ? 'ABIERTO (se leyó como CLIC)' : 'no'} · fantasma visto: ${fantasma}`);
    await foto('4a-3px');
    if (pop) { await page.locator('[data-t=cancelar]').click(); await page.waitForTimeout(300); }

    // 20 px, dentro de la MISMA celda: ¿mueve? (no debería: misma celda = no-op)
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 20, c.y + 5, { steps: 8 });
    const arr = await page.locator('[data-t=fantasma]').isVisible().catch(() => false);
    di(`   20 px → fantasma VISIBLE: ${arr} (se leyó como ARRASTRE)`);
    await foto('4b-20px-fantasma');
    await page.mouse.move(...Object.values(await celda(1, dia(2))), { steps: 15 });
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(2500);
    const donde = await page.$eval(`[data-t=barra][data-assignment-id="${bs[0].id}"]`, (e) => e.closest('[data-celda-destino]')?.dataset.date).catch(() => null);
    di(`   soltado en el miércoles → la barra está en ${donde} (miércoles = ${dia(2)}) · turnos: ${n0} → ${await page.$$eval('[data-t=barra][data-assignment-id]', (e) => e.length)}`);
    await foto('4c-movido');
}

/* ═══ 5. FORZAR ═════════════════════════════════════════════════════════════ */
di('\n5. NURIA PEÑA del panel → COCINA, VIERNES.');
await ir();
{
    const f = page.locator('[data-t=ficha][data-persona="Nuria Peña"]').first();
    await f.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const cf = await f.boundingBox();
    await arrastrar({ x: cf.x + cf.width / 2, y: cf.y + 20 }, await celda(2, dia(4)));
    await page.waitForTimeout(900);
    di(`   popover abierto: ${await page.locator('[data-t=popover-colocar]').isVisible()}`);
    di(`   horas propuestas: ${await page.locator('[data-t=start]').inputValue()}–${await page.locator('[data-t=end]').inputValue()}`);
    const pie = await page.locator('[data-t=de-donde]').innerText().catch(() => '(sin pie)');
    di(`   pie: «${pie}»`);
    await page.locator('[data-t=start]').fill('10:00');
    await page.locator('[data-t=end]').fill('14:00');
    await page.waitForTimeout(1200);
    const prev = page.locator('[data-t=previsualizacion]');
    di(`   previsualización: «${(await prev.innerText()).replace(/\n/g, ' | ')}» (${await prev.getAttribute('data-severidad')})`);
    await foto('5a-popover-previa');

    await page.locator('[data-t=colocar]').click();
    await page.waitForTimeout(1500);
    const hayPop = await page.locator('[data-t=popover-colocar]').isVisible().catch(() => false);
    const hayDlg = await page.locator('[data-t=dialogo]').isVisible().catch(() => false);
    di(`   → diálogo: ${hayDlg} · popover TODAVÍA abierto: ${hayPop}`);
    if (hayDlg) {
        di(`   motivos: «${(await page.locator('[data-t=motivos]').innerText()).replace(/\s+/g, ' ')}»`);
        await foto('5b-dialogo');

        await page.locator('[data-t=motivo]').fill('asdf');
        await page.waitForTimeout(300);
        di(`   motivo «asdf» (4 letras) → botón forzar ${await page.locator('[data-t=forzar]').isDisabled() ? 'BLOQUEADO' : 'ACEPTADO ⚠'}`);
        await page.locator('[data-t=motivo]').fill('as');
        await page.waitForTimeout(300);
        di(`   motivo «as» (2 letras)   → botón forzar ${await page.locator('[data-t=forzar]').isDisabled() ? 'BLOQUEADO' : 'ACEPTADO ⚠'}`);

        await page.locator('[data-t=motivo]').fill('Cubre el turno de Sara, que está de baja. Se compensa el martes.');
        await page.waitForTimeout(300);
        await page.locator('[data-t=forzar]').click();
        await page.waitForTimeout(2800);
        const av = await page.locator('[data-t=aviso-texto]').first().innerText().catch(() => '(sin aviso)');
        const tono = await page.locator('[data-t=aviso]').first().getAttribute('data-tono').catch(() => '—');
        di(`   AVISO (tono=${tono}): «${av}»`);
        const muescas = await page.$$eval('[data-t=muesca]', (e) => e.length);
        di(`   muescas de forzado en la parrilla: ${muescas}`);
        await foto('5c-forzado');
    }
}

/* ═══ 6. QUITAR Y DESHACER ══════════════════════════════════════════════════ */
di('\n6. QUITAR CON Supr, Y DESHACER.');
await ir();
{
    const bs = await idsDe('Iker Blanco');
    const n0 = await page.$$eval('[data-t=barra][data-assignment-id]', (e) => e.length);
    await barra(bs[0].id).focus();
    const t0 = Date.now();
    await page.keyboard.press('Delete');
    await page.waitForSelector('[data-t=aviso]', { timeout: 8000 });
    di(`   [${Date.now() - t0} ms] AVISO: «${await page.locator('[data-t=aviso-texto]').first().innerText()}»`);
    di(`   botón deshacer visible: ${await page.locator('[data-t=deshacer]').isVisible()}`);
    await page.waitForTimeout(2200);
    di(`   turnos: ${n0} → ${await page.$$eval('[data-t=barra][data-assignment-id]', (e) => e.length)}`);
    await foto('6a-quitado');

    // ¿Cuánto dura? Se mide sin pulsar nada... pero primero deshacemos.
    await page.locator('[data-t=deshacer]').click();
    await page.waitForTimeout(3000);
    di(`   tras DESHACER → turnos: ${await page.$$eval('[data-t=barra][data-assignment-id]', (e) => e.length)}`);
    di(`   aviso ahora: «${await page.locator('[data-t=aviso-texto]').first().innerText().catch(() => '(ninguno)')}»`);
    await foto('6b-deshecho');

    // La duración: se quita otro y se espera.
    const bs2 = await idsDe('Ana López');
    await barra(bs2[0].id).focus();
    await page.keyboard.press('Delete');
    await page.waitForSelector('[data-t=aviso]', { timeout: 8000 });
    const t1 = Date.now();
    await page.waitForSelector('[data-t=aviso]', { state: 'detached', timeout: 20000 }).catch(() => null);
    di(`   el aviso CON deshacer duró ${((Date.now() - t1) / 1000).toFixed(1)} s antes de desvanecerse`);
}

/* ═══ 7. EL IMPOSIBLE ═══════════════════════════════════════════════════════ */
di('\n7. IKER DEL LUNES AL MARTES (donde ya tiene turno de 12 a 20) → solape consigo mismo.');
await ir();
{
    const bs = await idsDe('Iker Blanco');
    const n0 = await page.$$eval('[data-t=barra][data-assignment-id]', (e) => e.length);
    const c = await centro(barra(bs[0].id));

    // ¿Qué se ve MIENTRAS se arrastra por encima de la celda imposible?
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 8, c.y + 8, { steps: 3 });
    const destino = await celda(1, dia(1));
    await page.mouse.move(destino.x, destino.y, { steps: 20 });
    await page.waitForTimeout(900);
    const marca = await page.locator('[data-celda-destino][data-date="' + dia(1) + '"][data-position-id="1"]').getAttribute('class').catch(() => '');
    di(`   sobrevolando el martes (antes de soltar): fantasma visible = ${await page.locator('[data-t=fantasma]').isVisible()}`);
    await foto('7a-sobrevolando');
    await page.mouse.up();
    await page.waitForTimeout(1500);

    const dlg = page.locator('[data-t=dialogo]');
    di(`   ¿deja soltar? SÍ. Diálogo: ${await dlg.isVisible()} · resultado=${await dlg.getAttribute('data-resultado')}`);
    di(`   cabecera: «${(await dlg.locator('div').first().innerText()).replace(/\n/g, ' · ')}»`);
    di(`   motivos: «${(await page.locator('[data-t=motivos]').innerText()).replace(/\s+/g, ' ')}»`);
    di(`   botones: ${(await page.locator('[data-t=dialogo] button').allInnerTexts()).join(' | ')}`);
    await foto('7b-imposible');
    await page.locator('[data-t=cancelar]').click();
    await page.waitForTimeout(800);
    const donde = await page.$eval(`[data-t=barra][data-assignment-id="${bs[0].id}"]`, (e) => e.closest('[data-celda-destino]')?.dataset.date).catch(() => null);
    di(`   tras cerrar: la barra está en ${donde} (lunes = ${dia(0)}) · turnos ${n0} → ${await page.$$eval('[data-t=barra][data-assignment-id]', (e) => e.length)}`);
    await foto('7c-vuelta');
}

/* ═══ 8. EL HOVER Y LA ALARMA ═══════════════════════════════════════════════ */
di('\n8. EL HOVER SOBRE UNA BARRA IMPOSIBLE. ¿Sigue el anillo rojo?');
await ir();
{
    const bs = await idsDe('Tomás Vega');
    di(`   Tomás tiene ${bs.length} barras visibles`);
    // La que tenga anillo rojo.
    const conAnillo = await page.$$eval('[data-t=barra]', (e) => e.map((x) => ({
        id: x.dataset.assignmentId, s: getComputedStyle(x).boxShadow, p: x.closest('[data-t=carril]')?.dataset.persona,
    })).filter((x) => x.s.includes('200, 30, 30')));
    di(`   barras con anillo ROJO (imposible) en la parrilla: ${conAnillo.length} → ${conAnillo.map((c) => c.p).join(', ')}`);

    const objetivo = conAnillo[0];
    const loc = page.locator(`[data-t=barra][data-assignment-id="${objetivo.id}"]`).first();
    const caja = await loc.boundingBox();

    const pixelDe = async (nombre) => {
        const buf = await page.screenshot();
        writeFileSync(new URL(`./salida/usar-${nombre}.png`, import.meta.url), buf);
        return page.evaluate(async ([b64, x, y]) => {
            const img = new Image();
            img.src = 'data:image/png;base64,' + b64;
            await img.decode();
            const cv = new OffscreenCanvas(img.width, img.height);
            const g = cv.getContext('2d');
            g.drawImage(img, 0, 0);
            const px = (xx, yy) => [...g.getImageData(Math.round(xx), Math.round(yy), 1, 1).data].slice(0, 3);
            return { anilloArriba: px(x, y - 2.5), relleno: px(x, y + 8), anilloAbajo: px(x, y + 18.5) };
        }, [buf.toString('base64'), caja.x + caja.width / 2, caja.y]);
    };

    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    const sin = await pixelDe('8a-sin-hover');
    di(`   SIN el ratón encima  → anillo arriba rgb(${sin.anilloArriba}) · relleno rgb(${sin.relleno}) · anillo abajo rgb(${sin.anilloAbajo})`);
    di(`      css: ${objetivo.s}`);

    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await page.waitForTimeout(500);
    const con = await pixelDe('8b-con-hover');
    const css = await loc.evaluate((e) => getComputedStyle(e).boxShadow);
    di(`   CON el ratón encima  → anillo arriba rgb(${con.anilloArriba}) · relleno rgb(${con.relleno}) · anillo abajo rgb(${con.anilloAbajo})`);
    di(`      css: ${css}`);
    const igual = JSON.stringify(sin.anilloArriba) === JSON.stringify(con.anilloArriba);
    di(`   → el anillo ${igual ? 'ES EL MISMO PÍXEL' : '¡¡CAMBIÓ!!'}`);
}

await browser.close();
writeFileSync(new URL('./salida/usar.txt', import.meta.url), salida);
di('\n(capturas en tests/Visual/salida/usar-*.png)');
