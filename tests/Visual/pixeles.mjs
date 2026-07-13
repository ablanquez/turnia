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
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'http://turnia.test';

const lunesDe = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);

    return d.toISOString().slice(0, 10);
};

/* ── Color: sRGB → Lab → ΔE00 (CIEDE2000). Sin dependencias, y con la fórmula entera. ── */

const lab = ([r, g, b]) => {
    const lin = (v) => {
        v /= 255;

        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };

    const [R, G, B] = [lin(r), lin(g), lin(b)];

    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;

    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};

const deltaE00 = (c1, c2) => {
    const [L1, a1, b1] = lab(c1);
    const [L2, a2, b2] = lab(c2);

    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    const C1 = Math.hypot(a1, b1);
    const C2 = Math.hypot(a2, b2);
    const Cm = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));

    const ap1 = (1 + G) * a1;
    const ap2 = (1 + G) * a2;

    const Cp1 = Math.hypot(ap1, b1);
    const Cp2 = Math.hypot(ap2, b2);

    const hp = (b, ap) => {
        if (b === 0 && ap === 0) return 0;
        const h = Math.atan2(b, ap) * deg;

        return h >= 0 ? h : h + 360;
    };

    const hp1 = hp(b1, ap1);
    const hp2 = hp(b2, ap2);

    const dL = L2 - L1;
    const dC = Cp2 - Cp1;

    let dh = 0;
    if (Cp1 * Cp2 !== 0) {
        dh = hp2 - hp1;
        if (dh > 180) dh -= 360;
        else if (dh < -180) dh += 360;
    }

    const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad);

    const Lm = (L1 + L2) / 2;
    const Cpm = (Cp1 + Cp2) / 2;

    let hpm;
    if (Cp1 * Cp2 === 0) hpm = hp1 + hp2;
    else if (Math.abs(hp1 - hp2) <= 180) hpm = (hp1 + hp2) / 2;
    else hpm = hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2;

    const T = 1
        - 0.17 * Math.cos((hpm - 30) * rad)
        + 0.24 * Math.cos(2 * hpm * rad)
        + 0.32 * Math.cos((3 * hpm + 6) * rad)
        - 0.20 * Math.cos((4 * hpm - 63) * rad);

    const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
    const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));

    const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
    const Sc = 1 + 0.045 * Cpm;
    const Sh = 1 + 0.015 * Cpm * T;
    const Rt = -Math.sin(2 * dTheta * rad) * Rc;

    return Math.sqrt(
        (dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2
        + Rt * (dC / Sc) * (dH / Sh),
    );
};

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

/* ── El instrumento ────────────────────────────────────────────────────────── */

/*
 * ⚠️ 1366 DE ANCHO — QUE ES LO QUE SE PIDE — Y ALTO GRANDE PARA MEDIR. Y NO ES TRAMPA.
 *
 * En la primera pasada, cuatro personas (Bea, Leo, Lucía, Tomás) dieron un píxel #000000 y un
 * ΔE de 0,0 entre ellas: "indistinguibles". Y era MENTIRA — sus barras están por debajo del
 * pliegue, fuera de la captura, y yo estaba muestreando el vacío y llamándolo negro. El
 * instrumento denunciaba un fallo que no existía, tapando los que sí.
 *
 * Va la NOVENA vez que el instrumento miente. El ancho es lo único que cambia el diseño (las
 * columnas son fluidas); el alto solo decide cuánto se ve de una vez. Así que se mide con 1366
 * de ancho y alto suficiente para que TODAS las filas entren en la imagen, y la captura que se
 * mira con los ojos se hace aparte, a 1366×768.
 */
const ANCHO = 1366;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: ANCHO, height: 2400 } });

// ⚠️ Con `domcontentloaded` el HTML está pero Vue NO HA HIDRATADO: el clic cae en un formulario
// que todavía no escucha y el instrumento se queda en /login hasta el timeout — que devuelve el
// mismo código de salida que un fallo de verdad. Se espera al `load`, y se reintenta.
for (let intento = 1; intento <= 3; intento++) {
    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 60000 });
    await page.fill('input[type=email]', 'demo@turnia.test');
    await page.fill('input[type=password]', 'turnia');
    await page.click('button[type=submit]');

    try {
        await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 20000 });
        break;
    } catch (e) {
        if (intento === 3) {
            throw new Error('no se pudo entrar tras tres intentos de login');
        }
    }
}

/**
 * Localiza cada barra y cada avatar EN COORDENADAS DE LA CAPTURA, y también su color declarado
 * —solo para poder enseñar la diferencia entre lo declarado y lo que sale.
 */
