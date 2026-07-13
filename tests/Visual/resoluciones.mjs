/**
 * EL BARRIDO DE RESOLUCIONES. DIECISÉIS ESTADOS, Y NINGUNO SE DEDUCE DE OTRO.
 *
 * ⚠️ NO SE GENERALIZA. Si 1366 y 1920 están bien, eso NO dice nada de 1440.
 *
 * Y no es una manía: la geometría CAMBIA con el ancho, y la matriz visual depende de la
 * geometría. El anillo de gravedad pesa (área del anillo) / (área de la caja), así que en una
 * barra estrecha el anillo domina — y una barra se estrecha cuando la columna se estrecha. Lo que
 * a 16 px de alto y 50 de ancho es un anillo, en una columna de 160 px puede volver a ser una
 * mezcla. Ya nos pasó: a 10 px el ciruela de Marco con un aviso ámbar se veía marrón.
 *
 * Así que cada resolución es un caso NUEVO, y se abre, se mide y se mira.
 *
 * QUÉ SE MIDE, Y TODO SOBRE LA PÁGINA REAL:
 *
 *   · ¿CABE la semana entera? Y si no cabe, CUÁNTO falta (en píxeles, no "un poco").
 *   · ¿Desborda la PÁGINA? (que es distinto de que scrollee la parrilla, que es su trabajo)
 *   · ¿Se TRUNCA algo? Se busca elemento a elemento: scrollWidth > clientWidth.
 *   · ¿Los CARTELES se salen de su celda?
 *   · ¿La LEYENDA cabe en una línea?
 *   · ¿El PANEL scrollea por dentro sin desbordar?
 *   · ⚠️ ¿SE CUMPLE LA MATRIZ VISUAL? ΔE00 entre personas, y ΔE de cada barra contra las
 *     gravedades que NO son la suya. Medido SOBRE LA IMAGEN, en cada resolución.
 *
 *   node tests/Visual/resoluciones.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import {
    FAMILIA_DE_ANILLO, INDISTINGUIBLE, SUENA,
    conRelleno, deltaE00, entrar, hex, localizar, lunesDe, muestrear, rgbDe, sueneA,
} from './pixel.mjs';

const BASE = 'http://turnia.test';

/**
 * ⚠️ ESTE NÚMERO NO SE COPIA: SE LEE DEL CÓDIGO DE PRODUCCIÓN.
 *
 * Si el test se guardara su propia constante, el día que la parrilla cambie de mínimo el test
 * seguiría midiendo contra el viejo y daría verde sobre una promesa que ya no se cumple. La ley 13
 * también vale para los instrumentos.
 */
const MIN_SEMANA = Number(
    (await import('fs')).readFileSync(new URL('../../resources/js/composables/useAncho.js', import.meta.url), 'utf8')
        .match(/export const MIN_SEMANA = (\d+)/)[1],
);

const RESOLUCIONES = [
    { w: 1280, h: 720, nombre: 'portátil pequeño' },
    { w: 1366, h: 768, nombre: 'el que ya conocemos' },
    { w: 1440, h: 900, nombre: 'portátil normal' },
    { w: 1536, h: 864, nombre: 'portátil normal (HiDPI)' },
    { w: 1920, h: 1080, nombre: 'Full HD — EL MÁS COMÚN' },
    { w: 2560, h: 1440, nombre: 'monitor grande' },
    { w: 1366, h: 600, nombre: 'ventana baja' },
    { w: 960, h: 1080, nombre: 'media pantalla' },
];

const lunes = lunesDe(0);

/**
 * LO QUE SE LE PREGUNTA A LA PÁGINA. Geometría REAL, no CSS declarado.
 *
 * ⚠️ EL TRUNCADO SE BUSCA ELEMENTO A ELEMENTO. "Se lee bien" no es una medida: `scrollWidth >
 * clientWidth` sí lo es, y es exactamente lo que pasa cuando un `truncate` se come media palabra.
 */
