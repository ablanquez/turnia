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

let code = VERDE, salida = '';
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    if (SELFTEST) { const r = await correrSelftest(page); code = r.code; salida = r.salida; }
    else { await cargar(page); const r = await medir(page); [code, salida] = decidir(r); }
} catch (e) {
    code = NO_PROBADA;
    salida = `🟠 NO PROBADA — el instrumento REVENTÓ (no es un hallazgo, no es un pase): ${String(e.message || e).split('\n')[0]}`;
} finally {
    await browser.close();
}
console.log(salida);
process.exit(code);
