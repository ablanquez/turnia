/**
 * ¿CUÁNTO ESPACIO LE QUITA CADA EXCLUSIÓN A LA PALETA?
 *
 * Meter los diecisiete colores semánticos con el mismo umbral que las gravedades hunde la paleta:
 * 328 candidatos y ΔE 2,5 entre personas (doce cianes iguales). Así que **no todos pesan lo mismo**,
 * y decidir a ojo cuál relajar sería hacer trampa.
 *
 * Esto mide, uno a uno, cuánto cuesta cada exclusión. Y así la decisión se toma sobre números.
 *
 *   node tests/Visual/techo.mjs
 */
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lab = ([r, g, b]) => {
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
    const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const dE = (c1, c2) => {
    const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2);
    const rad = Math.PI / 180, deg = 180 / Math.PI;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
    const A1 = (1 + G) * a1, A2 = (1 + G) * a2;
    const Cp1 = Math.hypot(A1, b1), Cp2 = Math.hypot(A2, b2);
    const h1 = (Math.atan2(b1, A1) * deg + 360) % 360, h2 = (Math.atan2(b2, A2) * deg + 360) % 360;
    const dL = L2 - L1, dC = Cp2 - Cp1;
    let dh = 0;
    if (Cp1 * Cp2 !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
    const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh / 2 * rad);
    const Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
    let hb = h1 + h2;
    if (Cp1 * Cp2 !== 0) { if (Math.abs(h1 - h2) > 180) hb += h1 + h2 < 360 ? 360 : -360; hb /= 2; } else hb = h1 + h2;
    const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad)
        + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.20 * Math.cos((4 * hb - 63) * rad);
    const SL = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2);
    const SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T;
    const RT = -2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7))
        * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
    return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** La zona fría, tal como la genera paleta.mjs. */
const CAND = [];
for (let r = 8; r <= 248; r += 4)
    for (let g = 8; g <= 248; g += 4)
        for (let b = 40; b <= 252; b += 4) {
            const [L, A, B] = lab([r, g, b]);
            const C = Math.hypot(A, B);
            let h = Math.atan2(B, A) * 180 / Math.PI; if (h < 0) h += 360;
            if (L < 40 || L > 78 || C < 30 || h < 186 || h > 350) continue;
            CAND.push([r, g, b]);
        }

/** La trama: la sombra del propio color, 25 % del área. Es lo que mueve el relleno. */
const tramada = (c) => { const [L, A, B] = lab(c); const s = [L - 22, A, B]; return c.map((v, i) => v * 0.75 + Math.max(0, Math.min(255, [c[0], c[1], c[2]][i] * 0.62)) * 0.25); };

const GRUPOS = {
    'la TIRA de cobertura (a 2 px de la barra)': [
        ['verde · cubierto', '#15803D'], ['verde · cubierto (relleno)', '#C3E6D1'],
        ['rojo · falta', '#DC2626'], ['rojo · falta (relleno)', '#F7C9C9'],
        ['ámbar · sobra (relleno, NUEVO)', '#EFE0C0'],
        ['gris · no se pide', '#EFEEF4'], ['gris · no se pide (borde)', '#C9C6D6'],
        ['gris · sin candidato (rayado)', '#D7D4E2'],
    ],
    'LA MARCA (índigo)': [
        ['brand-300', '#7F77DD'], ['brand-600', '#534AB7'], ['brand-800', '#3C3489'],
    ],
    'la ESTRUCTURA (fondos y líneas)': [
        ['pista (fondo hundido)', '#E7E5F0'], ['celda alterna', '#F7F6FC'], ['línea de sección', '#C3BFD6'],
    ],
};

const cuantos = (colores, umbral) => CAND.filter(
    (c) => colores.every(([, h]) => Math.min(dE(c, hex(h)), dE(tramada(c), hex(h))) >= umbral),
).length;

console.log(`\nLa zona fría tiene ${CAND.length} candidatos ANTES de excluir nada.`);
console.log('(La paleta actual sale de aquí, tras exigir ΔE 24 contra las gravedades ajenas.)\n');
console.log('CUÁNTOS SOBREVIVEN A CADA EXCLUSIÓN, POR UMBRAL:');
console.log('─'.repeat(96));
console.log('  ' + 'GRUPO'.padEnd(46) + ['ΔE 12', 'ΔE 16', 'ΔE 20', 'ΔE 24'].map((s) => s.padStart(9)).join(''));
console.log('─'.repeat(96));

for (const [nombre, colores] of Object.entries(GRUPOS)) {
    const fila = [12, 16, 20, 24].map((u) => String(cuantos(colores, u)).padStart(9)).join('');
    console.log(`  ${nombre.padEnd(46)}${fila}`);
}

console.log('─'.repeat(96));
const todos = Object.values(GRUPOS).flat();
console.log('  ' + 'LOS TRES A LA VEZ'.padEnd(46) + [12, 16, 20, 24].map((u) => String(cuantos(todos, u)).padStart(9)).join(''));
console.log();

// Y el detalle: qué color concreto es el que estrangula.
console.log('EL COLOR QUE MÁS CANDIDATOS SE COME (a ΔE 24, uno a uno):');
console.log('─'.repeat(96));
const solos = todos
    .map(([n, h]) => ({ n, h, quedan: cuantos([[n, h]], 24) }))
    .sort((a, b) => a.quedan - b.quedan);

for (const s of solos) {
    const pct = Math.round(100 * s.quedan / CAND.length);
    console.log(`  ${s.n.padEnd(36)} ${s.h}   quedan ${String(s.quedan).padStart(5)} de ${CAND.length}  (${String(pct).padStart(3)} %)  ${'█'.repeat(Math.round(pct / 3))}`);
}
console.log();
