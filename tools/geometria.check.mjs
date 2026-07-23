/*
 * INSTRUMENTO DE GEOMETRÍA — mide el PÍXEL RESULTANTE de la parrilla, no el declarado.
 *
 *   npm run geometria              → mide la parrilla servida y da un veredicto.
 *   npm run geometria -- --selftest → contrapruebas: inyecta cada fallo y confirma que el detector salta.
 *   GEO_URL=http://… npm run geometria  → mide otra URL (por defecto http://localhost:5173/).
 *
 * ⚠️ DÓNDE Y CUÁNDO SE CORRE — y por qué NO va en el hook:
 *   Necesita un NAVEGADOR de verdad (Playwright/Chromium) y el SERVIDOR levantado (npm run dev o
 *   preview). Es LENTO (arranca un navegador, saca capturas). Por eso NO entra en el hook de commit,
 *   que debe ser rápido y no depender de nada levantado. Se corre A MANO al CERRAR un bloque que toque
 *   la parrilla, y en CI si algún día lo hay. Es una BESTIA DISTINTA de los checkers de color
 *   (sin-hex, contraste): esos auditan la FUENTE, son puros y rápidos y sí van en el hook. Este audita
 *   lo RENDERIZADO. No se juntan a propósito.
 *
 * CINCO AFIRMACIONES (geometría, no rótulos):
 *   3.a  la barra de 1 h mide 1/8 de la de 8 h (ratio 0,125), fiel a su duración.
 *   3.b  la de 1 h y la de 8 h pintan el MISMO color resultante (píxel del canvas, no el hex).
 *   3.c  ninguna barra contiene texto (la barra es identidad pura; el texto vive en la ficha).
 *   3.d  ninguna barra se recorta por el borde de su pista (el eje se ensancha, no recorta).
 *   3.e  las líneas de la rejilla caen en horas redondas, también con el eje ensanchado.
 *        (Nace de un fallo real: la rejilla estuvo desalineada en 04:00 y nada lo miraba. Ver bitácora.)
 *
 * DOS AFIRMACIONES MÁS, DEL ARRASTRE (Bloque 4): el instrumento CONDUCE un movimiento y mide lo
 * renderizado durante y después:
 *   M.color     DURANTE el arrastre, la barra del proxy pinta el MISMO color de identidad que una
 *               barra estática de esa persona (dist ≈ 0). Convierte la restricción «el arrastre no
 *               toca el color» de promesa en PROPIEDAD DEMOSTRADA: si alguien mete una opacidad al
 *               arrastrar, esto salta. (La API estándar de DnD lo violaría por diseño; ver bitácora.)
 *   M.aterriza  TRAS soltar, la barra movida cae DENTRO del rect de su celda destino (no a medias ni
 *               fuera). El movimiento reubica de verdad, sin desbordar.
 *   M.retima    TRAS retimar (arrastrar dentro de la misma celda), la barra ATERRIZA en la posición
 *               de su NUEVO horario (calibrando x→minutos con las marcas, independientes de la barra).
 *   E.tope      En el editor, llevar el tirador del fin más allá del mínimo NO produce una duración
 *               menor de 5 min (el suelo estructural se cumple; la duración cero es inalcanzable).
 *   M.color-editor  La barra del editor pinta el color DECLARADO (rendered vs computed backgroundColor,
 *               que la opacidad no altera): los tiradores tampoco tocan el color.
 *   E.teclado   Teclear en el <input type=time> del fin un valor sub-mínimo (1 min tras el inicio)
 *               tampoco baja la duración renderizada de 5 min: el muro se aplica al camino de teclado,
 *               no solo a los tiradores (donde vivía TODA la protección hasta la 2.c).
 *   ⚠️ Se corre igual: A MANO al cerrar un bloque que toque la parrilla. Conduce el arrastre con
 *      page.mouse (eventos de puntero reales), así que también necesita navegador + servidor.
 *
 * LAS TRES DEFENSAS que a los instrumentos borrados del Bloque 3 les faltaban:
 *   GUARDIA     — antes de dar verde comprueba sus precondiciones (¿hay barras? ¿color real? ¿líneas?).
 *                 Si una falla, EL QUE SE SUSPENDE ES EL INSTRUMENTO, no el código. No da verde sobre
 *                 "no encontré nada que medir".
 *   TRES ESTADOS con código de salida distinto: 0 VERDE · 1 CAZADO · 2 NO PROBADA/REVENTÓ.
 *                 Reventar (timeout, selector roto, servidor caído, precondición fallida) NO es cazar.
 *   --selftest  — inyecta cada fallo en el DOM y confirma que su detector salta. Si alguno NO salta,
 *                 ese detector no prueba nada aunque el instrumento esté "verde": se declara NO FIABLE.
 */
import { chromium } from 'playwright';

const URL = process.env.GEO_URL || 'http://localhost:5173/';
const SELFTEST = process.argv.includes('--selftest');
const VERDE = 0, CAZADO = 1, NO_PROBADA = 2;

