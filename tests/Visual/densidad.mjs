/**
 * RETINA Y EL ZOOM DEL NAVEGADOR. El agujero que quedaba abierto, medido.
 *
 * ⚠️ POR QUÉ ESTO NO ES UN "POR SI ACASO".
 *
 * Toda la matriz visual se sostiene sobre mezclas de MUY POCOS PÍXELES: una raya de 2 px, una
 * franja de anillo de 2/3/4 px, una barra de 16 px de alto. Y a `deviceScaleFactor: 1` el navegador
 * pinta esos bordes con ANTIALIASING — inventa píxeles intermedios entre la raya y el fondo.
 *
 * EL ANTIALIASING ES EXACTAMENTE LO QUE SEPARA EL MODELO DE LA IMAGEN. El modelo dice "la raya pesa
 * el 25 %"; la imagen dice lo que el antialiasing decida. Y en una pantalla Retina (DPR 2) hay
 * CUATRO VECES MÁS PÍXELES por píxel CSS, así que el antialiasing se reparte de otra forma: los
 * bordes son más limpios, las rayas más definidas, y las mezclas —que son lo que el ojo integra—
 * NO TIENEN POR QUÉ DAR LO MISMO.
 *
 * Y no es un caso raro: los MacBook son el ordenador de media industria del software. Un reclutador
 * abre Turnia en Retina con más probabilidad que en un monitor de 1080p.
 *
 * ⚠️ EL ZOOM DEL NAVEGADOR ES EL MISMO PROBLEMA CON OTRO NOMBRE. Ctrl+± cambia la relación entre el
 * píxel CSS y el píxel de dispositivo, exactamente igual que el DPR. Se prueba con la misma regla.
 *
 * LO QUE SE MIDE, en cada densidad: lo mismo que a DPR 1, sin rebajar un solo umbral.
 *
 *   · LEY 2 — cada barra se parece más a SU persona que a ninguna otra
 *   · LEY 0 — ninguna barra queda a menos de ΔE 20 de una gravedad AJENA
 *   · LA TRAMA — la raya se ve, y no cambia el tono de su relleno
 *
 * Si a DPR 2 algún número baja del umbral, LA MATRIZ NO SE CUMPLE EN RETINA y hay que arreglarlo.
 *
 *   node tests/Visual/densidad.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import {
    FAMILIA_DE_ANILLO, INDISTINGUIBLE, RAYA_SE_VE, SUENA, TONO_DE_LA_RAYA,
    conRelleno, deltaE00, distanciaDeTono, entrar, hex, localizar, lunesDe, muestrear, rgbDe, sueneA,
} from './pixel.mjs';

const BASE = 'http://turnia.test';
const M = JSON.parse(readFileSync(new URL('./matriz.json', import.meta.url), 'utf8'));

/**
 * ⚠️ EL ZOOM NO SE SIMULA CAMBIANDO EL VIEWPORT. Eso sería otra resolución, no un zoom.
 *
 * Un zoom del 125 % deja la MISMA ventana física y hace los píxeles CSS más grandes: el layout se
 * recalcula con menos píxeles CSS disponibles Y ADEMÁS cada uno ocupa 1,25 px de dispositivo. Se
 * reproduce con viewport = ancho_físico / zoom y deviceScaleFactor = dpr × zoom, que es justo lo
 * que hace Chromium por dentro.
 */
const ESTADOS = [
    { nombre: 'DPR 1 · zoom 100 % (la referencia)', ancho: 1366, dpr: 1 },
    { nombre: 'DPR 2 · RETINA (MacBook)', ancho: 1366, dpr: 2 },
    { nombre: 'DPR 3 · Retina de móvil/4K', ancho: 1366, dpr: 3 },
    { nombre: 'DPR 1 · zoom 125 % (Ctrl +)', ancho: Math.round(1366 / 1.25), dpr: 1.25 },
    { nombre: 'DPR 1 · zoom 150 % (Ctrl +)', ancho: Math.round(1366 / 1.5), dpr: 1.5 },
    { nombre: 'DPR 1 · zoom 80 %  (Ctrl −)', ancho: Math.round(1366 / 0.8), dpr: 0.8 },
    { nombre: 'DPR 2 · RETINA + zoom 125 %', ancho: Math.round(1366 / 1.25), dpr: 2.5 },
];

