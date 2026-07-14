/**
 * ⚠️ LA PALETA SE PROTEGÍA DE LAS TRES GRAVEDADES. Y HAY MÁS COLORES QUE SIGNIFICAN COSAS.
 *
 * El exceso de cobertura («+1») se pinta con `--color-brand-300` / `--color-brand-600`: **LA MARCA**.
 * Un índigo. Y la paleta de personas TIENE índigos, porque la zona fría es lo único que le queda
 * libre una vez que el rojo, el naranja, el ámbar y el verde están reservados al estado.
 *
 * O sea que la paleta se estuvo midiendo contra una lista de colores semánticos INCOMPLETA, y el
 * agujero es entero: nadie ha comprobado nunca que el azul de una persona no suene al índigo del
 * exceso — que aparece **justo debajo de su barra**, en la tira de cobertura.
 *
 * Esto lista TODOS los colores que significan algo en la parrilla, y mide cada color de persona
 * contra cada uno.
 *
 *   node tests/Visual/semanticos.mjs
 */
import { deltaE00 } from './pixel.mjs';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Los doce colores de PersonPalette. */
const PERSONAS = {
    1: '#2490B4', 2: '#085C88', 3: '#54588C', 4: '#7C7CB0',
    5: '#C484FC', 6: '#A830A4', 7: '#44BCFC', 8: '#789CFC',
    9: '#4068E8', 10: '#905CDC', 11: '#64249C', 12: '#F45CC8',
};

/**
 * ⚠️ TODO LO QUE SIGNIFICA ALGO. Y la columna «dónde» importa: un color semántico que NUNCA
 * aparece cerca de una barra es menos peligroso que uno que se pinta DEBAJO de ella.
 */
const SEMANTICOS = {
    // — Las tres gravedades (lo único contra lo que se medía) —
    'rojo · imposible (anillo)': ['#C81E1E', 'pegado a la barra'],
    'tinta de imposible': ['#B01414', 'nota, bajo la barra'],
    'naranja · incumplimiento (anillo)': ['#E8590C', 'pegado a la barra'],
    'tinta de incumplimiento': ['#A8410A', 'nota, bajo la barra'],
    'ámbar · aviso (anillo)': ['#C2870A', 'pegado a la barra'],
    'tinta de aviso': ['#7D5606', 'nota, bajo la barra'],

    // — LA COBERTURA. CUATRO ESTADOS, Y SOLO UNO ESTABA EN LA LISTA —
    'verde · cubierto (borde)': ['#15803D', 'tira, BAJO la barra'],
    'verde · cubierto (relleno)': ['#C3E6D1', 'tira, BAJO la barra'],
    'rojo · falta gente (borde)': ['#DC2626', 'tira, BAJO la barra'],
    'rojo · falta gente (relleno)': ['#F7C9C9', 'tira, BAJO la barra'],
    'ámbar · sobra gente (relleno)': ['#EFE0C0', 'tira, BAJO la barra'],
    'ámbar · sobra gente (borde)': ['#C2870A', 'tira, BAJO la barra'],
    'ámbar · sobra gente (cifra)': ['#7D5606', 'tira, BAJO la barra'],
    '⚠ GRIS · no se pide a nadie': ['#EFEEF4', 'tira, BAJO la barra'],
    '⚠ GRIS · no se pide (borde)': ['#C9C6D6', 'tira, BAJO la barra'],

    // — La estructura. No «significa» un estado, pero un color de persona que se confunda con el
    //   fondo DESAPARECE, que es peor que confundirse. —
    '⚠ fondo hundido (la pista)': ['#E7E5F0', 'DETRÁS de la barra'],
    '⚠ fondo de celda alterna': ['#F7F6FC', 'detrás de todo'],
    '⚠ línea de sección': ['#C3BFD6', 'entre bloques'],
};

const UMBRAL = 20;

/**
 * ⚠️ LA MARCA NO ES UN ESTADO, Y POR ESO NO SE MIDE CON EL MISMO RASERO.
 *
 * El umbral de 20 contesta a «¿puede esta barra confundirse con un ESTADO del cuadrante?». La marca
 * (los índigos de los botones y la cabecera) no dice nada del cuadrante: no aparece en la parrilla
 * diciendo qué le pasa a nadie. Y exigirle 20 —o 24, en el generador— **hunde la paleta**: se come
 * el 84 % de la zona fría y las doce personas caen a ΔE 2,5 unas de otras (`node techo.mjs`).
 *
 * Lo único que hay que impedir es que una persona sea **prácticamente el mismo color** que la marca.
 */
const MARCA = { 'marca · brand-300': '#7F77DD', 'marca · brand-600': '#534AB7', 'marca · brand-800': '#3C3489' };
const UMBRAL_MARCA = 8;

console.log('\nCADA COLOR DE PERSONA CONTRA CADA COLOR QUE SIGNIFICA ALGO');
console.log('═'.repeat(112));
console.log('(ΔE00 sobre el color plano. Umbral: 20. Por debajo, el ojo los emparenta.)\n');

const choques = [];

for (const [nombre, [h, donde]] of Object.entries(SEMANTICOS)) {
    const dists = Object.entries(PERSONAS)
        .map(([id, p]) => ({ id, p, d: deltaE00(hex(p), hex(h)) }))
        .sort((a, b) => a.d - b.d);

    const peor = dists[0];
    const mal = peor.d < UMBRAL;

    if (mal) {
        choques.push({ nombre, h, donde, ...peor });
    }

    console.log(
        `  ${mal ? '❌' : '✅'} ${nombre.padEnd(36)} ${h}  ${String(peor.d.toFixed(1)).padStart(5)}  ← persona ${peor.id} (${peor.p})   ${donde}`,
    );
}

console.log();
console.log(`LA MARCA (no es un estado: umbral ${UMBRAL_MARCA}, «prácticamente el mismo color»)`);
console.log('─'.repeat(112));

for (const [nombre, h] of Object.entries(MARCA)) {
    const peor = Object.entries(PERSONAS)
        .map(([id, p]) => ({ id, p, d: deltaE00(hex(p), hex(h)) }))
        .sort((a, b) => a.d - b.d)[0];

    const mal = peor.d < UMBRAL_MARCA;

    if (mal) {
        choques.push({ nombre, h, donde: 'botones y cabecera', ...peor });
    }

    console.log(`  ${mal ? '❌' : '✅'} ${nombre.padEnd(36)} ${h}  ${String(peor.d.toFixed(1)).padStart(5)}  ← persona ${peor.id} (${peor.p})`);
}

console.log('\n' + '═'.repeat(112));

if (! choques.length) {
    console.log('✅ Ningún color de persona suena a ningún color semántico, ni es el color de la marca.\n');
    process.exit(0);
}

console.log(`❌ ${choques.length} COLORES SEMÁNTICOS TIENEN UNA PERSONA A MENOS DE ΔE ${UMBRAL}:\n`);

for (const c of choques) {
    console.log(`   · ${c.nombre} (${c.h}) está a ΔE ${c.d.toFixed(1)} de la persona ${c.id} (${c.p})`);
    console.log(`     y se pinta ${c.donde}`);
}

console.log('\n   LA PALETA HAY QUE REGENERARLA CON **TODOS** ESTOS EN LA EXCLUSIÓN.\n');
process.exitCode = 1;
