/**
 * EL COTEJO DEL PÍXEL. SOBRE LA IMAGEN RENDERIZADA, NO SOBRE EL CSS.
 *
 * ⚠️ ESTE FICHERO EXISTE PORQUE matriz.mjs DIO 44 FIRMAS Y 0 GEMELOS, Y LAS BARRAS DE LA SEMANA
 * ERAN INDISTINGUIBLES A OJO.
 *
 * ¿Cómo puede ser? Porque matriz.mjs compara los colores que el navegador CALCULA para cada
 * propiedad CSS — y dos colores distintos en el `backgroundColor` pueden ser el mismo color
 * PARA UN OJO. "Firma distinta" no es lo mismo que "se distingue".
 *
 * Es la capa 5, otra vez: EL PÍXEL DECLARADO NO ES EL PÍXEL RESULTANTE. Ya nos pasó con el
 * verde al 18 % sobre gris (que daba gris) y con el "-1" gris sobre rayado gris. Aquí es peor,
 * porque el CSS es correcto: los quince colores de la paleta SON distintos. Lo que falla es que
 * en una barra de 10 px, con un borde comiéndose los bordes, quince índigos con la misma
 * luminosidad y el mismo croma son quince veces el mismo color.
 *
 * ASÍ QUE AQUÍ NO SE MIRA NI UNA VARIABLE CSS:
 *
 *   1. Se abre la página a 1366 px y se hace una CAPTURA.
 *   2. Se decodifica la captura (en el propio Chromium, con un canvas).
 *   3. Se extrae EL PÍXEL DEL CENTRO DEL RELLENO de cada barra, por dentro del borde.
 *   4. Se convierte a Lab y se calcula el ΔE00 (CIEDE2000) entre cada par de personas.
 *   5. Si dos personas distintas dan barras con un ΔE por debajo del umbral, ES UN FALLO —
 *      aunque el CSS declare colores distintos.
 *
 * EL UMBRAL. ΔE00 ≈ 2,3 es el "apenas perceptible" clásico, pero está medido con dos parches
 * GRANDES y PEGADOS, en laboratorio. Aquí hablamos de barras de 10 px separadas por texto, que
 * es el peor caso posible para el ojo. Se usan dos:
 *
 *   · ΔE < 12  → INDISTINGUIBLE de un vistazo. Es un fallo de la ley 2.
 *   · ΔE < 20  → CUESTA. Se avisa, no se suspende.
 *
 *   node tests/Visual/pixeles.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import {
    CUESTA, FAMILIA_DE_ANILLO, INDISTINGUIBLE, SUENA,
    conRelleno, deltaE00, entrar, hex, localizar, lunesDe, muestrear, rgbDe, sueneA,
} from './pixel.mjs';

const BASE = 'http://turnia.test';

const ANCHO = 1366;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: ANCHO, height: 2400 } });

await entrar(page, BASE);

/**
 * ⚠️ UNA CUARTA VISTA QUE NO ES UNA VISTA: EL CUADRANTE DE LA MATRIZ.
 *
 * En la demo hay tres barras con anillo sobre doce colores de paleta, así que la ley 0 se estaba
 * comprobando sobre las parejas (color, gravedad) que la demo enseña POR CASUALIDAD. Y se notó: al
 * reintroducir la paleta de croma bajo, el instrumento la dejó PASAR — no porque el color fuera
 * bueno, sino porque al ciruela le tocó una persona sin gravedad. Cobertura por suerte no es
 * cobertura.
 *
 * El cuadrante de MatrizSeeder tiene 96 casos con todas las gravedades y todos los colores. No
 * entra en la comparación de identidad —96 personas para 12 colores, se repiten a propósito— y por
 * eso lleva bandera.
 */
const matriz = JSON.parse(readFileSync(new URL('./matriz.json', import.meta.url), 'utf8'));

