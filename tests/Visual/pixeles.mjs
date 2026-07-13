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

/**
 * LOS COLORES QUE ESTA APP SE RESERVA PARA EL ESTADO. NINGUNA PERSONA PUEDE SONAR A UNO DE ELLOS.
 *
 * ⚠️ Y ESTE BLOQUE ENTERO ES LA COMPROBACIÓN QUE NO EXISTÍA — LA QUE HABRÍA CAZADO EL MARRÓN.
 *
 * El usuario abrió la página y vio la barra de Marco (ciruela apagado) con un anillo ámbar, y la
 * leyó como un INCUMPLIMIENTO. Y tenía razón: la barra medía 10 px y el borde de gravedad se
 * comía 4, así que lo que salía era una MEZCLA — #855F3E, marrón, a ΔE 10 de la tinta de aviso.
 *
 * Ningún instrumento lo veía, porque todos preguntaban lo mismo: "¿se distingue esta persona de
 * las demás?". Nadie preguntaba: "¿se parece esta persona a un ESTADO?". Y esa pregunta es peor,
 * porque un color de persona que suena a rojo no confunde a dos personas: dispara una alarma que
 * nadie ha declarado. Un aviso falso, pintado.
 *
 * Así que van dos medidas, y las dos SOBRE LA IMAGEN:
 *
 *   1. EL RELLENO SOLO   → ΔE(relleno, estado) ≥ 20. El color de una persona, por sí mismo,
 *      nunca puede sonar a un estado.
 *
 *   2. LA BARRA ENTERA CON SU ANILLO → la barra tiene que seguir pareciéndose MÁS a su persona
 *      que a cualquier estado. Es la medida que el ojo hace de verdad: nadie ve el relleno
 *      aislado, se ve la barra con lo que lleva pegado.
 */
const SEMANTICOS = {
    'rojo · imposible': { rgb: [200, 30, 30], familia: 'impossible' },
    'tinta de imposible': { rgb: [176, 20, 20], familia: 'impossible' },
    'rojo · hueco de cobertura': { rgb: [220, 38, 38], familia: 'impossible' },
    'naranja · incumplimiento': { rgb: [232, 89, 12], familia: 'breach' },
    'tinta de incumplimiento': { rgb: [168, 65, 10], familia: 'breach' },
    'ámbar · aviso': { rgb: [194, 135, 10], familia: 'notice' },
    'tinta de aviso': { rgb: [125, 86, 6], familia: 'notice' },
    'verde · cobertura correcta': { rgb: [21, 128, 61], familia: 'ok' },
};

/** El estado al que más suena un color, y a qué distancia. */
const sueneA = (pixel, excluir = null) => Object.entries(SEMANTICOS)
    .filter(([, s]) => s.familia !== excluir)
    .map(([nombre, s]) => ({ nombre, familia: s.familia, d: deltaE00(pixel, s.rgb) }))
    .sort((a, b) => a.d - b.d)[0];

/**
 * ⚠️ LA PREGUNTA TIENE QUE SER LA FINA, O SUSPENDE AL QUE ACIERTA.
 *
 * "¿Esta barra se parece a un estado?" es la pregunta equivocada para una barra IMPOSIBLE: se
 * parece a un rojo, y TIENE QUE PARECERSE — es un imposible, y el usuario pide justo que se lea
 * como tal. Un instrumento que la suspendiera por eso estaría exigiendo que la alarma no suene.
 *
 * La pregunta buena es la que el usuario hizo de verdad: la barra de Marco, que tiene un AVISO,
 * ¿puede confundirse con un INCUMPLIMIENTO? O sea:
 *
 *     UNA BARRA NUNCA PUEDE PARECERSE A UNA GRAVEDAD QUE NO ES LA SUYA
 *     MÁS QUE A LA PERSONA DE QUIEN ES.
 *
 * Con el borde dentro, la barra de Marco se veía #855F3E: ΔE 10 de la tinta de AVISO —su propia
 * gravedad, eso valdría— pero también ΔE 11 de la tinta de IMPOSIBLE y ΔE 28 de Marco. Se parecía
 * a un imposible casi tres veces más que a sí mismo. Eso es lo que hay que cazar.
 */