/* ── Medición, en el NAVEGADOR. Recibe la captura (base64) para muestrear el píxel resultante. ── */
function medirEnPagina(b64) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
            const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
            const escala = img.width / window.innerWidth;
            const px = (x, y) => { const d = ctx.getImageData(Math.round(x * escala), Math.round(y * escala), 1, 1).data; return [d[0], d[1], d[2]]; };
            const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
            const rect = (el) => el.getBoundingClientRect();
            const barras = [...document.querySelectorAll('[data-t=barra]')];

            // ── GUARDIA: ¿tengo lo que necesito para medir? ──
            const fallos = [];
            if (barras.length < 8) fallos.push(`solo ${barras.length} barras (esperaba ≥8): ¿parrilla cargada?`);
            const elena = barras.filter((b) => b.getAttribute('data-persona') === 'elena').map((b) => ({ el: b, w: rect(b).width })).sort((a, b) => a.w - b.w);
            if (elena.length < 2) fallos.push(`Elena tiene ${elena.length} barra(s) (esperaba ≥2 para ratio y color)`);
            else if (!(elena[elena.length - 1].w > elena[0].w + 2)) fallos.push('las barras de Elena no tienen anchos distintos (no hay 1h vs 8h)');
            const pistasLineas = [...document.querySelectorAll('.bg-sunken')].filter((p) => p.querySelectorAll('[data-t=linea]').length >= 4);
            if (!pistasLineas.length) fallos.push('ninguna pista con ≥4 líneas de rejilla');
            let colorAncho = null;
            if (elena.length >= 2) { const a = rect(elena[elena.length - 1].el); colorAncho = px(a.left + a.width / 2, a.top + 3); if (colorAncho[0] + colorAncho[1] + colorAncho[2] === 0) fallos.push('el color de la barra se lee como negro/cero (¿canvas ilegible?)'); }
            if (fallos.length) return resolve({ guardia: { ok: false, fallos } });

            // ── DETECTORES ──
            const viol = [];
            const estrecha = elena[0], ancho = elena[elena.length - 1];

            const ratio = estrecha.w / ancho.w;                                                    // 3.a
            if (Math.abs(ratio - 0.125) > 0.02) viol.push({ af: '3.a', detalle: `ratio ${ratio.toFixed(3)} ≠ 0,125 (1h ${estrecha.w.toFixed(1)}px / 8h ${ancho.w.toFixed(1)}px)` });

            const rE = rect(estrecha.el), rA = rect(ancho.el);                                     // 3.b
            const cE = px(rE.left + rE.width / 2, rE.top + 3), cA = px(rA.left + rA.width / 2, rA.top + 3);
            const dc = dist(cE, cA);
            if (dc > 6) viol.push({ af: '3.b', detalle: `dist ${dc.toFixed(1)} · 1h ${JSON.stringify(cE)} vs 8h ${JSON.stringify(cA)}` });

            const conTexto = barras.filter((b) => b.textContent.trim().length > 0);                // 3.c
            if (conTexto.length) viol.push({ af: '3.c', detalle: `${conTexto.length} barra(s) con texto, p. ej. "${conTexto[0].textContent.trim().slice(0, 16)}"` });

            const recort = barras.map((b) => { const p = b.closest('.bg-sunken'); if (!p) return null; const pr = rect(p), q = rect(b); return { per: b.getAttribute('data-persona'), dLeft: +(q.left - pr.left).toFixed(1), dRight: +(q.right - pr.right).toFixed(1) }; }).filter((x) => x && (x.dLeft < -0.5 || x.dRight > 0.5));
            if (recort.length) viol.push({ af: '3.d', detalle: `${recort.length} barra(s) fuera de su pista: ${JSON.stringify(recort[0])}` });

            const malas = [];                                                                      // 3.e
            for (const pista of pistasLineas) {
                const bar = pista.querySelector('[data-t=barra]');
                const horaEl = pista.parentElement.querySelector('.font-mono');
                if (!bar || !horaEl) continue;
                const m = horaEl.textContent.trim().match(/(\d\d):(\d\d).(\d\d):(\d\d)/);
                if (!m) continue;
                let ini = (+m[1]) * 60 + (+m[2]); let fin = (+m[3]) * 60 + (+m[4]); if (fin <= ini) fin += 1440;
                const pr = rect(pista), br = rect(bar);
                const xIni = br.left - pr.left, xFin = br.right - pr.left;
                if (xFin - xIni < 20) continue; // span corto → poca precisión para anclar
                const minPorPx = (fin - ini) / (xFin - xIni);
                for (const l of pista.querySelectorAll('[data-t=linea]')) {
                    const xL = rect(l).left - pr.left;
                    const min = ini + (xL - xIni) * minPorPx;
                    const horaNum = ((Math.round(min / 60) % 24) + 24) % 24;
                    const hhMed = String(horaNum).padStart(2, '0') + ':00';
                    const et = l.getAttribute('data-hora');
                    if (hhMed !== et) malas.push({ etiqueta: et, medida: hhMed, enFicha: horaEl.textContent.trim() });
                    else if (horaNum % 6 !== 0) malas.push({ etiqueta: et, motivo: 'no es hora redonda de 6h' });
                }
            }
            if (malas.length) viol.push({ af: '3.e', detalle: `${malas.length} línea(s) fuera de su hora: ${JSON.stringify(malas[0])}` });

            resolve({ guardia: { ok: true }, violaciones: viol, datos: { nBarras: barras.length, ratio: +ratio.toFixed(3), distColor: +dc.toFixed(1), pistasConLineas: pistasLineas.length } });
        };
        img.src = 'data:image/png;base64,' + b64;
    });
}