const vistas = [
    { clave: 'semana', nombre: 'SEMANA (con gente)', portador: 'barra', url: `/companies/1/calendars/1/schedule?week=${lunesDe(0)}` },
    { clave: 'dia', nombre: 'DÍA (lunes)', portador: 'avatar', url: `/companies/1/calendars/1/schedule/day?day=${lunesDe(0)}` },
    { clave: 'vacia', nombre: 'SEMANA VACÍA (sin un solo turno)', portador: 'barra', url: `/companies/1/calendars/1/schedule?week=${lunesDe(2)}` },
    { clave: 'matriz', nombre: 'CUADRANTE DE LA MATRIZ (96 casos)', portador: 'barra', soloLey0: true, url: matriz.bloques.url },

    /*
     * ⚠️ EL PEOR CASO GEOMÉTRICO, Y NO SE MEDÍA EN NINGUNA PARTE.
     *
     * El anillo rodea la barra por los CUATRO lados, así que su peso es
     * 1 − (ancho×alto)/((ancho+2w)(alto+2w)). En un turno de 8 h la barra mide ~50 px y el anillo
     * del imposible pesa el 43 %. En un turno de UNA HORA la barra mide 6 px y ese mismo anillo
     * pasa a pesar el SETENTA POR CIENTO.
     *
     * Toda la demo y todo el cuadrante de la matriz usan turnos de 8 h. O sea que el caso en el
     * que la ley 0 tiene más papeletas de romperse NO ESTABA SEMBRADO EN NINGÚN SITIO, y ningún
     * instrumento lo había mirado nunca. Se ve al pensar en el responsive: estrechar una columna
     * hace exactamente lo mismo que acortar un turno.
     */
    { clave: 'cortos', nombre: 'TURNOS DE UNA HORA (el peor caso del anillo)', portador: 'barra', soloLey0: true, url: matriz.anchos.url },
];

const resultado = {};
const fallosPrevios = [];