const medir = () => {
    const caja = (el) => el.getBoundingClientRect();

    const scroller = document.querySelector('[data-t=celda]')?.closest('.overflow-auto');
    const rejilla = scroller?.firstElementChild;

    const celdas = [...document.querySelectorAll('[data-t=celda]')];
    const cabecera = document.querySelector('.head-sticky');

    /* ── ¿SE TRUNCA ALGO? ────────────────────────────────────────────────────── */
    const truncados = [];

    for (const sel of ['[data-t=nombre]', '[data-t=rotulo]', '[data-t=nota]', '[data-t=cartel]', '[data-t=banda]', '[data-t=tramo-rotulo]']) {
        for (const el of document.querySelectorAll(sel)) {
            const r = caja(el);

            if (r.width === 0) continue;

            // +1 de holgura: el subpíxel del navegador no es un truncado.
            if (el.scrollWidth > el.clientWidth + 1) {
                truncados.push({
                    que: sel,
                    texto: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 40),
                    sobra: Math.round(el.scrollWidth - el.clientWidth),
                });
            }
        }
    }

    /*
     * ⚠️ ¿SE SALE ALGO DE LA VENTANA? Y ESTO NO LO CAZABA NADA.
     *
     * `scrollWidth > clientWidth` detecta un TRUNCADO (un `truncate` que se come media palabra).
     * Pero el indicador de la cabecera —"5 turnos con incidencias · 4 tramos sin cubrir · 1 aviso
     * de catálogo"— llevaba `whitespace-nowrap`: no truncaba, SE SALÍA. Y la cabecera tiene
     * overflow-hidden, así que lo cortaba en seco: a 960 px se leía "…1 aviso de".
     *
     * El dato más importante de la pantalla, cortado, y sin que ningún test dijera nada.
     *
     * La cabecera y los banners NO scrollean: lo que se sale de ellos, se pierde. (La parrilla y
     * el panel sí scrollean, y ahí salirse es su forma normal de funcionar.)
     */
    const fueraDePantalla = [];

    for (const el of document.querySelectorAll('[data-t=indicador], [data-t=eje], [data-t=leyenda-toggle], [data-t=demasiado-estrecho], nav button, nav a')) {
        // Solo lo que vive FUERA de un contenedor con scroll propio.
        if (el.closest('.overflow-auto, .overflow-y-auto, [data-t=panel]')) continue;

        const r = caja(el);

        if (r.width === 0) continue;

        if (r.right > window.innerWidth + 1 || r.left < -1) {
            fueraDePantalla.push({
                texto: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 42),
                sobra: Math.round(r.right - window.innerWidth),
            });
        }
    }

    /* ── ¿ALGÚN CARTEL SE SALE DE SU CELDA? ──────────────────────────────────── */
    const cartelesFuera = [];

    for (const c of document.querySelectorAll('[data-t=cartel]')) {
        const celda = c.closest('[data-t=celda]');
        if (!celda) continue;

        const rc = caja(c);
        const rce = caja(celda);

        // La celda tiene 11 px de padding a cada lado. Un cartel que lo pise se está saliendo.
        if (rc.right > rce.right - 10 || rc.left < rce.left + 10) {
            cartelesFuera.push({
                texto: c.innerText.replace(/\s+/g, ' ').trim().slice(0, 30),
                sobra: Math.round(rc.right - (rce.right - 11)),
            });
        }
    }

    /* ── LAS BARRAS: alto, ancho, y la más estrecha (que es la que peor lo pasa) ── */
    const barras = [...document.querySelectorAll('[data-t=barra]')].map(caja).filter((r) => r.width > 0);

    /* ── LA TIRA: ¿qué escalón se está pintando? ─────────────────────────────── */
    const rotulosTira = [...document.querySelectorAll('[data-t=tramo-rotulo]')]
        .map((r) => r.innerText.trim())
        .filter(Boolean);

    const tramosConDeficit = [...document.querySelectorAll('[data-t=tramo]')]
        .filter((t) => t.dataset.estado === 'missing').length;

    /* ── EL PANEL ────────────────────────────────────────────────────────────── */
    const panel = document.querySelector('[data-t=panel]');
    const panelR = panel ? caja(panel) : null;

    /* ── LA LEYENDA ──────────────────────────────────────────────────────────── */
    const toggle = document.querySelector('[data-t=leyenda-toggle]');
    const leyenda = toggle?.closest('div')?.parentElement;

    return {
        // ¿Cabe la semana? El scroller es el que tiene overflow-auto.
        anchoVisible: scroller ? Math.round(scroller.clientWidth) : 0,
        anchoNecesario: scroller ? Math.round(scroller.scrollWidth) : 0,
        falta: scroller ? Math.max(0, Math.round(scroller.scrollWidth - scroller.clientWidth)) : 0,
        altoVisible: scroller ? Math.round(scroller.clientHeight) : 0,
        altoNecesario: scroller ? Math.round(scroller.scrollHeight) : 0,

        // ⚠️ QUE LA PARRILLA SCROLLEE ES SU TRABAJO. QUE DESBORDE LA PÁGINA ES UN FALLO.
        paginaDesbordaAncho: document.documentElement.scrollWidth > window.innerWidth + 1,
        paginaDesbordaAlto: document.body.scrollHeight > window.innerHeight + 1,

        columna: cabecera ? Math.round(caja(cabecera).width) : 0,
        celdas: celdas.length,

        barras: barras.length,
        barraAlto: barras.length ? Math.round(barras[0].height) : 0,
        barraMinAncho: barras.length ? Math.round(Math.min(...barras.map((b) => b.width))) : 0,
        barraMedAncho: barras.length ? Math.round(barras.reduce((a, b) => a + b.width, 0) / barras.length) : 0,

        truncados,
        cartelesFuera,
        fueraDePantalla,

        rotulosTira,
        tramosConDeficit,

        panelAncho: panelR ? Math.round(panelR.width) : 0,
        panelScrollea: panel ? panel.scrollHeight > panel.clientHeight + 1 : false,
        panelDesbordaAbajo: panelR ? panelR.bottom > window.innerHeight + 1 : false,

        leyendaAlto: leyenda ? Math.round(caja(leyenda).height) : 0,

        // El aviso de "esta vista necesita más ancho", si existe.
        avisoEstrecho: !!document.querySelector('[data-t=demasiado-estrecho]'),
    };
};