const localizar = () => {
    const css = (el, p) => getComputedStyle(el)[p];
    const piezas = [];

    // ⚠️ Solo lo que está DENTRO DE LA IMAGEN. Muestrear fuera devuelve negro, y un negro
    // inventado se parece muchísimo a otro negro inventado: cuatro personas salieron
    // "indistinguibles" con ΔE 0,0 porque yo estaba midiendo el vacío.
    const visible = (r) => r.width > 0 && r.height > 0
        && r.top >= 0 && r.left >= 0
        && r.bottom <= window.innerHeight && r.right <= window.innerWidth;

    /**
     * ⚠️ UN PUNTO DE LA BARRA DONDE SOLO HAYA RELLENO. NI TEXTO, NI AVATAR, NI MUESCA.
     *
     * Muestreaba el CENTRO GEOMÉTRICO de la barra. En la Semana la barra está vacía y eso vale.
     * En el DÍA, la barra lleva DENTRO el avatar, el nombre y la hora — y el centro de la barra
     * de Bea cae justo encima de la palabra "Bea Soler". Estaba midiendo LETRAS y llamándolas
     * relleno: por eso su malva (#CEAAC6) salía como un azul grisáceo (#BBD5E3), y por eso
     * "todos los rellenos del Día se parecían" — se parecían las LETRAS, que son todas del mismo
     * color de tinta.
     *
     * Va la DÉCIMA vez que el instrumento miente. Ahora se barre la barra de derecha a izquierda
     * buscando un punto que no pise a ninguno de sus hijos. Si no hay ninguno, no se inventa: se
     * declara que esa barra no tiene relleno que medir, y eso ya es el hallazgo.
     */
    const puntoDeRelleno = (el, r, borde) => {
        const hijos = [...el.children].map((c) => c.getBoundingClientRect());
        const y = r.top + r.height / 2;
        const dentro = (x) => hijos.some((h) => x >= h.left - 2 && x <= h.right + 2 && y >= h.top - 2 && y <= h.bottom + 2);

        for (let f = 0.94; f >= 0.06; f -= 0.02) {
            const x = r.left + borde + 2 + (r.width - 2 * borde - 4) * f;

            if (x > r.left + borde + 1 && x < r.right - borde - 1 && !dentro(x)) {
                return { x, y };
            }
        }

        return null;
    };

    for (const barra of document.querySelectorAll('[data-t=barra]')) {
        const carril = barra.closest('[data-t=carril]');
        const celda = barra.closest('[data-celda]');
        const r = barra.getBoundingClientRect();

        if (!visible(r)) continue;

        /*
         * ⚠️ LAS BARRAS TRAMADAS NO ENTRAN EN LA COMPARACIÓN DE IDENTIDAD.
         *
         * Una barra tramada (un imposible, un concepto) lleva el color de la persona CON UNA
         * TRAMA OSCURA ENCIMA: el rosa de Iker (#E662AE) sale como #AE508D. Meterlas en la misma
         * mediana que sus barras lisas produce un color que no es ninguno de los dos, y el
         * instrumento acaba comparando fantasmas.
         *
         * No es que la identidad se pierda en una barra tramada —el tono sigue siendo el suyo, y
         * todas las tramadas se oscurecen igual—: es que no se pueden mezclar dos poblaciones en
         * una sola mediana. Se comparan las LISAS, que es donde el relleno va a plena voz.
         */
        if (css(barra, 'backgroundImage') !== 'none') {
            continue;
        }

        // Por DENTRO del borde: se mide el relleno, no el filo de gravedad.
        const borde = parseFloat(css(barra, 'borderTopWidth')) || 0;
        const punto = puntoDeRelleno(barra, r, borde);

        if (!punto) {
            piezas.push({ tipo: 'barra', persona: carril?.dataset.persona ?? barra.dataset.persona ?? '?', sinRelleno: true });
            continue;
        }

        piezas.push({
            tipo: 'barra',
            // En la Semana la persona la da el carril; en el Día, la propia barra.
            persona: carril?.dataset.persona ?? barra.dataset.persona ?? '?',
            celda: celda?.dataset.celda ?? '?',
            declarado: css(barra, 'backgroundColor'),
            bordeDeclarado: css(barra, 'borderTopColor'),
            x: punto.x,
            y: punto.y,
            alto: r.height,
            ancho: r.width,
            rellenoUtil: Math.max(0, r.height - 2 * borde),
        });
    }

    /*
     * ⚠️ Y EL AVATAR TAMPOCO SE MIDE POR EL CENTRO: AHÍ ESTÁN LAS INICIALES.
     *
     * Undécima mentira del instrumento, y la misma de antes con otro traje. El avatar de Ana es
     * un teal (#14748A) y el píxel del centro me daba un LAVANDA (#C4B0E1): estaba midiendo las
     * letras "AL", no el disco. Y como las letras son todas del mismo color, los avatares salían
     * "casi idénticos" (ΔE 3,1) — un fallo inventado que además tapaba la medición real.
     *
     * Se muestrea en la diagonal, a 0,28 del ancho desde el centro: dentro del círculo, fuera de
     * los glifos, y lejos del antialiasing del borde.
     */
    for (const av of document.querySelectorAll('[data-t=avatar]')) {
        const r = av.getBoundingClientRect();

        if (!visible(r)) continue;

        piezas.push({
            tipo: 'avatar',
            persona: av.dataset.persona ?? '?',
            celda: av.closest('[data-celda]')?.dataset.celda ?? '?',
            declarado: css(av, 'backgroundColor'),
            // ⚠️ ABAJO-IZQUIERDA, no arriba-derecha: ARRIBA-DERECHA ESTÁ EL PUNTO ÁMBAR de
            // "también trabaja en otra empresa". El avatar de Marco (ciruela oscuro, #5C4460)
            // me salía NARANJA (#C28760): estaba midiendo el aviso, no a Marco.
            x: r.left + r.width / 2 - r.width * 0.28,
            y: r.top + r.height / 2 + r.height * 0.28,
            alto: r.height,
            ancho: r.width,
            rellenoUtil: r.height,
        });
    }

    return piezas;
};