for (const vista of vistas) {
    // El cuadrante de la matriz tiene 96 casos: sin un viewport muy alto, la mayoría cae fuera de
    // la imagen y no se puede medir. El ANCHO sigue siendo 1366 — es lo único que cambia el
    // diseño; el alto solo decide cuánto se ve de una vez.
    await page.setViewportSize({ width: ANCHO, height: vista.soloLey0 ? 9000 : 2400 });

    await page.goto(`${BASE}${vista.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-t=indicador]', { timeout: 90000 });
    await page.waitForTimeout(vista.soloLey0 ? 1500 : 700);

    const piezas = await page.evaluate(localizar);

    // ⚠️ NADA SE DESCARTA EN SILENCIO. Si una pieza no sabe de quién es, el instrumento no puede
    // medirla — y callarlo sería contar menos pares de los que hay y dar verde por omisión.
    const huerfanas = piezas.filter((p) => p.persona === '?');

    if (huerfanas.length) {
        fallosPrevios.push(`${vista.nombre}: ${huerfanas.length} piezas sin dueño (${huerfanas[0].tipo}): el instrumento no puede cotejarlas`);
    }

    // Una barra tan llena de contenido que no queda un solo píxel de relleno visible NO puede
    // identificar a nadie. No se descarta: se denuncia.
    for (const p of piezas.filter((x) => x.sinRelleno)) {
        fallosPrevios.push(`${vista.nombre}: la barra de «${p.persona}» no tiene ni un píxel de relleno a la vista`);
    }

    const medibles = piezas.filter((p) => !p.sinRelleno && p.persona !== '?');

    const png = await page.screenshot();

    mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });
    writeFileSync(new URL(`./salida/px-${vista.clave}.png`, import.meta.url), png);

    const muestras = await muestrear(page, png, medibles);

    /*
     * ⚠️ EL GUARDIA DEL PROPIO INSTRUMENTO. Y me habría ahorrado los tres últimos errores.
     *
     * Si un elemento es OPACO, el píxel que sale de la imagen tiene que parecerse al color que el
     * CSS declara. Si no se parece, no es que la página esté mal: es que ESTOY MIDIENDO OTRA COSA
     * — el vacío fuera del viewport, las letras de dentro de la barra, las iniciales del avatar.
     *
     * Las tres veces el instrumento denunció fallos que no existían y tapó los que sí. Ahora, si
     * la medida no cuadra con lo declarado, el que suspende es el instrumento.
     */
    for (const m of muestras) {
        const n = (m.declarado.match(/[\d.]+/g) ?? []).map(Number);

        if (n.length > 3 && n[3] < 0.99) {
            continue;   // translúcido: el píxel es una mezcla, y no tiene por qué coincidir
        }

        if (m.tramada) {
            continue;   // la trama va ENCIMA del color declarado: el píxel es otro a propósito
        }

        const d = deltaE00(m.pixel, [n[0], n[1], n[2]]);

        if (d > 8) {
            fallosPrevios.push(
                `INSTRUMENTO: el ${m.tipo} de «${m.persona}» declara ${m.declarado} y el píxel dice `
                + `${hex(m.pixel)} (ΔE ${d.toFixed(1)}). No estoy midiendo lo que creo.`,
            );
        }
    }

    resultado[vista.clave] = { vista, piezas: muestras };
}

await browser.close();

/* ── El cotejo ─────────────────────────────────────────────────────────────── */

let salida = '';
const di = (s = '') => { salida += s + String.fromCharCode(10); console.log(s); };

const pad = (s, n) => String(s).padEnd(n).slice(0, n);

const fallos = [...fallosPrevios];

di();
di('EL COTEJO DEL PÍXEL — medido sobre la IMAGEN RENDERIZADA, no sobre el CSS · 1366 px de ancho');
di('═'.repeat(122));

const porVista = {};

/** El píxel representativo de cada persona: la mediana de todas sus piezas de ese tipo. */
const dePersona = (lista) => {
    const m = new Map();

    for (const p of lista) {
        if (!m.has(p.persona)) m.set(p.persona, []);
        m.get(p.persona).push(p);
    }

    return [...m.entries()].map(([persona, ps]) => ({
        persona,
        declarado: ps[0].declarado,
        alto: ps[0].alto,
        rellenoUtil: ps[0].rellenoUtil,
        pixel: [0, 1, 2].map((i) => {
            const v = ps.map((p) => p.pixel[i]).sort((a, b) => a - b);

            return v[Math.floor(v.length / 2)];
        }),
    })).sort((a, b) => a.persona.localeCompare(b.persona));
};

const paresDe = (gente) => {
    const out = [];

    for (let i = 0; i < gente.length; i++) {
        for (let j = i + 1; j < gente.length; j++) {
            out.push({ a: gente[i], b: gente[j], d: deltaE00(gente[i].pixel, gente[j].pixel) });
        }
    }

    return out.sort((x, y) => x.d - y.d);
};

for (const [clave, { vista, piezas }] of Object.entries(resultado)) {
    // Las TRAMADAS no entran en la mediana de identidad: llevan la trama encima del color, y
    // mezclar dos poblaciones en una sola mediana da un color que no es de ninguna de las dos.
    // Se excluyen de ESTA comparación — y de ninguna otra: siguen midiéndose en la ley 0.
    const barras = dePersona(piezas.filter((p) => p.tipo === 'barra' && !p.tramada));
    const avatares = dePersona(piezas.filter((p) => p.tipo === 'avatar'));

    porVista[clave] = { vista, barras, avatares };

    // El cuadrante de la matriz NO se compara por identidad: tiene 96 personas para 12 colores, y
    // los colores se repiten A PROPÓSITO. Está aquí solo para que la ley 0 se pruebe de verdad.
    if (vista.soloLey0) {
        continue;
    }

    di();
    di(`▓ ${vista.nombre}   —   aquí la identidad la lleva: ${vista.portador.toUpperCase()}`);
    di('─'.repeat(122));

    if (!barras.length && !avatares.length) {
        di('  (ni una barra: no hay nadie colocado. Nada que cotejar, y eso NO es un aprobado.)');
        continue;
    }

    const gente = vista.portador === 'avatar' ? avatares : barras;
    const otro = vista.portador === 'avatar' ? barras : avatares;

    di(`${pad('PERSONA', 15)} ${pad('DECLARADO (CSS)', 24)} ${pad('PÍXEL REAL', 11)} ${pad('ALTO', 6)} ${pad('RELLENO', 8)} ¿SE DISTINGUE DE LA MÁS PARECIDA?`);
    di('─'.repeat(122));

    const pares = paresDe(gente);

    for (const p of gente) {
        const cerca = pares.filter((x) => x.a.persona === p.persona || x.b.persona === p.persona)[0];
        const quien = cerca ? (cerca.a.persona === p.persona ? cerca.b.persona : cerca.a.persona) : null;

        const marca = !cerca ? '—'
            : cerca.d < INDISTINGUIBLE ? '❌ NO'
                : cerca.d < CUESTA ? '⚠️  cuesta' : '✅ sí';

        di(
            `${pad(p.persona, 15)} ${pad(p.declarado, 24)} ${pad(hex(p.pixel), 11)} `
            + `${pad((p.alto ?? 0).toFixed(0) + 'px', 6)} ${pad((p.rellenoUtil ?? 0).toFixed(0) + 'px', 8)} `
            + `${pad(marca, 11)} ${cerca ? `ΔE00 ${cerca.d.toFixed(1)} · ${quien}` : ''}`,
        );
    }

    const malos = pares.filter((p) => p.d < INDISTINGUIBLE);
    const justos = pares.filter((p) => p.d >= INDISTINGUIBLE && p.d < CUESTA);

    di();
    di(`  ${pares.length} pares comparados · ${malos.length} INDISTINGUIBLES (ΔE < ${INDISTINGUIBLE}) · ${justos.length} justos (< ${CUESTA})`);

    for (const p of malos) {
        fallos.push(`${vista.nombre}: «${p.a.persona}» y «${p.b.persona}» son INDISTINGUIBLES en el ${vista.portador} — ΔE00 ${p.d.toFixed(1)} (${hex(p.a.pixel)} vs ${hex(p.b.pixel)})`);
        di(`    ❌ ${p.a.persona} ≡ ${p.b.persona} — ΔE ${p.d.toFixed(1)}`);
    }

    for (const p of justos) {
        di(`    ⚠️  ${p.a.persona} / ${p.b.persona} — ΔE ${p.d.toFixed(1)}`);
    }

    // El otro elemento se ENSEÑA, pero no suspende: no es el que lleva la identidad en esta vista.
    if (otro.length > 1) {
        const po = paresDe(otro);

        di(`  (dato, no veredicto) el ${vista.portador === 'avatar' ? 'relleno de la barra' : 'avatar'} da un ΔE mínimo de ${po[0].d.toFixed(1)} — en esta vista NO es el que identifica`);
    }
}

/* ── ¿ALGÚN COLOR DE PERSONA SUENA A UN ESTADO? ── */

di();
di('▓ LEY 0 — NINGÚN COLOR DE PERSONA PUEDE CONFUNDIRSE CON UNA GRAVEDAD');
di('─'.repeat(122));


/*
 * ⚠️ SE AGRUPA POR COLOR, NO POR PERSONA. Y ESE CAMBIO ES LO QUE CAZA LA PALETA MALA.
 *
 * Agrupando por persona, la comprobación cubría lo que la demo enseña POR CASUALIDAD: tres barras
 * con anillo (Marco un aviso, Sara un incumplimiento, Tomás un imposible) sobre doce colores. Al
 * reintroducir a propósito la paleta de croma bajo —la del ciruela que se volvía marrón—, el
 * instrumento la dejó PASAR: al ciruela le había tocado una persona sin gravedad.
 *
 * Cobertura por suerte no es cobertura. Lo que se prueba es la PAREJA (color, gravedad), y se
 * dice EN VOZ ALTA cuáles no han salido. Un hueco declarado no aprueba; un hueco callado, sí.
 */
const declaradoDe = (p) => rgbDe(p.declarado);

/**
 * ⚠️ UN BLOQUE HUECO NO TIENE RELLENO, Y LEERLO COMO SI LO TUVIERA ES LA MENTIRA NÚMERO CATORCE.
 *
 * Un concepto que ni cubre ni cuenta se pinta HUECO —`background: transparent`—, y el navegador
 * devuelve `rgba(0, 0, 0, 0)`. Yo le arrancaba los tres primeros números y me quedaba con
 * NEGRO: un color que no está en la paleta, que no es de nadie, y contra el que cualquier
 * comparación es basura. El instrumento denunciaba un margen de −33 sobre una barra que no tiene
 * relleno que contaminar.
 *
 * Un hueco identifica por su BORDE discontinuo, que va en el color de la persona y que el anillo
 * —al ir por fuera— no toca. Así que la ley 2 se cumple ahí por otro canal, y estas barras no
 * entran en una comprobación que habla del relleno. Se descuentan, y se dice cuántas.
 */
const todasLasBarras = Object.values(resultado)
    .flatMap(({ piezas }) => piezas.filter((p) => p.tipo === 'barra'));

const huecas = todasLasBarras.filter((p) => !conRelleno(p)).length;

/* 1. EL RELLENO SOLO. Un color de persona, por sí mismo, jamás puede sonar a un estado. */

di();
di('  1. EL RELLENO SOLO — cada COLOR de la paleta que sale en pantalla, contra los ocho semánticos');
di();
di(`     ${pad('COLOR', 10)} ${pad('PÍXEL MEDIDO', 13)} ${pad('QUIÉN LO LLEVA', 16)} ${pad('ESTADO MÁS CERCANO', 28)} ΔE00`);
di('     ' + '─'.repeat(85));

const porColor = new Map();

for (const p of todasLasBarras.filter((x) => !x.tramada && x.pixel && conRelleno(x))) {
    const k = hex(declaradoDe(p));
    if (!porColor.has(k)) porColor.set(k, p);
}

for (const [color, p] of [...porColor.entries()].sort()) {
    const s = sueneA(p.pixel);

    di(`     ${pad(color, 10)} ${pad(hex(p.pixel), 13)} ${pad(p.persona, 16)} ${pad(s.nombre, 28)} ${s.d < SUENA ? '❌' : '✅'} ${s.d.toFixed(1)}`);

    if (s.d < SUENA) {
        fallos.push(`LEY 0 · el relleno ${color} (lo lleva «${p.persona}») SUENA A «${s.nombre}» — ΔE00 ${s.d.toFixed(1)}. Un color de persona no puede parecerse a una gravedad.`);
    }
}

/*
 * 2. LA BARRA ENTERA CON SU ANILLO. La medida que faltaba, y la que el usuario hizo con los ojos.
 *
 * ⚠️ Y LA PREGUNTA ES "¿SE PARECE A OTRA GRAVEDAD?", NO "¿SE PARECE A UNA GRAVEDAD?".
 *
 * Una barra imposible SE TIENE QUE PARECER a un rojo: es un imposible, y el usuario pide justo
 * que se lea como tal. Lo que no puede es parecerse a una gravedad AJENA más que a la persona de
 * quien es — que es exactamente lo que pasaba: la barra de Marco, con un AVISO, se veía #855F3E,
 * a ΔE 11 de la tinta de IMPOSIBLE y a ΔE 28 del propio Marco.
 */
di();
di('  2. LA BARRA ENTERA, CON SU ANILLO DE GRAVEDAD PEGADO (que es lo que el ojo integra de verdad)');
di();
di(`     Ninguna barra puede quedar a menos de ΔE ${SUENA} de una gravedad que NO ES LA SUYA.`);
di();
di(`     ${pad('COLOR', 10)} ${pad('GRAVEDAD', 11)} ${pad('BARRA VISTA', 12)} ${pad('GRAVEDAD AJENA MÁS CERCANA', 28)} ΔE00`);
di('     ' + '─'.repeat(80));

const porPareja = new Map();

for (const p of todasLasBarras.filter((x) => x.integrada && x.anillo > 0 && conRelleno(x))) {
    const k = `${hex(declaradoDe(p))}|${FAMILIA_DE_ANILLO[p.anilloDeclarado] ?? '?'}`;
    if (!porPareja.has(k)) porPareja.set(k, p);
}

let peorAjena = Infinity;

for (const [k, p] of [...porPareja.entries()].sort()) {
    const [color, mia] = k.split('|');

    const otra = sueneA(p.integrada, mia);

    peorAjena = Math.min(peorAjena, otra.d);

    di(
        `     ${pad(color, 10)} ${pad(mia, 11)} ${pad(hex(p.integrada), 12)} ${pad(otra.nombre, 28)} `
        + `${otra.d < SUENA ? '❌' : '✅'} ${otra.d.toFixed(1)}`,
    );

    if (otra.d < SUENA) {
        fallos.push(
            `LEY 0 · una barra ${color} con anillo de «${mia}» (la de «${p.persona}») se ve ${hex(p.integrada)}, `
            + `y eso queda a ΔE ${otra.d.toFixed(1)} de «${otra.nombre}» — una gravedad que NO ES LA SUYA. `
            + 'La barra puede confundirse con lo que no es.',
        );
    }
}

/* ⚠️ NADA SE DA POR BUENO POR AUSENCIA. Los huecos se dicen: un hueco callado es un aprobado. */
const colores = [...porColor.keys()];
const faltan = [];

for (const c of colores) {
    for (const g of ['impossible', 'breach', 'notice']) {
        if (!porPareja.has(`${c}|${g}`)) faltan.push(`${c}+${g}`);
    }
}

di();
di(`     ${porPareja.size} parejas (color, gravedad) medidas de ${colores.length * 3} posibles · la más cerca de una gravedad ajena: ${peorAjena === Infinity ? '—' : peorAjena.toFixed(1)}`);
di(`     ${huecas} barras HUECAS descontadas: un concepto que ni cubre ni cuenta no tiene relleno, y su identidad`);
di('        va en el borde discontinuo —color de la persona— que el anillo, al ir por fuera, no toca.');

if (faltan.length) {
    di(`     ⚠️  NO PROBADAS (${faltan.length}): ${faltan.join(' · ')}`);
    di('        No están mal: es que no han salido en pantalla. Se dicen para no aprobarlas por omisión.');
}

for (const familia of ['impossible', 'breach', 'notice']) {
    if (![...porPareja.keys()].some((k) => k.endsWith(`|${familia}`))) {
        fallos.push(`LEY 0: no ha salido NI UNA barra con anillo de «${familia}». Esa gravedad no se ha probado, y callarlo sería aprobar por omisión.`);
    }
}

di();
di('  Y el umbral es ABSOLUTO, no relativo. La primera versión pedía que la barra se pareciera "más');
di('  a su persona que a una gravedad ajena", y eso ACUSABA A UN INOCENTE: una barra teal con anillo');
di('  rojo queda a ΔE 29,6 del naranja —lejísimos, no se confunde con nada— pero también lejos del');
di('  teal, así que el margen salía negativo. Lo que importa no es de qué se aleja: es de qué se');
di('  ACERCA.');

/* ── ¿Se cumple la ley 2 IGUAL en las dos vistas? ── */

di();
di('▓ LA MISMA LEY EN LAS DOS VISTAS');
di('─'.repeat(122));

for (const { vista, barras, avatares } of Object.values(porVista)) {
    // ⚠️ El cuadrante de la matriz NO va aquí: 96 personas para 12 colores, y los colores se
    // repiten A PROPÓSITO. Se coló, cantó "ΔE 0,0 · la ley 2 NO se cumple" y el resumen de abajo
    // seguía diciendo ✅ — el instrumento contradiciéndose a sí mismo en la misma pantalla. Un
    // informe que se desmiente solo no se lee: se ignora, y entonces ya no sirve para nada.
    if (vista.soloLey0) {
        continue;
    }

    const gente = vista.portador === 'avatar' ? avatares : barras;

    if (gente.length < 2) {
        di(`${pad(vista.clave, 10)} (menos de dos personas: nada que comparar)`);
        continue;
    }

    const m = paresDe(gente)[0].d;

    di(
        `${pad(vista.clave, 10)} portador: ${pad(vista.portador, 8)} ΔE00 mínimo entre personas: ${pad(m.toFixed(1), 7)} `
        + `${m < INDISTINGUIBLE ? '❌ la ley 2 NO se cumple' : '✅ la ley 2 se cumple'}`,
    );
}

di();
di('═'.repeat(122));

if (fallos.length) {
    di(`❌ ${fallos.length} FALLOS. La ley 2 («el relleno dice de quién es») no se cumple en alguna vista.`);
    di();
    fallos.forEach((f) => di(`   · ${f}`));
} else {
    di('✅ En las tres vistas, cada persona se distingue de todas las demás por el elemento que');
    di('   lleva su identidad. Ningún par produce píxeles indistinguibles.');
}

di();

writeFileSync(new URL('./salida/pixeles.txt', import.meta.url), salida);
writeFileSync(new URL('./salida/pixeles.json', import.meta.url), JSON.stringify(porVista, null, 2));

process.exit(fallos.length ? 1 : 0);