const FAMILIA_DE_ANILLO = {
    'rgb(200, 30, 30)': 'impossible',
    'rgb(232, 89, 12)': 'breach',
    'rgb(194, 135, 10)': 'notice',
};

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
         * ⚠️ LAS BARRAS TRAMADAS SE MARCAN, NO SE TIRAN. Y TIRARLAS ERA LA MENTIRA NÚMERO TRECE.
         *
         * Una barra tramada (un imposible, un concepto) lleva el color de la persona CON UNA TRAMA
         * OSCURA ENCIMA, así que no puede entrar en la misma MEDIANA que las lisas: el resultado no
         * sería ninguno de los dos colores y el instrumento acabaría comparando fantasmas. Eso es
         * cierto, y por eso se excluyen DE LA COMPARACIÓN DE IDENTIDAD.
         *
         * Pero aquí ponía `continue`, y eso las borraba del fichero entero. Resultado: la barra
         * IMPOSIBLE —que es tramada, y es la que lleva el anillo MÁS GORDO (3 px), o sea la que
         * más puede contaminarse— NO SE MEDÍA EN NINGUNA COMPROBACIÓN. El instrumento daba verde
         * sobre el caso que más lo necesitaba, y ni siquiera decía que se lo había saltado.
         *
         * Un descarte silencioso es un aprobado por omisión. Ahora se marca y se sigue midiendo.
         */
        const tramada = css(barra, 'backgroundImage') !== 'none';

        // Por DENTRO del borde: se mide el relleno, no el filo de gravedad.
        const borde = parseFloat(css(barra, 'borderTopWidth')) || 0;
        const punto = puntoDeRelleno(barra, r, borde);

        if (!punto) {
            piezas.push({ tipo: 'barra', persona: carril?.dataset.persona ?? barra.dataset.persona ?? '?', sinRelleno: true });
            continue;
        }

        // El ANILLO de gravedad va POR FUERA. La "barra que se ve" es el relleno MÁS su anillo, y
        // es esa caja entera la que hay que integrar para saber a qué suena de un vistazo.
        const anillo = css(barra, 'outlineStyle') === 'none' ? 0 : (parseFloat(css(barra, 'outlineWidth')) || 0);

        piezas.push({
            tipo: 'barra',
            tramada,
            // En la Semana la persona la da el carril; en el Día, la propia barra.
            persona: carril?.dataset.persona ?? barra.dataset.persona ?? '?',
            celda: celda?.dataset.celda ?? '?',
            declarado: css(barra, 'backgroundColor'),
            anillo,
            anilloDeclarado: anillo ? css(barra, 'outlineColor') : null,
            caja: {
                left: r.left - anillo, top: r.top - anillo,
                right: r.right + anillo, bottom: r.bottom + anillo,
            },
            // Lo que hay DENTRO de la barra no es la barra: el nombre, la hora, la muesca y el
            // filo se descuentan de la integración. Promediar letras no dice a qué suena la
            // barra — dice a qué suena la tipografía, que es la misma para todo el mundo.
            hijos: [...barra.children].map((c) => {
                const h = c.getBoundingClientRect();

                return { left: h.left, top: h.top, right: h.right, bottom: h.bottom };
            }),
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

        /*
         * LA BARRA ENTERA, CON SU ANILLO PEGADO. Es lo que el ojo integra de un vistazo, y es lo
         * único que responde a "¿esta barra suena a un estado?".
         *
         * Se promedia toda la caja (relleno + anillo) descontando lo que la barra lleve DENTRO.
         */
        let integrada = null;

        if (p.caja && p.anillo > 0) {
            const x0 = Math.round(p.caja.left * escala);
            const y0 = Math.round(p.caja.top * escala);
            const w = Math.round((p.caja.right - p.caja.left) * escala);
            const h = Math.round((p.caja.bottom - p.caja.top) * escala);

            if (w > 0 && h > 0 && x0 >= 0 && y0 >= 0 && x0 + w <= c.width && y0 + h <= c.height) {
                const d = ctx.getImageData(x0, y0, w, h).data;
                const suma = [0, 0, 0];
                let n = 0;

                for (let py = 0; py < h; py++) {
                    for (let px = 0; px < w; px++) {
                        const cx = (x0 + px) / escala;
                        const cy = (y0 + py) / escala;

                        if (p.hijos.some((k) => cx >= k.left - 1 && cx <= k.right + 1 && cy >= k.top - 1 && cy <= k.bottom + 1)) {
                            continue;
                        }

                        const o = (py * w + px) * 4;
                        suma[0] += d[o];
                        suma[1] += d[o + 1];
                        suma[2] += d[o + 2];
                        n++;
                    }
                }

                if (n > 0) {
                    integrada = suma.map((s) => Math.round(s / n));
                }
            }
        }

        return { ...p, pixel: mediana, integrada };
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
/**
 * ⚠️ Y UNA CUARTA VISTA QUE NO ES UNA VISTA: EL CUADRANTE DE LA MATRIZ.
 *
 * En la demo hay TRES barras con anillo (Marco con un aviso, Sara con un incumplimiento, Tomás
 * con un imposible) sobre doce colores de paleta. O sea: la comprobación de la ley 0 se estaba
 * haciendo sobre las parejas (color, gravedad) que la demo enseña POR CASUALIDAD — nueve de cada
 * doce colores no se probaban con ningún anillo.
 *
 * Y se notó: al reintroducir la paleta de croma bajo (la del ciruela que se volvía marrón), el
 * instrumento la dejó PASAR. No porque el color fuera bueno, sino porque al ciruela le tocó una
 * persona sin gravedad. Cobertura por suerte no es cobertura.
 *
 * El cuadrante de MatrizSeeder tiene 96 casos con todas las gravedades y todos los colores. Ahí
 * las combinaciones se pintan DE VERDAD, y ahí se mide. No entra en la comparación de identidad
 * —96 personas para 12 colores, los colores se repiten a propósito— y por eso lleva bandera.
 */
const matriz = JSON.parse(readFileSync(new URL('./matriz.json', import.meta.url), 'utf8'));

const vistas = [
    { clave: 'semana', nombre: 'SEMANA (con gente)', portador: 'barra', url: `/companies/1/calendars/1/schedule?week=${lunesDe(0)}` },
    { clave: 'dia', nombre: 'DÍA (lunes)', portador: 'avatar', url: `/companies/1/calendars/1/schedule/day?day=${lunesDe(0)}` },
    { clave: 'vacia', nombre: 'SEMANA VACÍA (sin un solo turno)', portador: 'barra', url: `/companies/1/calendars/1/schedule?week=${lunesDe(2)}` },
    { clave: 'matriz', nombre: 'CUADRANTE DE LA MATRIZ (96 casos)', portador: 'barra', soloLey0: true, url: matriz.bloques.url },
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

const SUENA = 20;   // por debajo, un color de persona SOLO ya suena a un estado

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
const declaradoDe = (p) => (p.declarado.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

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
const conRelleno = (p) => {
    const n = (p.declarado?.match(/[\d.]+/g) ?? []).map(Number);

    return n.length >= 3 && !(n.length > 3 && n[3] === 0);
};

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