/* ══ ESCENARIO DE MOVIMIENTO (Bloque 4) ═══════════════════════════════════════════════════════════
 * Mueve Elena·8h (Barra·Lun) → Barra·Mié y mide: (M.color) el color del proxy durante el arrastre,
 * (M.aterriza) que la barra movida cae dentro de su celda. */
const MOV = { origen: { dia: '2026-07-13', puesto: 'barra', persona: 'elena' }, destino: { dia: '2026-07-15', puesto: 'barra' } };

// En página: coords de agarre (centro de la ficha de Elena 8h) y de destino (centro de la celda).
function coordsMovimiento(m) {
    const celO = document.querySelector(`[data-celda][data-dia="${m.origen.dia}"][data-puesto="${m.origen.puesto}"]`);
    const bars = [...celO.querySelectorAll(`[data-t=barra][data-persona="${m.origen.persona}"]`)].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    const rf = bars[0].closest('.cursor-grab').getBoundingClientRect();
    const cd = document.querySelector(`[data-celda][data-dia="${m.destino.dia}"][data-puesto="${m.destino.puesto}"]`).getBoundingClientRect();
    return { gx: Math.round(rf.left + rf.width / 2), gy: Math.round(rf.top + 12), tx: Math.round(cd.left + cd.width / 2), ty: Math.round(cd.top + cd.height / 2) };
}

// En página, DURANTE el arrastre: compara el color del proxy con el de una barra estática de Elena.
function medirColorProxy(b64) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
            const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
            const escala = img.width / window.innerWidth;
            const px = (x, y) => { const d = ctx.getImageData(Math.round(x * escala), Math.round(y * escala), 1, 1).data; return [d[0], d[1], d[2]]; };
            const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
            const rect = (el) => el.getBoundingClientRect();
            const proxyBar = document.querySelector('[data-proxy] [data-t=barra]');
            const refBar = [...document.querySelectorAll('[data-t=barra][data-persona="elena"]')].find((b) => !b.closest('[data-proxy]'));
            const fallos = [];
            if (!proxyBar) fallos.push('no hay proxy en el DOM durante el arrastre (¿no se cogió la ficha?)');
            if (!refBar) fallos.push('no hay barra estática de Elena como referencia de color');
            if (fallos.length) return resolve({ guardia: { ok: false, fallos } });
            const rp = rect(proxyBar), rr = rect(refBar);
            const cp = px(rp.left + rp.width / 2, rp.top + 3), cr = px(rr.left + rr.width / 2, rr.top + 3);
            if (cp[0] + cp[1] + cp[2] === 0 || cr[0] + cr[1] + cr[2] === 0) return resolve({ guardia: { ok: false, fallos: ['color leído como cero (canvas ilegible)'] } });
            resolve({ guardia: { ok: true }, dist: dist(cp, cr), proxy: cp, ref: cr });
        };
        img.src = 'data:image/png;base64,' + b64;
    });
}

// En página, TRAS soltar: ¿la barra movida cae dentro del rect de su celda destino?
function medirAterrizaje(m) {
    const rect = (el) => el.getBoundingClientRect();
    const cel = document.querySelector(`[data-celda][data-dia="${m.destino.dia}"][data-puesto="${m.destino.puesto}"]`);
    if (!cel) return { guardia: { ok: false, fallos: ['no existe la celda destino'] } };
    const bar = cel.querySelector(`[data-t=barra][data-persona="${m.origen.persona}"]`);
    if (!bar) return { guardia: { ok: false, fallos: ['la ficha movida no está en la celda destino (¿no se soltó?)'] } };
    const rc = rect(cel), rb = rect(bar);
    const dentro = rb.left >= rc.left - 0.5 && rb.right <= rc.right + 0.5 && rb.top >= rc.top - 0.5 && rb.bottom <= rc.bottom + 0.5;
    return { guardia: { ok: true }, dentro, detalle: `barra x[${rb.left.toFixed(0)},${rb.right.toFixed(0)}] en celda x[${rc.left.toFixed(0)},${rc.right.toFixed(0)}]` };
}