/**
 * ⚠️ SE MIDE SOBRE LAS DOS PÁGINAS, Y NO SOBRE UNA.
 *
 * La demo no tiene los doce colores ni las tres gravedades sobre cada uno. El cuadrante de la
 * matriz sí, y la rampa tiene el peor caso geométrico (turnos de una hora). Probar el antialiasing
 * solo donde es cómodo sería probarlo donde no duele.
 */
const PAGINAS = [
    { clave: 'demo', url: `/companies/1/calendars/1/schedule?week=${lunesDe(0)}` },
    { clave: 'matriz', url: M.bloques.url },
    { clave: 'anchos', url: M.anchos.url },
];

/**
 * ⚠️ A DPR 3 NO SE PUEDE ESTIRAR EL VIEWPORT: LA IMAGEN NO CABE, Y SI LA ENCOJO PIERDO BARRAS.
 *
 * A DPR 1, el cuadrante de 96 casos se medía poniendo el viewport a 9.000 px de alto y capturando
 * de una vez. A DPR 3 eso son 27.000 px de imagen, y Chromium NO PUEDE decodificar un canvas de más
 * de 16.384 px: la captura revienta.
 *
 * La salida fácil sería bajar el alto y medir lo que quepa. Y sería un APROBADO POR OMISIÓN — el
 * instrumento diría "verde" habiendo mirado un tercio de los casos, sin decirlo.
 *
 * Así que se RECORRE la página: viewport pequeño, y se baja a saltos capturando cada tramo. Las
 * coordenadas de `localizar` son relativas al viewport, así que cada tramo se mide contra SU propia
 * captura y no hay que ajustar nada. Se mide TODO, en todas las densidades.
 */
const recorrer = async (page, ancho, alto) => {
    const barras = [];

    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const paso = alto - 120;   // solape: una barra a caballo entre dos tramos se ve entera en uno

    for (let y = 0; y < total; y += paso) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(220);

        const png = await page.screenshot();
        const piezas = await page.evaluate(localizar);
        const medibles = piezas.filter((p) => p.tipo === 'barra' && !p.sinRelleno && !p.tapada && p.persona !== '?');

        if (medibles.length) {
            barras.push(...await muestrear(page, png, medibles));
        }
    }

    return barras;
};

let salida = '';
const di = (s = '') => { salida += s + String.fromCharCode(10); console.log(s); };
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

const fallos = [];
const filas = [];

mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });

for (const estado of ESTADOS) {
    // El alto del viewport, para que la IMAGEN quepa en un canvas de Chromium (máx. 16.384 px) en
    // cualquier densidad. No recorta cobertura: lo que no cabe de una vez, se recorre a saltos.
    const alto = Math.min(2200, Math.floor(15500 / estado.dpr));

    const browser = await chromium.launch();
    const page = await browser.newPage({
        viewport: { width: estado.ancho, height: alto },
        deviceScaleFactor: estado.dpr,
    });

    await entrar(page, BASE);
    await page.evaluate(() => localStorage.setItem('turnia.panel-plantilla', 'recogido'));

    const barras = [];

    for (const pagina of PAGINAS) {
        await page.goto(`${BASE}${pagina.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('[data-t=indicador]', { timeout: 90000 });
        await page.waitForTimeout(1200);

        if (pagina.clave === 'demo') {
            writeFileSync(new URL(`./salida/dpr-${estado.dpr}.png`, import.meta.url), await page.screenshot());
        }

        barras.push(...await recorrer(page, estado.ancho, alto));
    }

    await browser.close();

    /*
     * ⚠️ EL GUARDIA, ANTES DE CREERME NADA. Si el píxel medido no cuadra con el color declarado, no
     * estoy midiendo la página: estoy midiendo otra cosa. Y a DPR alto es MÁS fácil equivocarse,
     * porque la escala imagen↔CSS deja de ser 1.
     */
    for (const b of barras.filter((x) => !x.tramada && conRelleno(x))) {
        const d = deltaE00(b.pixel, rgbDe(b.declarado));

        if (d > 8) {
            fallos.push(
                `INSTRUMENTO (${estado.nombre}): la barra de «${b.persona}» declara ${b.declarado} y el píxel dice `
                + `${hex(b.pixel)} (ΔE ${d.toFixed(1)}). No estoy midiendo lo que creo.`,
            );
        }
    }

    /* ── LEY 2: cada barra, más parecida a la suya que a ninguna otra ── */

    const PALETA = [...new Map(
        barras.filter((b) => conRelleno(b)).map((b) => [hex(rgbDe(b.declarado)), rgbDe(b.declarado)]),
    ).entries()].map(([c, rgb]) => ({ c, rgb }));

    let peorLey2 = Infinity;
    let rotasLey2 = 0;

    for (const b of barras.filter((x) => conRelleno(x))) {
        const visto = b.tramada ? b.relleno : b.pixel;

        if (!visto) continue;

        const suyo = hex(rgbDe(b.declarado));
        const orden = PALETA.map(({ c, rgb }) => ({ c, d: deltaE00(visto, rgb) })).sort((a, b2) => a.d - b2.d);

        const propio = orden.find((o) => o.c === suyo);
        const otro = orden.find((o) => o.c !== suyo);

        if (!propio || !otro) continue;

        const margen = otro.d - propio.d;
        peorLey2 = Math.min(peorLey2, margen);

        if (margen <= 0) {
            rotasLey2++;
            fallos.push(
                `LEY 2 (${estado.nombre}): la barra ${b.tramada ? 'tramada' : 'lisa'} de «${b.persona}» (${suyo}) se ve `
                + `${hex(visto)} y se parece MÁS a ${otro.c} —otra persona— que a su propio color.`,
            );
        }
    }

    /* ── LEY 0: ninguna barra suena a una gravedad ajena ── */

    let peorLey0 = Infinity;

    for (const b of barras.filter((x) => x.integrada && x.anillo > 0 && conRelleno(x))) {
        const mia = FAMILIA_DE_ANILLO[b.anilloDeclarado] ?? '?';
        const otra = sueneA(b.integrada, mia);

        peorLey0 = Math.min(peorLey0, otra.d);

        if (otra.d < SUENA) {
            fallos.push(
                `LEY 0 (${estado.nombre}): la barra de «${b.persona}» (${mia}, ${Math.round(b.ancho)}px) se ve `
                + `${hex(b.integrada)}, a ΔE ${otra.d.toFixed(1)} de «${otra.nombre}» — una gravedad que NO ES LA SUYA.`,
            );
        }
    }

    /* ── LA TRAMA: se ve, y no cambia el tono ── */

    let peorRaya = Infinity;
    let peorTono = 0;

    for (const b of barras.filter((x) => x.trama && conRelleno(x))) {
        const visible = deltaE00(b.trama.raya, b.trama.fondo);
        const desvio = distanciaDeTono(b.trama.raya, b.trama.fondo);

        peorRaya = Math.min(peorRaya, visible);
        peorTono = Math.max(peorTono, desvio);

        if (visible < RAYA_SE_VE) {
            fallos.push(`LA TRAMA (${estado.nombre}): la raya de «${b.persona}» queda a ΔE ${visible.toFixed(1)} de su relleno: NO SE VE.`);
        }

        if (desvio > TONO_DE_LA_RAYA) {
            fallos.push(`LA TRAMA (${estado.nombre}): la raya de «${b.persona}» se desvía ${desvio.toFixed(0)}° del tono de su relleno.`);
        }
    }

    // ⚠️ Una densidad en la que no se midió NADA no es una densidad aprobada: es una no probada.
    if (!barras.length || peorLey2 === Infinity || peorLey0 === Infinity || peorRaya === Infinity) {
        fallos.push(
            `${estado.nombre}: no se ha podido medir alguna de las tres leyes `
            + `(${barras.length} barras · ley2 ${peorLey2 === Infinity ? 'sin datos' : 'ok'} · `
            + `ley0 ${peorLey0 === Infinity ? 'SIN DATOS' : 'ok'} · trama ${peorRaya === Infinity ? 'SIN DATOS' : 'ok'}). `
            + 'Un hueco callado es un aprobado por omisión.',
        );
    }

    filas.push({
        estado, barras: barras.length, rotasLey2,
        ley2: peorLey2, ley0: peorLey0, raya: peorRaya, tono: peorTono,
    });
}

/* ══════════════════════════════════════════════════════════════════════════════ */

di();
di('RETINA Y EL ZOOM DEL NAVEGADOR — la matriz visual, medida sobre la imagen a cada densidad');
di('═'.repeat(118));
di();
di('  El antialiasing es lo que separa el modelo de la imagen. A DPR 2 hay CUATRO VECES más píxeles');
di('  por píxel CSS, así que las mezclas —que es lo que el ojo integra— no tienen por qué dar igual.');
di();
di(`${pad('ESTADO', 32)} ${pad('BARRAS', 7)} ${pad('LEY 2 (margen)', 15)} ${pad('LEY 0 (ajena)', 14)} ${pad('RAYA (se ve)', 13)} TONO DE LA RAYA`);
di('─'.repeat(118));

for (const f of filas) {
    const ley2 = f.ley2 === Infinity ? '—' : f.ley2.toFixed(1);
    const ley0 = f.ley0 === Infinity ? '—' : f.ley0.toFixed(1);
    const raya = f.raya === Infinity ? '—' : f.raya.toFixed(1);

    di(
        `${pad(f.estado.nombre, 32)} ${pad(f.barras, 7)} `
        + `${pad(`${f.rotasLey2 ? '❌' : '✅'} ${ley2}`, 15)} `
        + `${pad(`${f.ley0 < SUENA ? '❌' : '✅'} ${ley0}`, 14)} `
        + `${pad(`${f.raya < RAYA_SE_VE ? '❌' : '✅'} ${raya}`, 13)} `
        + `${f.tono > TONO_DE_LA_RAYA ? '❌' : '✅'} ${f.tono.toFixed(0)}°`,
    );
}

di('─'.repeat(118));
di();
di(`  umbrales: ley 2 → margen > 0 · ley 0 → ΔE ≥ ${SUENA} · la raya se ve → ΔE ≥ ${RAYA_SE_VE} · el tono no se mueve → ≤ ${TONO_DE_LA_RAYA}°`);
di(`  (y el suelo de "indistinguible" entre personas sigue siendo ΔE ${INDISTINGUIBLE}, aquí y en todas partes)`);
di();

/*
 * ⚠️ LA COMPARACIÓN QUE DE VERDAD IMPORTA: ¿CAMBIA ALGO AL SUBIR LA DENSIDAD?
 *
 * Que a DPR 2 los números pasen el umbral es necesario y no es suficiente. Si pasaran por poco y a
 * DPR 1 pasaran de sobra, la matriz estaría aguantando por los pelos en la mitad de los portátiles
 * del mundo — y eso hay que SABERLO, no descubrirlo cuando alguien abra la página.
 */
const base = filas[0];

di('  ¿CUÁNTO SE MUEVE CADA NÚMERO RESPECTO A DPR 1? (si el antialiasing importara, se vería aquí)');
di();

for (const f of filas.slice(1)) {
    const d = (a, b) => (a === Infinity || b === Infinity ? '—' : (a - b >= 0 ? '+' : '') + (a - b).toFixed(1));

    di(
        `     ${pad(f.estado.nombre, 32)} ley 2 ${pad(d(f.ley2, base.ley2), 7)} `
        + `ley 0 ${pad(d(f.ley0, base.ley0), 7)} raya ${pad(d(f.raya, base.raya), 7)}`,
    );
}

di();
di('═'.repeat(118));

if (fallos.length) {
    di(`❌ ${fallos.length} FALLOS. La matriz visual NO se cumple en alguna densidad.`);
    di();
    fallos.forEach((f) => di(`   · ${f}`));
} else {
    di('✅ En las siete densidades —Retina incluida— cada barra sigue diciendo de quién es, ninguna');
    di('   suena a una gravedad ajena, y la trama se ve sin cambiarle el tono a nadie.');
}

di();

writeFileSync(new URL('./salida/densidad.txt', import.meta.url), salida);

process.exit(fallos.length ? 1 : 0);
