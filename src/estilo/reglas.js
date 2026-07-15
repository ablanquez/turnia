/*
 * LAS LEYES DEL COLOR — y la aritmética para comprobarlas, en un solo sitio.
 *
 * Heredadas del Turnia viejo (MATRIZ-VISUAL.md / PersonPalette.php), reescritas limpio. Las usan
 * los DOS que miden: el tablero /estilo (en el navegador) y contraste.check.mjs (en Node). Ninguno
 * guarda una copia de los colores: los leen de la fuente (tokens.css / paleta.js / la página).
 *
 *   · DOS umbrales, DOS preguntas:
 *       ESTADOS (gravedades + cobertura) → ΔE 24  «¿se confunde con algo que el cuadrante AFIRMA?»
 *       MARCA + FONDOS (composición)     → ΔE 8   no afirman nada; solo «no ser el mismo color»
 *     (A ΔE 24 la marca sola se comería el 84 % del espacio de color: por eso pesa distinto.)
 *   · R < D/2 : ni pintándose como se pinte, una barra invade a otra persona.
 *       D = ΔE mínimo entre dos personas.   R = lo más que una barra se aleja de su propio color.
 *   · Croma ≥ 30 : por debajo, un color no tiene identidad y adopta la del vecino.
 */

export const UMBRAL_ESTADO = 24;
export const UMBRAL_MARCA = 8;
export const CROMA_MIN = 30;

/* ── Color: sRGB → Lab (D65) ─────────────────────────────────────────────── */

export function hexARgb(hex) {
    const h = hex.trim().replace('#', '');
    const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}

function aLineal(c) {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

const BLANCO = [0.95047, 1, 1.08883];

function rgbAXyz([r, g, b]) {
    const R = aLineal(r), G = aLineal(g), B = aLineal(b);
    return [
        R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
        R * 0.2126729 + G * 0.7151522 + B * 0.0721750,
        R * 0.0193339 + G * 0.1191920 + B * 0.9503041,
    ];
}

function f(t) {
    return t > 0.008856451679 ? Math.cbrt(t) : 7.787037 * t + 16 / 116;
}

export function rgbALab(rgb) {
    const [x, y, z] = rgbAXyz(rgb);
    const fx = f(x / BLANCO[0]), fy = f(y / BLANCO[1]), fz = f(z / BLANCO[2]);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Croma en Lab: la "cantidad de color". Por debajo de 30, adopta la identidad del vecino. */
export function croma(rgb) {
    const [, a, b] = rgbALab(rgb);
    return Math.hypot(a, b);
}

/* ── ΔE00 (CIEDE2000): la diferencia como la ve el ojo ───────────────────── */

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function deltaE00(rgb1, rgb2) {
    const [L1, a1, b1] = rgbALab(rgb1);
    const [L2, a2, b2] = rgbALab(rgb2);

    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
    const Cm = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));

    const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
    const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);

    const h1p = (Math.abs(a1p) + Math.abs(b1) === 0) ? 0 : (deg(Math.atan2(b1, a1p)) + 360) % 360;
    const h2p = (Math.abs(a2p) + Math.abs(b2) === 0) ? 0 : (deg(Math.atan2(b2, a2p)) + 360) % 360;

    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp = 0;
    if (C1p * C2p !== 0) {
        const diff = h2p - h1p;
        if (Math.abs(diff) <= 180) dhp = diff;
        else if (diff > 180) dhp = diff - 360;
        else dhp = diff + 360;
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

    const Lmp = (L1 + L2) / 2;
    const Cmp = (C1p + C2p) / 2;

    let hmp;
    if (C1p * C2p === 0) hmp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) hmp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) hmp = (h1p + h2p + 360) / 2;
    else hmp = (h1p + h2p - 360) / 2;

    const T = 1
        - 0.17 * Math.cos(rad(hmp - 30))
        + 0.24 * Math.cos(rad(2 * hmp))
        + 0.32 * Math.cos(rad(3 * hmp + 6))
        - 0.20 * Math.cos(rad(4 * hmp - 63));

    const dTheta = 30 * Math.exp(-(((hmp - 275) / 25) ** 2));
    const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
    const Sl = 1 + (0.015 * (Lmp - 50) ** 2) / Math.sqrt(20 + (Lmp - 50) ** 2);
    const Sc = 1 + 0.045 * Cmp;
    const Sh = 1 + 0.015 * Cmp * T;
    const Rt = -Math.sin(rad(2 * dTheta)) * Rc;

    return Math.sqrt(
        (dLp / Sl) ** 2
        + (dCp / Sc) ** 2
        + (dHp / Sh) ** 2
        + Rt * (dCp / Sc) * (dHp / Sh),
    );
}

/* ── La auditoría: ¿cumplen las cuatro familias la ley? ──────────────────── */

/**
 * @param identidad  [{ nombre, hex }]  — los colores de persona
 * @param estados    [{ nombre, hex }]  — gravedades + cobertura (umbral 24)
 * @param fondos     [{ nombre, hex }]  — marca + composición    (umbral 8)
 *
 * R es 0 en el prototipo: las barras son de RELLENO PLANO. La trama (sombra L*−22), el anillo de
 * gravedad y el alfa del zoom Día —los canales que mueven el color— aún no existen. Cuando lleguen,
 * R se medirá de verdad; hoy R < D/2 se cumple porque R = 0. No se inventa un valor.
 */
export function auditar({ identidad, estados, fondos }) {
    const rgb = (x) => hexARgb(x.hex);

    // D = ΔE mínimo entre dos personas cualesquiera.
    let D = Infinity, parD = null;
    for (let i = 0; i < identidad.length; i++) {
        for (let j = i + 1; j < identidad.length; j++) {
            const d = deltaE00(rgb(identidad[i]), rgb(identidad[j]));
            if (d < D) { D = d; parD = [identidad[i].nombre, identidad[j].nombre]; }
        }
    }

    // Cada persona contra su semántico más cercano (≥24) y su fondo/marca más cercano (≥8).
    const filas = identidad.map((p) => {
        const cercano = (lista) => lista
            .map((c) => ({ nombre: c.nombre, d: deltaE00(rgb(p), rgb(c)) }))
            .sort((a, b) => a.d - b.d)[0] ?? { nombre: '—', d: Infinity };
        return {
            persona: p.nombre,
            hex: p.hex,
            croma: croma(rgb(p)),
            aEstado: cercano(estados),
            aFondo: cercano(fondos),
        };
    });

    const choques = [];
    for (const f of filas) {
        if (f.aEstado.d < UMBRAL_ESTADO) choques.push({ persona: f.persona, contra: f.aEstado.nombre, d: f.aEstado.d, umbral: UMBRAL_ESTADO });
        if (f.aFondo.d < UMBRAL_MARCA) choques.push({ persona: f.persona, contra: f.aFondo.nombre, d: f.aFondo.d, umbral: UMBRAL_MARCA });
        if (f.croma < CROMA_MIN) choques.push({ persona: f.persona, contra: 'croma mínimo', d: f.croma, umbral: CROMA_MIN });
    }

    const R = 0; // relleno plano en el prototipo (ver arriba)

    return { D, parD, R, cumpleRD: R < D / 2, filas, choques, ok: choques.length === 0 && R < D / 2 };
}