// En Node: conduce el arrastre con el ratón real. opciones.inyecta* activan las contrapruebas.
async function escenarioMovimiento(page, opciones = {}) {
    await cargar(page);
    const c = await page.evaluate(coordsMovimiento, MOV);
    await page.mouse.move(c.gx, c.gy);
    await page.mouse.down();
    await page.mouse.move(c.gx + 8, c.gy + 8); // supera el umbral
    await page.mouse.move(c.tx, c.ty, { steps: 10 });
    if (opciones.inyectaColor) await page.evaluate(() => { const b = document.querySelector('[data-proxy] [data-t=barra]'); if (b) b.style.opacity = '0.4'; });
    const buf = await page.screenshot();
    const rc = await page.evaluate(medirColorProxy, buf.toString('base64'));
    await page.mouse.up();
    await page.waitForTimeout(120);
    if (opciones.inyectaAterrizaje) await page.evaluate((m) => { const cel = document.querySelector(`[data-celda][data-dia="${m.destino.dia}"][data-puesto="${m.destino.puesto}"]`); const bar = cel.querySelector(`[data-t=barra][data-persona="${m.origen.persona}"]`); bar.closest('.cursor-grab').style.transform = 'translateX(600px)'; }, MOV);
    const ra = await page.evaluate(medirAterrizaje, MOV);

    const fallos = [];
    if (!rc.guardia || !rc.guardia.ok) fallos.push(...(rc.guardia?.fallos || ['medición de color del proxy indisponible']));
    if (!ra.guardia || !ra.guardia.ok) fallos.push(...(ra.guardia?.fallos || ['medición de aterrizaje indisponible']));
    if (fallos.length) return { guardia: { ok: false, fallos } };
    const viol = [];
    if (rc.dist > 8) viol.push({ af: 'M.color', detalle: `la barra CAMBIÓ de color al arrastrar: dist ${rc.dist.toFixed(1)} (proxy ${JSON.stringify(rc.proxy)} vs identidad ${JSON.stringify(rc.ref)})` });
    if (!ra.dentro) viol.push({ af: 'M.aterriza', detalle: `la ficha movida cae FUERA de su celda destino: ${ra.detalle}` });
    return { guardia: { ok: true }, violaciones: viol, datos: { distColorProxy: +rc.dist.toFixed(1), aterrizaje: ra.detalle } };
}

function decidirMovimiento(r) {
    if (!r.guardia || !r.guardia.ok) return [NO_PROBADA, `🟠 NO PROBADA (movimiento) — se suspende (precondición fallida):\n  ${r.guardia.fallos.join('\n  ')}`];
    if (r.violaciones.length) return [CAZADO, `🔴 CAZADO (movimiento) — ${r.violaciones.length} afirmación(es):\n` + r.violaciones.map((v) => `  · ${v.af}  ${v.detalle}`).join('\n')];
    return [VERDE, `🟢 VERDE (movimiento) — 2/2 OK: barra intacta al arrastrar + ficha aterriza en su celda.  ${JSON.stringify(r.datos)}`];
}

async function correrSelftestMovimiento(page) {
    const lineas = []; let fiable = true;
    const rc = await escenarioMovimiento(page, { inyectaColor: true });
    const dC = rc.guardia && rc.guardia.ok && (rc.violaciones || []).find((v) => v.af === 'M.color');
    if (dC) lineas.push(`  ✅ M.color «opacidad inyectada en la barra del proxy»\n        → ROJO: ${dC.detalle}`);
    else { fiable = false; lineas.push(`  ❌ M.color «opacidad en el proxy» → NO SALTÓ  (guardia.ok=${rc.guardia && rc.guardia.ok}; viol=${JSON.stringify(rc.violaciones)})`); }
    const ra = await escenarioMovimiento(page, { inyectaAterrizaje: true });
    const dA = ra.guardia && ra.guardia.ok && (ra.violaciones || []).find((v) => v.af === 'M.aterriza');
    if (dA) lineas.push(`  ✅ M.aterriza «ficha desplazada fuera de su celda»\n        → ROJO: ${dA.detalle}`);
    else { fiable = false; lineas.push(`  ❌ M.aterriza «ficha fuera de celda» → NO SALTÓ  (guardia.ok=${ra.guardia && ra.guardia.ok}; viol=${JSON.stringify(ra.violaciones)})`); }
    const cab = fiable
        ? '🟢 SELFTEST MOVIMIENTO OK — los 2 detectores de arrastre saben ponerse rojos.'
        : '🔴 SELFTEST MOVIMIENTO FALLÓ — algún detector de arrastre no salta (no confíes en su verde).';
    return { code: fiable ? VERDE : NO_PROBADA, salida: cab + '\n' + lineas.join('\n') };
}

/* ══ ESCENARIO DE RETIMADO (Bloque 4 · tanda 2) ═══════════════════════════════════════════════════
 * Retima Ana (Barra·Mar) arrastrándola a la derecha dentro de su celda y comprueba (M.retima) que la
 * barra ATERRIZA en la posición de su NUEVO horario: se calibra x→minutos con las marcas de hora
 * (independientes de la barra) y se contrasta con la hora que muestra la ficha. */
const RET = { dia: '2026-07-14', puesto: 'barra', persona: 'ana', dx: 45 };

function coordsFicha(m) {
    const cel = document.querySelector(`[data-celda][data-dia="${m.dia}"][data-puesto="${m.puesto}"]`);
    const bar = cel.querySelector(`[data-t=barra][data-persona="${m.persona}"]`);
    const r = bar.closest('.cursor-grab').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 12) };
}