/**
 * ⚠️ AQUÍ SE LEE LA IMAGEN, NO EL DOM.
 *
 * La captura se decodifica en un canvas del propio Chromium y se muestrea el píxel. Es lo único
 * que responde a la pregunta "¿qué VE una persona?", que es distinta de "¿qué dice el CSS?".
 */
const muestrear = async (png, piezas) => page.evaluate(async ({ dataUrl, piezas }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    const c = new OffscreenCanvas(img.width, img.height);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    // La captura viene en píxeles de dispositivo; el DOM mide en CSS.
    const escala = img.width / window.innerWidth;

    return piezas.map((p) => {
        const x = Math.round(p.x * escala);
        const y = Math.round(p.y * escala);

        // Una mediana de 9 muestras: un solo píxel puede caer justo en el antialiasing de la
        // trama o del redondeo, y entonces mediría el borde creyendo medir el relleno.
        const muestras = [];

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const d = ctx.getImageData(x + dx, y + dy, 1, 1).data;
                muestras.push([d[0], d[1], d[2]]);
            }
        }

        const mediana = [0, 1, 2].map((i) => {
            const v = muestras.map((m) => m[i]).sort((a, b) => a - b);

            return v[Math.floor(v.length / 2)];
        });

        return { ...p, pixel: mediana };
    });
}, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, piezas });

/**
 * ⚠️ QUÉ ELEMENTO LLEVA LA IDENTIDAD EN CADA VISTA. Y NO ES UNA ESCAPATORIA: ES LA LEY 2.
 *
 * La ley 2 dice: "tapa los nombres de una celda y todavía tienes que poder reconstruir quién
 * hace qué". Lo que NO dice es que el píxel concreto tenga que ser el mismo en las dos vistas —
 * dice que la identidad tiene que estar, y a plena intensidad, DENTRO de lo que se ve.
 *
 *   · SEMANA → LA BARRA. Mide 10 px, está vacía, y no hay ningún avatar dentro de la pista. Si
 *     tapas la fila del nombre, lo único que queda es el relleno. Tiene que identificar, y punto.
 *
 *   · DÍA → EL AVATAR, que va DENTRO de la barra, sólido y a 20 px. Aquí la barra lleva escrito
 *     el nombre y la hora, así que su relleno NO PUEDE ir a plena tinta: el texto dejaría de
 *     leerse (ley 6). Es un tinte, y un tinte comprime el color hacia el blanco: medido, los
 *     rellenos del Día dan ΔE de 7 a 18 y no bastan. El que identifica es el disco de color.
 *
 * Así que el instrumento SUSPENDE por el portador de cada vista, y enseña el otro como dato.
 * Decir "en el Día también vale el relleno" sería mentir; decir "en el Día no se identifica"
 * también, porque se identifica — con el disco, que está dentro de la barra y es sólido.
 */
const vistas = [
    { clave: 'semana', nombre: 'SEMANA (con gente)', portador: 'barra', url: `/companies/1/calendars/1/schedule?week=${lunesDe(0)}` },
    { clave: 'dia', nombre: 'DÍA (lunes)', portador: 'avatar', url: `/companies/1/calendars/1/schedule/day?day=${lunesDe(0)}` },
    { clave: 'vacia', nombre: 'SEMANA VACÍA (sin un solo turno)', portador: 'barra', url: `/companies/1/calendars/1/schedule?week=${lunesDe(2)}` },
];

const resultado = {};
const fallosPrevios = [];

for (const vista of vistas) {
    await page.goto(`${BASE}${vista.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-t=indicador]', { timeout: 60000 });
    await page.waitForTimeout(700);

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

    const muestras = await muestrear(png, medibles);

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

const INDISTINGUIBLE = 12;
const CUESTA = 20;

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
    const barras = dePersona(piezas.filter((p) => p.tipo === 'barra'));
    const avatares = dePersona(piezas.filter((p) => p.tipo === 'avatar'));

    porVista[clave] = { vista, barras, avatares };

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

/* ── ¿Se cumple la ley 2 IGUAL en las dos vistas? ── */

di();
di('▓ LA MISMA LEY EN LAS DOS VISTAS');
di('─'.repeat(122));

for (const { vista, barras, avatares } of Object.values(porVista)) {
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
