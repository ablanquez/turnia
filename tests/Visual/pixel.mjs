/**
 * LO QUE SABE MEDIR UN PÍXEL. EN UN SOLO SITIO, Y TODOS LOS INSTRUMENTOS LO LEEN.
 *
 * ⚠️ ESTO ESTABA DENTRO DE pixeles.mjs, Y AL LLEGAR EL BARRIDO DE RESOLUCIONES IBA A HABER DOS
 * COPIAS. Y dos copias de una regla es exactamente lo que la ley 13 prohíbe: el día que una
 * cambie, la otra seguirá dando verde sobre la versión vieja. Esta app existe para no mentir; su
 * instrumental, también.
 *
 * Aquí vive: la distancia perceptual (CIEDE2000), los colores que la app se RESERVA para el
 * estado, y cómo se localiza y se muestrea una barra en la imagen renderizada.
 */

/* ── Color: sRGB → Lab → ΔE00 (CIEDE2000). Sin dependencias, y con la fórmula entera. ── */

export const lab = ([r, g, b]) => {
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

export const deltaE00 = (c1, c2) => {
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

export const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

export const rgbDe = (css) => (css?.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/* ── Los colores que la app se RESERVA para el estado ─────────────────────────── */

/**
 * ⚠️ AGRUPADOS POR FAMILIA, Y AGRUPARLOS ES LA MITAD DEL INSTRUMENTO.
 *
 * "¿Esta barra se parece a un estado?" es la pregunta EQUIVOCADA para una barra imposible: se
 * parece a un rojo, y TIENE QUE PARECERSE. Un instrumento que la suspendiera por eso estaría
 * exigiendo que la alarma no suene.
 *
 * La pregunta buena es la que hizo el usuario con los ojos: "la barra de Marco, que tiene un
 * AVISO, ¿puede confundirse con un INCUMPLIMIENTO?".
 */
export const SEMANTICOS = {
    'rojo · imposible': { rgb: [200, 30, 30], familia: 'impossible' },
    'tinta de imposible': { rgb: [176, 20, 20], familia: 'impossible' },
    'rojo · hueco de cobertura': { rgb: [220, 38, 38], familia: 'impossible' },
    'rojo · hueco (relleno)': { rgb: [247, 201, 201], familia: 'impossible' },
    'naranja · incumplimiento': { rgb: [232, 89, 12], familia: 'breach' },
    'tinta de incumplimiento': { rgb: [168, 65, 10], familia: 'breach' },
    'ámbar · aviso': { rgb: [194, 135, 10], familia: 'notice' },
    'tinta de aviso': { rgb: [125, 86, 6], familia: 'notice' },
    // ⚠️ EL EXCESO. Era ÍNDIGO —la marca— y estaba a ΔE 2,2 de una persona: el «+1» se pintaba
    // con el color de alguien. Ahora es ámbar, y por eso vive en la familia `notice`.
    'ámbar · sobra gente (relleno)': { rgb: [239, 224, 192], familia: 'notice' },
    'verde · cobertura correcta': { rgb: [21, 128, 61], familia: 'ok' },
    'verde · cubierto (relleno)': { rgb: [195, 230, 209], familia: 'ok' },
};

/** El estado al que más suena un color, saltándose (si se pide) el de su propia familia. */
export const sueneA = (pixel, excluir = null) => Object.entries(SEMANTICOS)
    .filter(([, s]) => s.familia !== excluir)
    .map(([nombre, s]) => ({ nombre, familia: s.familia, d: deltaE00(pixel, s.rgb) }))
    .sort((a, b) => a.d - b.d)[0];

export const FAMILIA_DE_ANILLO = {
    'rgb(200, 30, 30)': 'impossible',
    'rgb(232, 89, 12)': 'breach',
    'rgb(194, 135, 10)': 'notice',
};

/**
 * NINGÚN COLOR DE PERSONA PUEDE SONAR A UN ESTADO, y ninguna barra puede quedar a menos de este
 * ΔE de una gravedad QUE NO ES LA SUYA. Absoluto, no relativo: lo que importa no es de qué se
 * aleja una barra, sino de qué se ACERCA.
 */
export const SUENA = 20;

/** ΔE por debajo del cual dos personas son INDISTINGUIBLES de un vistazo. */
export const INDISTINGUIBLE = 12;

/**
 * ΔE en el que dos personas se distinguen, pero CUESTA. Se avisa, no se suspende.
 *
 * ⚠️ Y ESTE AVISO VA A ESTAR SIEMPRE ENCENDIDO. NO ES PEREZA: ES EL TECHO.
 *
 * Medido (tests/Visual/paleta.mjs): en la zona FRÍA —sin rojo, naranja, ámbar ni verde, que están
 * reservados al estado— NO EXISTEN doce colores separados ΔE 20 unos de otros. Ni ocho: el máximo
 * para ocho es 19,6, y para doce es 16,1. O sea que "todas las parejas holgadas" es IMPOSIBLE con
 * el color como único canal, y no por falta de intentarlo.
 *
 * Por eso la identidad NUNCA cuelga solo del relleno: cada carril lleva su avatar con las
 * iniciales, su nombre escrito y una línea vertical de su color. El relleno es el canal que se lee
 * DE UN VISTAZO; no es el único que hay.
 *
 * Se deja el aviso porque es verdad. Se dice el techo para que no se lea como un descuido — un
 * aviso sin contexto se ignora, y un aviso ignorado no existe.
 */
export const CUESTA = 20;

/** El máximo ΔE mínimo alcanzable con doce colores en la zona fría. Medido, no supuesto. */
export const TECHO = 13.9;

/**
 * LA TRAMA TIENE QUE VERSE. Si la raya no se distingue del fondo, la trama no dice nada — y un
 * bloque que NO CUBRE EL PUESTO se lee como sólido, o sea como si lo cubriera. Silencio falso.
 */
export const RAYA_SE_VE = 10;

/**
 * ⚠️ Y LA TRAMA NO PUEDE CAMBIAR EL TONO. ES LA LEY 0, EN EL CANAL DE LA DENSIDAD.
 *
 * El tono es donde vive la identidad. Si la raya llega con un tono propio, el canal que contesta
 * "¿cuánto cuenta?" está contestando también "¿de quién es?" — y contestándolo mal: con la tinta
 * fija (un índigo), la raya de Iker (rosa) salía del color de BEA.
 *
 * La raya tiene que ser LA SOMBRA de su relleno: el mismo tono, otra luminosidad. Se mide el ángulo
 * de tono en Lab; 15° es el margen que deja pasar el antialiasing y no una tinta ajena (la índigo
 * sobre un teal desviaba 40–70°).
 */
export const TONO_DE_LA_RAYA = 15;

/** El ángulo de tono (LCh) de un color. Y la distancia angular entre dos, que es circular. */
export const tono = (rgb) => {
    const [, A, B] = lab(rgb);
    const h = Math.atan2(B, A) * 180 / Math.PI;

    return h < 0 ? h + 360 : h;
};

export const distanciaDeTono = (a, b) => {
    const d = Math.abs(tono(a) - tono(b)) % 360;

    return d > 180 ? 360 - d : d;
};

/* ── Localizar las piezas EN LA PÁGINA (se ejecuta dentro del navegador) ──────── */

/**
 * ⚠️ ESTA FUNCIÓN SE SERIALIZA Y SE EJECUTA EN CHROMIUM. No puede cerrar sobre nada de fuera.
 *
 * Devuelve, por cada barra y cada avatar VISIBLE: dónde muestrear el relleno, la caja entera con
 * su anillo, y lo que el CSS DECLARA (solo para poder enseñar la diferencia con lo que sale).
 */
export const localizar = () => {
    const css = (el, p) => getComputedStyle(el)[p];
    const piezas = [];

    // ⚠️ Solo lo que está DENTRO DE LA IMAGEN. Muestrear fuera devuelve negro, y un negro
    // inventado se parece muchísimo a otro negro inventado: cuatro personas salieron
    // "indistinguibles" con ΔE 0,0 porque yo estaba midiendo el vacío.
    const enLaVentana = (r) => r.width > 0 && r.height > 0
        && r.top >= 0 && r.left >= 0
        && r.bottom <= window.innerHeight && r.right <= window.innerWidth;

    /**
     * ⚠️ «DENTRO DE LA VENTANA» NO ES «SE VE». Y CONFUNDIRLOS ES LA MENTIRA NÚMERO DIECISÉIS.
     *
     * A 1280 px con el panel abierto, las barras del sábado y el domingo caen dentro de la ventana
     * según su `getBoundingClientRect()` —y es verdad, ahí están sus coordenadas— pero NO SE VEN:
     * están RECORTADAS por el `overflow-auto` de la parrilla y TAPADAS por el panel de plantilla.
     * El píxel que salía era el BLANCO DEL PANEL.
     *
     * Y como el blanco es igual al blanco, dos personas distintas daban ΔE 0,0 y el instrumento
     * cantaba «LA MATRIZ SE ROMPE». La matriz no se rompía: la página estaba perfecta. El detector
     * se había inventado el fallo — y en una resolución que yo no había mirado todavía, así que me
     * habría puesto a arreglar algo que no existe.
     *
     * `elementFromPoint` es la única pregunta honesta: «¿QUIÉN está pintado en este píxel?». Si la
     * respuesta no es esta barra, esta barra no se ve, y lo que yo mida ahí es de otro.
     */
    const seVe = (el, x, y) => {
        const arriba = document.elementFromPoint(x, y);

        if (!arriba || (arriba !== el && !el.contains(arriba))) {
            return false;
        }

        /*
         * ⚠️ Y `elementFromPoint` NO SABE DE BARRAS DE SCROLL.
         *
         * Cuando a la parrilla le faltan 8 px de ancho aparece una barra de scroll horizontal que
         * se COME los últimos 15 px de alto del contenedor — y ahí, justo ahí, estaba el avatar de
         * Bea. `elementFromPoint` decía "sí, es el avatar" porque una barra de scroll no es un
         * elemento del DOM; y la imagen decía otra cosa, porque en la imagen SÍ está pintada.
         *
         * `clientWidth` y `clientHeight` EXCLUYEN la barra de scroll. Así que la pregunta honesta
         * es si el punto cae dentro del área de cliente de TODOS sus contenedores con scroll.
         */
        for (let p = el.parentElement; p; p = p.parentElement) {
            const o = getComputedStyle(p);

            if (!/(auto|scroll)/.test(o.overflowX + o.overflowY)) {
                continue;
            }

            const r = p.getBoundingClientRect();

            if (x > r.left + p.clientWidth || y > r.top + p.clientHeight) {
                return false;
            }
        }

        return true;
    };

    /**
     * ⚠️ UN PUNTO DE LA BARRA DONDE SOLO HAYA RELLENO. NI TEXTO, NI AVATAR, NI MUESCA.
     *
     * Muestreaba el CENTRO GEOMÉTRICO. En la Semana la barra está vacía y eso vale; en el DÍA
     * lleva DENTRO el avatar, el nombre y la hora, y el centro de la barra de Bea cae justo
     * encima de la palabra "Bea Soler". Estaba midiendo LETRAS y llamándolas relleno.
     *
     * Se barre de derecha a izquierda buscando un punto que no pise a ninguno de sus hijos. Si no
     * hay ninguno, no se inventa: se declara que esa barra no tiene relleno que medir, y eso ya
     * es el hallazgo.
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

        if (!enLaVentana(r)) continue;

        /*
         * ⚠️ LAS BARRAS TRAMADAS SE MARCAN, NO SE TIRAN.
         *
         * No pueden entrar en la misma MEDIANA que las lisas (llevan la trama encima del color, y
         * mezclar dos poblaciones da un color que no es de ninguna). Pero aquí había un `continue`
         * que las borraba del fichero ENTERO, y así la barra IMPOSIBLE —que es tramada, y la que
         * lleva el anillo más gordo— no se medía en NINGUNA comprobación. Un descarte silencioso
         * es un aprobado por omisión.
         */
        const tramada = css(barra, 'backgroundImage') !== 'none';

        const borde = parseFloat(css(barra, 'borderTopWidth')) || 0;
        const punto = puntoDeRelleno(barra, r, borde);

        if (!punto) {
            piezas.push({ tipo: 'barra', persona: carril?.dataset.persona ?? barra.dataset.persona ?? '?', sinRelleno: true });
            continue;
        }

        // ⚠️ Tapada o recortada: NO se mide, y NO se calla. Se cuenta y se dice.
        if (!seVe(barra, punto.x, punto.y)) {
            piezas.push({ tipo: 'barra', persona: carril?.dataset.persona ?? barra.dataset.persona ?? '?', tapada: true });
            continue;
        }

        /*
         * EL ANILLO DE GRAVEDAD: dos franjas POR FUERA, arriba y abajo (box-shadow sin desenfoque).
         *
         * ⚠️ Y SOLO CRECE EN VERTICAL. Antes era un `outline` que rodeaba los cuatro lados, y por
         * eso su peso dependía del ancho de la barra: en un turno de una hora se comía el 67 % de
         * lo que el ojo integra. Ahora la caja crece solo a lo alto, así que el peso es constante.
         *
         * "0 -3px 0 0 rgb(232, 89, 12), 0 3px 0 0 rgb(232, 89, 12)" → grosor 3, color el primero.
         */
        const sombra = css(barra, 'boxShadow');
        const anillo = sombra === 'none' ? 0 : Math.abs(parseFloat(sombra.match(/(-?[\d.]+)px/g)?.[1] ?? 0));
        const colorAnillo = anillo ? (sombra.match(/rgba?\([^)]+\)/)?.[0] ?? null) : null;

        piezas.push({
            tipo: 'barra',
            tramada,
            // En la Semana la persona la da el carril; en el Día, la propia barra.
            persona: carril?.dataset.persona ?? barra.dataset.persona ?? '?',
            celda: celda?.dataset.celda ?? '?',
            declarado: css(barra, 'backgroundColor'),
            anillo,
            anilloDeclarado: colorAnillo,
            // ⚠️ La caja crece SOLO A LO ALTO: las franjas no rodean, así que a los lados no hay
            // nada que integrar. Meter ahí los píxeles del fondo sería inventarse la mezcla.
            caja: {
                left: r.left, top: r.top - anillo,
                right: r.right, bottom: r.bottom + anillo,
            },
            // La barra SIN el anillo: el relleno y nada más. Es donde vive la identidad.
            rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
            // Lo que hay DENTRO de la barra no es la barra: el nombre, la hora, la muesca y el filo
            // se descuentan. Promediar letras no dice a qué suena la barra: dice a qué suena la
            // tipografía, que es la misma para todo el mundo.
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
     * El avatar de Ana es un teal y el píxel del centro me daba un LAVANDA: estaba midiendo las
     * letras "AL". Se muestrea en la diagonal ABAJO-IZQUIERDA —no arriba-derecha, que es donde va
     * el punto ámbar de "también trabaja en otra empresa"—, dentro del círculo y fuera de los
     * glifos.
     */
    for (const av of document.querySelectorAll('[data-t=avatar]')) {
        const r = av.getBoundingClientRect();

        if (!enLaVentana(r)) continue;

        const ax = r.left + r.width / 2 - r.width * 0.28;
        const ay = r.top + r.height / 2 + r.height * 0.28;

        if (!seVe(av, ax, ay)) {
            piezas.push({ tipo: 'avatar', persona: av.dataset.persona ?? '?', tapada: true });
            continue;
        }

        piezas.push({
            tipo: 'avatar',
            persona: av.dataset.persona ?? '?',
            celda: av.closest('[data-celda]')?.dataset.celda ?? '?',
            declarado: css(av, 'backgroundColor'),
            x: ax,
            y: ay,
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
export const muestrear = (page, png, piezas) => page.evaluate(async ({ dataUrl, piezas }) => {
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

        /**
         * LA MEDIA DE UNA CAJA, descontando lo que hay ENCIMA de la barra (el nombre, la hora, la
         * muesca, el filo). Promediar letras no dice a qué suena la barra: dice a qué suena la
         * tipografía, que es la misma para todo el mundo.
         */
        const mediaDe = (caja) => {
            if (!caja) {
                return null;
            }

            const x0 = Math.round(caja.left * escala);
            const y0 = Math.round(caja.top * escala);
            const w = Math.round((caja.right - caja.left) * escala);
            const h = Math.round((caja.bottom - caja.top) * escala);

            if (!(w > 0 && h > 0 && x0 >= 0 && y0 >= 0 && x0 + w <= c.width && y0 + h <= c.height)) {
                return null;
            }

            const d = ctx.getImageData(x0, y0, w, h).data;
            const suma = [0, 0, 0];
            let n = 0;

            for (let py = 0; py < h; py++) {
                for (let px = 0; px < w; px++) {
                    const cx = (x0 + px) / escala;
                    const cy = (y0 + py) / escala;

                    if (p.hijos?.some((k) => cx >= k.left - 1 && cx <= k.right + 1 && cy >= k.top - 1 && cy <= k.bottom + 1)) {
                        continue;
                    }

                    const o = (py * w + px) * 4;
                    suma[0] += d[o];
                    suma[1] += d[o + 1];
                    suma[2] += d[o + 2];
                    n++;
                }
            }

            return n > 0 ? suma.map((s) => Math.round(s / n)) : null;
        };

        /*
         * LA BARRA ENTERA, CON SU ANILLO PEGADO. Es lo que el ojo integra de un vistazo, y lo
         * único que responde a "¿esta barra suena a una gravedad que no es la suya?".
         */
        const integrada = p.anillo > 0 ? mediaDe(p.caja) : null;

        /**
         * ⚠️ EL RELLENO PROMEDIADO. Y ESTO ES LA MENTIRA NÚMERO DIECIOCHO, QUE CAZÓ ESTE MISMO
         * INSTRUMENTO EN SU PRIMERA PASADA — sobre una página que estaba BIEN.
         *
         * `pixel` es la mediana de un vecindario de 3×3 en UN punto. Sobre una barra lisa eso es
         * exacto. Sobre una barra TRAMADA es basura: las rayas miden 2 px, así que el vecindario
         * entero puede caer DENTRO de una raya, y entonces lo que sale es la SOMBRA de la persona
         * y no su color. La barra tramada de Iker daba #004A6F —su sombra— y el instrumento cantó
         * «se parece más a Bea que a sí misma».
         *
         * Y la barra está perfecta. Lo que estaba mal era la pregunta: NADIE LEE UNA RAYA DE 2 px
         * COMO EL COLOR DE UNA BARRA. El ojo INTEGRA la textura — por eso una trama es una trama y
         * no doce barritas. Así que en una barra tramada, la identidad la lleva la MEDIA del
         * relleno, no un punto de él.
         *
         * ⚠️ Esto NO es aflojar el test para que pase. El test seguía siendo exigible; el
         * ESTADÍSTICO era el equivocado. La prueba de que no es una excusa: la media SIGUE
         * cazando el fallo viejo (la trama de tinta fija movía la media 5,6 con D = 13,8; ahora la
         * mueve 5,4 con D = 16,1, y la garantía R < D/2 se comprueba EN LA IMAGEN, no en el
         * modelo).
         */
        const relleno = mediaDe(p.rect);

        /**
         * ⚠️ LA TRAMA, VISTA: LA RAYA Y EL FONDO, SEPARADOS. Y ESTO NO ES UN LUJO.
         *
         * La media del relleno contesta «¿de quién es la barra?» y NO CONTESTA otras dos preguntas
         * que también tiene que contestar una trama, y que estuvieron sin medir desde el principio:
         *
         *   1. ¿LA RAYA SE VE? Si la raya y el fondo son casi el mismo color, la trama no comunica y
         *      un bloque que NO CUBRE EL PUESTO se lee como sólido — o sea, como si lo cubriera. Es
         *      un silencio falso, y con la tinta fija le pasaba a Marco: su raya quedaba a ΔE 4,4
         *      de su propio relleno. INVISIBLE.
         *
         *   2. ¿LA RAYA ES DE LA PERSONA? Con una tinta FIJA, la raya de Iker (rosa) salía #AA589F,
         *      que es el color de BEA. El canal de la DENSIDAD estaba metiendo un TONO que la
         *      identidad no había puesto. Y la media no lo caza: al promediar, el tono ajeno se
         *      diluye y la barra sigue "pareciéndose a la suya". La mentira sobrevive al promedio.
         *
         * Así que se separan por LUMINOSIDAD: el 10 % más oscuro de los píxeles del relleno es el
         * núcleo de la raya; el 40 % más claro es el fondo. Con rayas de 2 px cada 8 (25 % del
         * área) y el antialiasing comiéndose los bordes, esos dos cuantiles caen limpios.
         */
        let trama = null;

        if (p.tramada && p.rect) {
            const x0 = Math.round(p.rect.left * escala);
            const y0 = Math.round(p.rect.top * escala);
            const w = Math.round((p.rect.right - p.rect.left) * escala);
            const h = Math.round((p.rect.bottom - p.rect.top) * escala);

            if (w > 2 && h > 2 && x0 >= 0 && y0 >= 0 && x0 + w <= c.width && y0 + h <= c.height) {
                const d = ctx.getImageData(x0, y0, w, h).data;
                const px = [];

                // ⚠️ Un píxel DE DENTRO: se descuenta un anillo de 2 px de borde, o el antialiasing
                // del redondeo y el color del borde entrarían como si fueran raya.
                for (let py = 2; py < h - 2; py++) {
                    for (let pxi = 2; pxi < w - 2; pxi++) {
                        const cx = (x0 + pxi) / escala;
                        const cy = (y0 + py) / escala;

                        if (p.hijos?.some((k) => cx >= k.left - 1 && cx <= k.right + 1 && cy >= k.top - 1 && cy <= k.bottom + 1)) {
                            continue;
                        }

                        const o = (py * w + pxi) * 4;
                        px.push([d[o], d[o + 1], d[o + 2]]);
                    }
                }

                if (px.length >= 20) {
                    const luz = (q) => 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2];
                    const orden = px.slice().sort((a, b) => luz(a) - luz(b));

                    const media = (lista) => [0, 1, 2].map((i) => Math.round(lista.reduce((s, q) => s + q[i], 0) / lista.length));

                    trama = {
                        raya: media(orden.slice(0, Math.max(1, Math.round(orden.length * 0.10)))),
                        fondo: media(orden.slice(Math.round(orden.length * 0.60))),
                    };
                }
            }
        }

        return { ...p, pixel: mediana, integrada, relleno, trama };
    });
}, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, piezas });

/** Un bloque HUECO no tiene relleno: leer su `rgba(0,0,0,0)` como NEGRO es medir un color que no es de nadie. */
export const conRelleno = (p) => {
    const n = (p.declarado?.match(/[\d.]+/g) ?? []).map(Number);

    return n.length >= 3 && !(n.length > 3 && n[3] === 0);
};

/* ── Entrar ───────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ EL LOGIN TENÍA UNA CARRERA, Y SALÍA POR LA VENTANA COMO SI FUERA UN HALLAZGO.
 *
 * Con `domcontentloaded` el HTML ya está pero Vue NO HA HIDRATADO: el clic cae en un formulario
 * que aún no escucha y el instrumento se queda en /login hasta el timeout — que devuelve el mismo
 * código de salida que un fallo de verdad.
 */
export async function entrar(page, base) {
    for (let intento = 1; intento <= 3; intento++) {
        await page.goto(`${base}/login`, { waitUntil: 'load', timeout: 60000 });
        await page.fill('input[type=email]', 'demo@turnia.test');
        await page.fill('input[type=password]', 'turnia');
        await page.click('button[type=submit]');

        try {
            await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 20000 });

            return;
        } catch (e) {
            if (intento === 3) {
                throw new Error('no se pudo entrar tras tres intentos de login');
            }
        }
    }
}

export const lunesDe = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);

    return d.toISOString().slice(0, 10);
};