function medirRetimado(m) {
    const rect = (el) => el.getBoundingClientRect();
    const cel = document.querySelector(`[data-celda][data-dia="${m.dia}"][data-puesto="${m.puesto}"]`);
    const bar = cel.querySelector(`[data-t=barra][data-persona="${m.persona}"]`);
    if (!bar) return { guardia: { ok: false, fallos: ['la ficha retimada no está en su celda'] } };
    const pista = bar.closest('.bg-sunken');
    const horaEl = pista.parentElement.querySelector('.font-mono');
    const mm = horaEl && horaEl.textContent.trim().match(/(\d\d):(\d\d).(\d\d):(\d\d)/);
    if (!mm) return { guardia: { ok: false, fallos: ['sin hora legible tras retimar'] } };
    const ini = (+mm[1]) * 60 + (+mm[2]);
    const marcas = [...pista.querySelectorAll('[data-t=linea]')].map((l) => ({ x: rect(l).left, min: (+l.getAttribute('data-hora').slice(0, 2)) * 60 })).sort((a, b) => a.x - b.x);
    if (marcas.length < 2) return { guardia: { ok: false, fallos: ['pista con <2 marcas para calibrar'] } };
    for (let i = 1; i < marcas.length; i++) while (marcas[i].min <= marcas[i - 1].min) marcas[i].min += 1440; // 00:00 → 1440, ascendente
    const a = marcas[0], z = marcas[marcas.length - 1];
    const iniMedido = a.min + (rect(bar).left - a.x) * ((z.min - a.min) / (z.x - a.x));
    // marco horario más cercano al medido (resuelve la ambigüedad del cruce de medianoche)
    const iniHora = [ini, ini + 1440, ini - 1440].reduce((b, c) => (Math.abs(c - iniMedido) < Math.abs(b - iniMedido) ? c : b));
    const desfase = Math.abs(iniMedido - iniHora);
    return { guardia: { ok: true }, dentro: desfase <= 20, detalle: `inicio medido ${Math.round(iniMedido)} min vs hora ${iniHora} (Δ ${Math.round(desfase)} min); ficha "${horaEl.textContent.trim()}"` };
}

async function escenarioRetimado(page, opciones = {}) {
    await cargar(page);
    const c = await page.evaluate(coordsFicha, RET);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 8, c.y); // supera el umbral, misma celda
    await page.mouse.move(c.x + RET.dx, c.y, { steps: 10 }); // desplaza a la derecha → más tarde
    await page.mouse.up();
    await page.waitForTimeout(120);
    if (opciones.inyectaAterrizaje) await page.evaluate((m) => { const cel = document.querySelector(`[data-celda][data-dia="${m.dia}"][data-puesto="${m.puesto}"]`); const bar = cel.querySelector(`[data-t=barra][data-persona="${m.persona}"]`); bar.style.transform = 'translateX(-50px)'; }, RET);
    const r = await page.evaluate(medirRetimado, RET);
    if (!r.guardia || !r.guardia.ok) return { guardia: { ok: false, fallos: r.guardia?.fallos || ['retimado no medible'] } };
    const viol = [];
    if (!r.dentro) viol.push({ af: 'M.retima', detalle: `la barra NO cayó en su nuevo horario: ${r.detalle}` });
    return { guardia: { ok: true }, violaciones: viol, datos: { retimado: r.detalle } };
}

function decidirRetimado(r) {
    if (!r.guardia || !r.guardia.ok) return [NO_PROBADA, `🟠 NO PROBADA (retimado) — se suspende:\n  ${r.guardia.fallos.join('\n  ')}`];
    if (r.violaciones.length) return [CAZADO, `🔴 CAZADO (retimado) — ${r.violaciones.length}:\n` + r.violaciones.map((v) => `  · ${v.af}  ${v.detalle}`).join('\n')];
    return [VERDE, `🟢 VERDE (retimado) — 1/1 OK: la barra aterriza en su nuevo horario.  ${JSON.stringify(r.datos)}`];
}

async function correrSelftestRetimado(page) {
    const r = await escenarioRetimado(page, { inyectaAterrizaje: true });
    const d = r.guardia && r.guardia.ok && (r.violaciones || []).find((v) => v.af === 'M.retima');
    const ok = !!d;
    const linea = ok
        ? `  ✅ M.retima «barra desplazada de su horario tras retimar»\n        → ROJO: ${d.detalle}`
        : `  ❌ M.retima «barra fuera de su horario» → NO SALTÓ  (guardia.ok=${r.guardia && r.guardia.ok}; viol=${JSON.stringify(r.violaciones)})`;
    const cab = ok
        ? '🟢 SELFTEST RETIMADO OK — el detector de retimado sabe ponerse rojo.'
        : '🔴 SELFTEST RETIMADO FALLÓ — el detector de retimado no salta.';
    return { code: ok ? VERDE : NO_PROBADA, salida: cab + '\n' + linea };
}

/* ══ ESCENARIO DEL EDITOR (Bloque 4 · tanda 2.b) ══════════════════════════════════════════════════
 * Abre el editor (lápiz de la primera ficha) y comprueba: (E.tope) que al llevar el tirador del fin
 * más allá del mínimo la duración renderizada NO baja de 30 min; (M.color-editor) que la barra del
 * editor pinta el color declarado (rendered vs computed backgroundColor, que la opacidad NO altera). */