/* ══════════════════════════════════════════════════════════════════════════════ */

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

await entrar(page, BASE);

mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });

const filas = [];
const fallos = [];

for (const res of RESOLUCIONES) {
    for (const panel of ['plegado', 'desplegado']) {
        await page.setViewportSize({ width: res.w, height: res.h });

        // El panel recuerda su estado en localStorage. Se fija ANTES de cargar: cambiarlo después
        // dispararía un relayout y estaríamos midiendo una animación.
        await page.evaluate((v) => localStorage.setItem('turnia.panel-plantilla', v), panel === 'plegado' ? 'recogido' : 'abierto');

        await page.goto(`${BASE}/companies/1/calendars/1/schedule?week=${lunes}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('[data-t=indicador]', { timeout: 60000 });
        await page.waitForTimeout(900);

        const m = await page.evaluate(medir);

        const clave = `${res.w}x${res.h}-${panel}`;
        const png = await page.screenshot();

        writeFileSync(new URL(`./salida/res-${clave}.png`, import.meta.url), png);

        /* ── LA MATRIZ VISUAL, MEDIDA EN ESTA RESOLUCIÓN ─────────────────────── */

        const piezas = await page.evaluate(localizar);
        const medibles = piezas.filter((p) => !p.sinRelleno && !p.tapada && p.persona !== '?');
        const muestras = await muestrear(page, png, medibles);

        const barras = muestras.filter((p) => p.tipo === 'barra');

        // ⚠️ Piezas TAPADAS o RECORTADAS. No se miden —lo que hay en su píxel es de otro— pero NO
        // SE CALLAN: si en una resolución la mitad de la parrilla está detrás del panel, eso es un
        // dato del responsive, no un detalle del instrumento.
        const tapadas = piezas.filter((p) => p.tapada).length;

        /*
         * ⚠️ EL GUARDIA. Y AQUÍ NO ESTABA, QUE ES POR LO QUE ESTE BARRIDO ME MINTIÓ EN SU PRIMERA
         * PASADA.
         *
         * Si un elemento es OPACO, el píxel de la imagen tiene que parecerse al color que declara.
         * Si no se parece, no es que la página esté mal: es que ESTOY MIDIENDO OTRA COSA. Sin este
         * guardia, las barras tapadas por el panel salían BLANCAS, dos personas daban ΔE 0,0 y el
         * instrumento cantaba "LA MATRIZ SE ROMPE" sobre una página impecable.
         */
        for (const m of muestras) {
            const n = rgbDe(m.declarado);
            const alfa = (m.declarado.match(/[\d.]+/g) ?? []).map(Number);

            if (alfa.length > 3 && alfa[3] < 0.99) continue;
            if (m.tramada) continue;

            const d = deltaE00(m.pixel, n);

            if (d > 8) {
                fallos.push(
                    `${res.w}×${res.h} · panel ${panel} · INSTRUMENTO: el ${m.tipo} de «${m.persona}» declara `
                    + `${m.declarado} y el píxel dice ${hex(m.pixel)} (ΔE ${d.toFixed(1)}). No estoy midiendo lo que creo.`,
                );
            }
        }

        // La identidad: la mediana de las barras LISAS de cada persona.
        const porPersona = new Map();

        for (const p of barras.filter((x) => !x.tramada && conRelleno(x))) {
            if (!porPersona.has(p.persona)) porPersona.set(p.persona, []);
            porPersona.get(p.persona).push(p.pixel);
        }

        const gente = [...porPersona.entries()].map(([persona, px]) => ({
            persona,
            pixel: [0, 1, 2].map((i) => {
                const v = px.map((p) => p[i]).sort((a, b) => a - b);

                return v[Math.floor(v.length / 2)];
            }),
        }));

        let deMin = Infinity;
        let elPar = null;

        for (let i = 0; i < gente.length; i++) {
            for (let j = i + 1; j < gente.length; j++) {
                const d = deltaE00(gente[i].pixel, gente[j].pixel);

                if (d < deMin) { deMin = d; elPar = `${gente[i].persona} / ${gente[j].persona}`; }
            }
        }

        // ⚠️ Y LA LEY 0: ninguna barra puede quedar a menos de ΔE 20 de una gravedad AJENA.
        let ajenaMin = Infinity;
        let laBarra = null;

        for (const p of barras.filter((x) => x.integrada && x.anillo > 0 && conRelleno(x))) {
            const mia = FAMILIA_DE_ANILLO[p.anilloDeclarado] ?? '?';
            const otra = sueneA(p.integrada, mia);

            if (otra.d < ajenaMin) {
                ajenaMin = otra.d;
                laBarra = `${p.persona} (${mia}) → ${otra.nombre}`;
            }
        }

        const fila = {
            ...res, panel, clave, ...m,
            tapadas,
            personas: gente.length,
            deMin: deMin === Infinity ? null : deMin,
            elPar,
            ajenaMin: ajenaMin === Infinity ? null : ajenaMin,
            laBarra,
        };

        filas.push(fila);

        /* ── LOS FALLOS ──────────────────────────────────────────────────────── */

        const donde = `${res.w}×${res.h} · panel ${panel}`;

        if (m.paginaDesbordaAncho) {
            fallos.push(`${donde}: LA PÁGINA DESBORDA A LO ANCHO. La parrilla puede scrollear; la página, no.`);
        }

        if (m.paginaDesbordaAlto) {
            fallos.push(`${donde}: LA PÁGINA DESBORDA A LO ALTO.`);
        }

        if (m.truncados.length) {
            fallos.push(`${donde}: ${m.truncados.length} elementos TRUNCADOS (ley 10) — p.ej. «${m.truncados[0].texto}» (le sobran ${m.truncados[0].sobra}px)`);
        }

        if (m.fueraDePantalla.length) {
            fallos.push(
                `${donde}: ${m.fueraDePantalla.length} elementos SE SALEN DE LA VENTANA y la cabecera los corta `
                + `— «${m.fueraDePantalla[0].texto}» (le sobran ${m.fueraDePantalla[0].sobra}px). Ley 10.`,
            );
        }

        if (m.cartelesFuera.length) {
            fallos.push(`${donde}: ${m.cartelesFuera.length} carteles SE SALEN de su celda — «${m.cartelesFuera[0].texto}»`);
        }

        if (m.panelDesbordaAbajo) {
            fallos.push(`${donde}: el PANEL se sale por abajo de la ventana.`);
        }

        /*
         * ⚠️ EL AVISO DE "NO CABE" TIENE QUE SALIR CUANDO DEBE Y SOLO CUANDO DEBE.
         *
         * Un aviso que no sale es un silencio falso: alguien ve tres días y medio y cree que la
         * semana son tres días y medio. Y un aviso que sale de más es un aviso falso: aprende a
         * ignorarlo, y el día que diga la verdad tampoco lo leerá. Los dos son el mismo veneno.
         *
         * ⚠️ Y NO SE AVISA CUANDO EL PANEL ABIERTO ES LO QUE NO DEJA SITIO: eso lo ha decidido el
         * usuario, y tiene el botón ahí mismo para deshacerlo. Se avisa cuando NI SIQUIERA CON EL
         * PANEL RECOGIDO cabría, que es cuando la ventana es el problema.
         */
        const deberiaAvisar = res.w < MIN_SEMANA;

        if (deberiaAvisar && !m.avisoEstrecho) {
            fallos.push(`${donde}: la semana NO CABE (mínimo ${MIN_SEMANA}px) y NO SE AVISA. Silencio falso.`);
        }

        if (!deberiaAvisar && m.avisoEstrecho) {
            fallos.push(`${donde}: avisa de que no cabe, y cabe. Aviso falso.`);
        }

        // Y con el panel RECOGIDO, por encima del mínimo, la semana tiene que caber ENTERA. Es la
        // promesa de esta tanda, y si se rompe no hay matiz que valga.
        if (panel === 'plegado' && res.w >= MIN_SEMANA && m.falta > 0) {
            fallos.push(`${donde}: la semana NO CABE con el panel recogido y ${res.w} ≥ ${MIN_SEMANA}. Faltan ${m.falta}px.`);
        }

        // ⚠️ NADA SE DA POR BUENO POR AUSENCIA.
        if (!m.barras) {
            fallos.push(`${donde}: NO HAY NI UNA BARRA a la vista. No se ha podido comprobar la matriz visual aquí.`);
        } else if (gente.length < 2) {
            fallos.push(`${donde}: solo ${gente.length} persona(s) medible(s). La ley 2 no se ha probado en esta resolución.`);
        }

        if (deMin !== Infinity && deMin < INDISTINGUIBLE) {
            fallos.push(`${donde}: LA MATRIZ SE ROMPE — «${elPar}» son INDISTINGUIBLES (ΔE00 ${deMin.toFixed(1)}, umbral ${INDISTINGUIBLE}).`);
        }

        if (ajenaMin !== Infinity && ajenaMin < SUENA) {
            fallos.push(`${donde}: LA MATRIZ SE ROMPE — la barra de ${laBarra} queda a ΔE00 ${ajenaMin.toFixed(1)} de una gravedad AJENA (umbral ${SUENA}).`);
        } else if (ajenaMin === Infinity) {
            fallos.push(`${donde}: no ha salido NI UNA barra con anillo. La ley 0 no se ha probado aquí.`);
        }
    }
}

/* ══════════════════════════════════════════════════════════════════════════════
 * LA BISECCIÓN. "No me digas 'por debajo de 1200 se ve mal'. Dime el número."
 *
 * Ocho resoluciones son ocho fotos. Entre ellas hay 1.600 anchos que nadie ha mirado, y una
 * transición no avisa: pasa. Así que cada umbral se BUSCA, por bisección, al píxel.
 *
 * Se cambia el viewport SIN recargar: el diseño es CSS, así que reacciona solo. (El aviso de
 * "no cabe" escucha `resize`, y por eso también se actualiza.)
 * ══════════════════════════════════════════════════════════════════════════════ */

const umbrales = [];

const bisecar = async (nombre, panel, alto, malo, bueno, condicion) => {
    await page.evaluate((v) => localStorage.setItem('turnia.panel-plantilla', v), panel === 'plegado' ? 'recogido' : 'abierto');
    await page.setViewportSize({ width: bueno, height: alto });
    await page.goto(`${BASE}/companies/1/calendars/1/schedule?week=${lunes}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-t=indicador]', { timeout: 60000 });
    await page.waitForTimeout(800);

    // ⚠️ SE COMPRUEBAN LOS DOS EXTREMOS. Si el "malo" no está mal o el "bueno" no está bien, la
    // bisección no está buscando nada — y devolvería un número inventado con cara de medida.
    await page.setViewportSize({ width: malo, height: alto });
    await page.waitForTimeout(250);

    if (!condicion(await page.evaluate(medir))) {
        fallos.push(`BISECCIÓN «${nombre}»: el extremo malo (${malo}px) NO está mal. El instrumento no está buscando nada.`);

        return null;
    }

    await page.setViewportSize({ width: bueno, height: alto });
    await page.waitForTimeout(250);

    if (condicion(await page.evaluate(medir))) {
        fallos.push(`BISECCIÓN «${nombre}»: el extremo bueno (${bueno}px) TAMPOCO está bien. El instrumento no está buscando nada.`);

        return null;
    }

    let lo = malo;
    let hi = bueno;

    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);

        await page.setViewportSize({ width: mid, height: alto });
        await page.waitForTimeout(160);

        if (condicion(await page.evaluate(medir))) {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    umbrales.push({ nombre, panel, ultimoMalo: lo, primeroBueno: hi });

    return hi;
};

await bisecar('la semana NO cabe entera', 'plegado', 900, 900, 1600, (m) => m.falta > 0);
await bisecar('la semana NO cabe entera', 'desplegado', 900, 900, 1800, (m) => m.falta > 0);
await bisecar('algo se SALE de la ventana (ley 10)', 'plegado', 900, 600, 1600, (m) => m.fueraDePantalla.length > 0);
await bisecar('el aviso de "no cabe" aparece', 'plegado', 900, 900, 1600, (m) => m.avisoEstrecho);

await browser.close();

/* ══════════════════════════════════════════════════════════════════════════════ */

let salida = '';
const di = (s = '') => { salida += s + String.fromCharCode(10); console.log(s); };
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const num = (v, n, d = 1) => String(v === null ? '—' : v.toFixed(d)).padStart(n);

di();
di('EL BARRIDO DE RESOLUCIONES — 8 resoluciones × panel plegado/desplegado, sobre la página real');
di('═'.repeat(140));
di();
di(`${pad('RESOLUCIÓN', 12)} ${pad('PANEL', 12)} ${pad('¿CABE?', 14)} ${pad('COL', 5)} ${pad('BARRA', 12)} ${pad('ΔE PERSONAS', 12)} ${pad('ΔE A OTRA GRAV.', 16)} ${pad('TRUNC', 6)} ${pad('CARTEL', 7)} ${pad('TAPADAS', 8)} PÁGINA`);
di('─'.repeat(140));

for (const f of filas) {
    const cabe = f.falta === 0 ? '✅ entera' : `❌ faltan ${f.falta}px`;
    const de = f.deMin === null ? '—' : `${f.deMin < INDISTINGUIBLE ? '❌' : '✅'} ${num(f.deMin, 4)}`;
    const aj = f.ajenaMin === null ? '❌ sin medir' : `${f.ajenaMin < SUENA ? '❌' : '✅'} ${num(f.ajenaMin, 4)}`;

    di(
        `${pad(`${f.w}×${f.h}`, 12)} ${pad(f.panel, 12)} ${pad(cabe, 14)} ${pad(f.columna, 5)} `
        + `${pad(`${f.barraMedAncho}×${f.barraAlto}`, 12)} ${pad(de, 12)} ${pad(aj, 16)} `
        + `${pad((f.truncados.length + f.fueraDePantalla.length) || '·', 6)} ${pad(f.cartelesFuera.length || '·', 7)} ${pad(f.tapadas || '·', 8)} `
        + `${f.paginaDesbordaAncho || f.paginaDesbordaAlto ? '❌ desborda' : '✅'}`,
    );
}

di('─'.repeat(140));
di();
di('COL = ancho de una columna de día · BARRA = ancho medio × alto de una barra');
di('ΔE PERSONAS = lo más parecidas que salen dos personas (umbral 12) · ΔE A OTRA GRAV. = lo más');
di('cerca que queda una barra de una gravedad que NO es la suya (umbral 20). Los dos, sobre la imagen.');
di();
di('▓ LOS UMBRALES, AL PÍXEL — buscados por bisección, no interpolados entre dos fotos');
di('─'.repeat(140));

for (const u of umbrales) {
    di(
        `${pad(u.nombre, 40)} ${pad(`panel ${u.panel}`, 18)} `
        + `hasta ${String(u.ultimoMalo).padStart(4)} px  ·  a partir de ${String(u.primeroBueno).padStart(4)} px ya no`,
    );
}

di();

if (fallos.length) {
    di(`❌ ${fallos.length} FALLOS:`);
    di();
    fallos.forEach((f) => di(`   · ${f}`));
} else {
    di('✅ Las 16 combinaciones caben o scrollean donde deben, no truncan nada, no desbordan la');
    di('   página, y la matriz visual se cumple en TODAS: ninguna persona se confunde con otra y');
    di('   ninguna barra suena a una gravedad que no es la suya.');
}

di();

writeFileSync(new URL('./salida/resoluciones.txt', import.meta.url), salida);
writeFileSync(new URL('./salida/resoluciones.json', import.meta.url), JSON.stringify(filas, null, 2));

process.exit(fallos.length ? 1 : 0);