async function abrirEditorEn(page) {
    await cargar(page);
    await page.click('button[aria-label="Editar turno"]');
    await page.waitForTimeout(150);
}
function coordsTiradorFin() {
    const fin = document.querySelector('[data-tirador=fin]').getBoundingClientRect();
    const pista = document.querySelector('[data-t=barra-editor]').parentElement.getBoundingClientRect();
    return { fx: Math.round(fin.left + fin.width / 2), fy: Math.round(fin.top + fin.height / 2), pl: Math.round(pista.left) };
}
function medirDuracionEditor() {
    const rect = (el) => el.getBoundingClientRect();
    const bar = document.querySelector('[data-t=barra-editor]');
    if (!bar) return { guardia: { ok: false, fallos: ['no hay barra en el editor (¿no abrió?)'] } };
    const pista = bar.parentElement;
    const marcas = [...pista.querySelectorAll('.bg-line-soft')].map((m) => rect(m).left).sort((a, b) => a - b);
    if (marcas.length < 2) return { guardia: { ok: false, fallos: ['<2 marcas en el editor para calibrar'] } };
    const minPorPx = 180 / (marcas[1] - marcas[0]); // marcas cada 3 h = 180 min
    return { guardia: { ok: true }, durMin: Math.round(rect(bar).width * minPorPx) };
}
function medirColorEditor(b64) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
            const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
            const escala = img.width / window.innerWidth;
            const px = (x, y) => { const d = ctx.getImageData(Math.round(x * escala), Math.round(y * escala), 1, 1).data; return [d[0], d[1], d[2]]; };
            const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
            const bar = document.querySelector('[data-t=barra-editor]');
            if (!bar) return resolve({ guardia: { ok: false, fallos: ['no hay barra en el editor'] } });
            const declar = (getComputedStyle(bar).backgroundColor.match(/\d+/g) || []).map(Number).slice(0, 3);
            const r = bar.getBoundingClientRect();
            const medido = px(r.left + r.width / 2, r.top + r.height / 2);
            if (declar.reduce((a, b) => a + b, 0) === 0 || medido.reduce((a, b) => a + b, 0) === 0) return resolve({ guardia: { ok: false, fallos: ['color cero (canvas ilegible o barra sin color)'] } });
            resolve({ guardia: { ok: true }, distColor: +dist(declar, medido).toFixed(1), declar, medido });
        };
        img.src = 'data:image/png;base64,' + b64;
    });
}

async function escenarioTope(page, opciones = {}) {
    await abrirEditorEn(page);
    const c = await page.evaluate(coordsTiradorFin);
    await page.mouse.move(c.fx, c.fy);
    await page.mouse.down();
    await page.mouse.move(c.fx - 20, c.fy);
    await page.mouse.move(c.pl + 5, c.fy, { steps: 12 }); // arrastra el fin hasta el inicio (al tope)
    await page.mouse.up();
    if (opciones.inyectaSubMin) await page.evaluate(() => { document.querySelector('[data-t=barra-editor]').style.width = '1px'; });
    const r = await page.evaluate(medirDuracionEditor);
    if (!r.guardia || !r.guardia.ok) return { guardia: r.guardia };
    const viol = [];
    // La mínima bajó a 5 en la 2.c. A ~30 px/hora, 5 min ≈ 2,5 px: medible. Umbral con margen (< 3) para
    // no falsear por ruido de medición, y la inyección (1 px ≈ 2 min) cae claramente por debajo.
    if (r.durMin < 5 - 2) viol.push({ af: 'E.tope', detalle: `el editor produjo ${r.durMin} min de duración (< 5, la mínima)` });
    return { guardia: { ok: true }, violaciones: viol, datos: { durTope: r.durMin } };
}

async function escenarioColorEditor(page, opciones = {}) {
    await abrirEditorEn(page);
    if (opciones.inyectaColor) await page.evaluate(() => { document.querySelector('[data-t=barra-editor]').style.opacity = '0.4'; });
    const buf = await page.screenshot();
    const r = await page.evaluate(medirColorEditor, buf.toString('base64'));
    if (!r.guardia || !r.guardia.ok) return { guardia: r.guardia };
    const viol = [];
    if (r.distColor > 10) viol.push({ af: 'M.color-editor', detalle: `la barra del editor cambió de color: dist ${r.distColor} (declarado ${JSON.stringify(r.declar)} vs pintado ${JSON.stringify(r.medido)})` });
    return { guardia: { ok: true }, violaciones: viol, datos: { distColorEditor: r.distColor } };
}

/* E.teclado (2.c): el TECLADO es un camino de entrada NUEVO, y toda la protección vivía en los
 * tiradores. Aquí se conduce el <input type=time> del fin a 1 min tras el inicio (pediría una duración
 * sub-mínima) y se mide que lo RENDERIZADO sigue siendo ≥ 5 — el muro se aplica también al teclado. */
async function escenarioTeclado(page, opciones = {}) {
    await abrirEditorEn(page);
    const ini = await page.inputValue('[data-hora=inicio]'); // "HH:MM"
    const [h, m] = ini.split(':').map(Number);
    const t = (h * 60 + m + 1) % 1440; // 1 min tras el inicio → sin muro daría 1 min de duración
    const finPedido = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    await page.fill('[data-hora=fin]', finPedido);
    await page.waitForTimeout(80);
    if (opciones.inyectaSubMin) await page.evaluate(() => { document.querySelector('[data-t=barra-editor]').style.width = '1px'; });
    const r = await page.evaluate(medirDuracionEditor);
    if (!r.guardia || !r.guardia.ok) return { guardia: r.guardia };
    const viol = [];
    if (r.durMin < 5 - 2) viol.push({ af: 'E.teclado', detalle: `tras teclear fin=inicio+1min, el editor renderizó ${r.durMin} min (< 5, la mínima)` });
    return { guardia: { ok: true }, violaciones: viol, datos: { durTeclado: r.durMin } };
}

function decidirEditor(rt, rc, rk) {
    const gFallos = [];
    if (!rt.guardia || !rt.guardia.ok) gFallos.push(...(rt.guardia?.fallos || ['tope no medible']));
    if (!rc.guardia || !rc.guardia.ok) gFallos.push(...(rc.guardia?.fallos || ['color no medible']));
    if (!rk.guardia || !rk.guardia.ok) gFallos.push(...(rk.guardia?.fallos || ['teclado no medible']));
    if (gFallos.length) return [NO_PROBADA, `🟠 NO PROBADA (editor) — se suspende:\n  ${gFallos.join('\n  ')}`];
    const viol = [...(rt.violaciones || []), ...(rc.violaciones || []), ...(rk.violaciones || [])];
    if (viol.length) return [CAZADO, `🔴 CAZADO (editor) — ${viol.length}:\n` + viol.map((v) => `  · ${v.af}  ${v.detalle}`).join('\n')];
    return [VERDE, `🟢 VERDE (editor) — 3/3 OK: el tope se cumple (tirador y teclado) + la barra del editor a color pleno.  ${JSON.stringify({ ...rt.datos, ...rc.datos, ...rk.datos })}`];
}

async function correrSelftestEditor(page) {
    const lineas = []; let fiable = true;
    const rt = await escenarioTope(page, { inyectaSubMin: true });
    const dt = rt.guardia && rt.guardia.ok && (rt.violaciones || []).find((v) => v.af === 'E.tope');
    if (dt) lineas.push(`  ✅ E.tope «duración por debajo de la mínima inyectada»\n        → ROJO: ${dt.detalle}`);
    else { fiable = false; lineas.push(`  ❌ E.tope → NO SALTÓ  (guardia.ok=${rt.guardia && rt.guardia.ok}; viol=${JSON.stringify(rt.violaciones)})`); }
    const rc = await escenarioColorEditor(page, { inyectaColor: true });
    const dc = rc.guardia && rc.guardia.ok && (rc.violaciones || []).find((v) => v.af === 'M.color-editor');
    if (dc) lineas.push(`  ✅ M.color-editor «opacidad inyectada en la barra del editor»\n        → ROJO: ${dc.detalle}`);
    else { fiable = false; lineas.push(`  ❌ M.color-editor → NO SALTÓ  (guardia.ok=${rc.guardia && rc.guardia.ok}; viol=${JSON.stringify(rc.violaciones)})`); }
    const rk = await escenarioTeclado(page, { inyectaSubMin: true });
    const dk = rk.guardia && rk.guardia.ok && (rk.violaciones || []).find((v) => v.af === 'E.teclado');
    if (dk) lineas.push(`  ✅ E.teclado «duración sub-mínima tecleada inyectada»\n        → ROJO: ${dk.detalle}`);
    else { fiable = false; lineas.push(`  ❌ E.teclado → NO SALTÓ  (guardia.ok=${rk.guardia && rk.guardia.ok}; viol=${JSON.stringify(rk.violaciones)})`); }
    const cab = fiable
        ? '🟢 SELFTEST EDITOR OK — E.tope, M.color-editor y E.teclado saben ponerse rojos.'
        : '🔴 SELFTEST EDITOR FALLÓ — algún detector del editor no salta.';
    return { code: fiable ? VERDE : NO_PROBADA, salida: cab + '\n' + lineas.join('\n') };
}

/* ── Las contrapruebas: cada una inyecta SU fallo en el DOM y debe hacer saltar SU detector. ── */
const CONTRAPRUEBAS = [
    { af: '3.a', nombre: 'ancho mínimo forzado a la barra de 1 h', inject: () => { const e = [...document.querySelectorAll('[data-t=barra][data-persona="elena"]')].sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width); e[0].style.width = '40px'; e[0].style.minWidth = '40px'; } },
    { af: '3.b', nombre: 'color alterado en la barra de 1 h', inject: () => { const e = [...document.querySelectorAll('[data-t=barra][data-persona="elena"]')].sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width); e[0].style.background = 'rgb(0,200,0)'; } },
    { af: '3.c', nombre: 'texto inyectado dentro de una barra', inject: () => { document.querySelector('[data-t=barra]:not([data-persona="elena"])').textContent = 'XXX'; } },
    { af: '3.d', nombre: 'barra desbordada de su pista', inject: () => { document.querySelector('[data-t=barra]:not([data-persona="elena"])').style.width = '250%'; } },
    { af: '3.e', nombre: 'línea de rejilla desplazada de su hora', inject: () => { const p = document.querySelector('[data-t=barra][data-persona="carlos"]').closest('.bg-sunken'); const l = p.querySelector('[data-t=linea]'); l.style.left = (parseFloat(l.style.left) + 20) + '%'; } },
];
const GUARDIA_CP = { nombre: 'quitar todas las líneas de rejilla', inject: () => { document.querySelectorAll('[data-t=linea]').forEach((l) => l.remove()); } };

async function cargar(page) {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForSelector('[data-t=barra]', { timeout: 15000 });
    await page.waitForTimeout(300);
}
async function medir(page) { const buf = await page.screenshot(); return page.evaluate(medirEnPagina, buf.toString('base64')); }

function decidir(r) {
    if (!r.guardia || !r.guardia.ok) return [NO_PROBADA, `🟠 NO PROBADA — el instrumento SE SUSPENDE (precondición fallida; ni verde ni hallazgo):\n  ${r.guardia.fallos.join('\n  ')}`];
    if (r.violaciones.length) return [CAZADO, `🔴 CAZADO — ${r.violaciones.length} afirmación(es) violada(s):\n` + r.violaciones.map((v) => `  · ${v.af}  ${v.detalle}`).join('\n')];
    return [VERDE, `🟢 VERDE — 5/5 afirmaciones OK.  ${JSON.stringify(r.datos)}`];
}

async function correrSelftest(page) {
    const lineas = []; let fiable = true;
    for (const cp of CONTRAPRUEBAS) {
        await cargar(page); await page.evaluate(cp.inject); const r = await medir(page);
        const detector = r.guardia && r.guardia.ok && (r.violaciones || []).find((v) => v.af === cp.af);
        if (detector) lineas.push(`  ✅ ${cp.af} «${cp.nombre}»\n        → ROJO: ${detector.detalle}`);
        else { fiable = false; lineas.push(`  ❌ ${cp.af} «${cp.nombre}» → NO SALTÓ  (guardia.ok=${r.guardia && r.guardia.ok}; viol=${JSON.stringify(r.violaciones)})`); }
    }
    await cargar(page); await page.evaluate(GUARDIA_CP.inject); const rg = await medir(page);
    if (rg.guardia && rg.guardia.ok === false) lineas.push(`  ✅ GUARDIA «${GUARDIA_CP.nombre}»\n        → SE SUSPENDE: ${rg.guardia.fallos.join('; ')}`);
    else { fiable = false; lineas.push(`  ❌ GUARDIA «${GUARDIA_CP.nombre}» → NO se suspendió (dio ${rg.guardia && rg.guardia.ok ? 'verde/medición' : '?'})`); }

    const cab = fiable
        ? '🟢 SELFTEST OK — el instrumento SABE ponerse rojo: las 5 contrapruebas saltan y la guardia suspende.'
        : '🔴 SELFTEST FALLÓ — el instrumento NO ES FIABLE: algún detector no salta (no confíes en su verde).';
    return { code: fiable ? VERDE : NO_PROBADA, salida: cab + '\n' + lineas.join('\n') };
}

// Combinar veredictos: un CAZADO (violación real) manda sobre un NO PROBADA (no se pudo medir); solo
// VERDE si TODO es verde. Reventar no tapa un hallazgo, ni un hallazgo se pierde tras un reviente.
function combinar(codes) { if (codes.includes(CAZADO)) return CAZADO; if (codes.includes(NO_PROBADA)) return NO_PROBADA; return VERDE; }

let code = VERDE, salida = '';
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    if (SELFTEST) {
        const r1 = await correrSelftest(page);
        const r2 = await correrSelftestMovimiento(page);
        const r3 = await correrSelftestRetimado(page);
        const r4 = await correrSelftestEditor(page);
        code = combinar([r1.code, r2.code, r3.code, r4.code]);
        salida = r1.salida
            + '\n\n── contrapruebas del ARRASTRE · mover (tanda 1) ──\n' + r2.salida
            + '\n\n── contrapruebas del ARRASTRE · retimar (tanda 2) ──\n' + r3.salida
            + '\n\n── contrapruebas del EDITOR (tanda 2.b) ──\n' + r4.salida;
    } else {
        await cargar(page); const rest = await medir(page); const [c1, s1] = decidir(rest);
        const rmov = await escenarioMovimiento(page); const [c2, s2] = decidirMovimiento(rmov);
        const rret = await escenarioRetimado(page); const [c3, s3] = decidirRetimado(rret);
        const rtope = await escenarioTope(page); const rcol = await escenarioColorEditor(page); const rtec = await escenarioTeclado(page); const [c4, s4] = decidirEditor(rtope, rcol, rtec);
        code = combinar([c1, c2, c3, c4]);
        salida = s1 + '\n\n── ARRASTRE · mover (tanda 1) ──\n' + s2 + '\n\n── ARRASTRE · retimar (tanda 2) ──\n' + s3 + '\n\n── EDITOR (tanda 2.b) ──\n' + s4;
    }
} catch (e) {
    code = NO_PROBADA;
    salida = `🟠 NO PROBADA — el instrumento REVENTÓ (no es un hallazgo, no es un pase): ${String(e.message || e).split('\n')[0]}`;
} finally {
    await browser.close();
}
console.log(salida);
process.exit(code);
