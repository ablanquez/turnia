/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * CADA COLOR DE PERSONA CONTRA **CADA COLOR QUE SIGNIFICA ALGO**. Y TODOS SALEN DE LA PÁGINA.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * La paleta se protegía de las TRES GRAVEDADES. Y la TIRA DE COBERTURA —que se pinta a DOS PÍXELES
 * de las barras, justo debajo— tiene CUATRO estados propios, contra los que nadie la había medido.
 *
 * Resultado: el exceso («sobra 1») estaba pintado con la MARCA (#534AB7), que estaba a **ΔE 2,2** del
 * color de una persona. El «+1» se pintaba con el color de otra persona.
 *
 *     UN COLOR SEMÁNTICO ES CUALQUIER COLOR QUE SIGNIFIQUE ALGO. NO SOLO UNA GRAVEDAD.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * ⚠️ Y LOS COLORES SE LEEN DE **LA PÁGINA**, NO DE UNA LISTA COPIADA AQUÍ.
 * ───────────────────────────────────────────────────────────────────────────────────────
 *
 * La primera versión los tenía escritos a mano. Y la contraprueba lo destapó: al volver a pintar el
 * exceso con la marca —el bug original, reintroducido— **este instrumento siguió dando verde**,
 * porque seguía midiendo SU copia, no la aplicación.
 *
 *     UN INSTRUMENTO CON UNA COPIA DE LOS DATOS NO MIDE LA APP: MIDE SU PROPIA COPIA.
 *     Y el día que las dos se separan, el verde no significa nada.
 *
 * Ahora se abre Chromium, se leen las variables CSS y **los tramos de cobertura de verdad**, y se
 * compara contra los avatares de las personas, que también salen de la página.
 *
 *   node tests/Visual/semanticos.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { deltaE00, entrar } from './pixel.mjs';

const BASE = 'http://turnia.test';

/*
 * ⚠️ SE MIDE SOBRE LA PAGINA DE LA **TIRA** (MatrizSeeder), NO SOBRE LA DEMO. Y esto lo destapo
 * la contraprueba.
 *
 * La demo NO TIENE NINGUN EXCESO sembrado. Asi que al medir sobre ella, el tramo `excess` no existe
 * en el DOM, no se mide, y **la mutacion que vuelve a pintar el exceso con la marca ESCAPA**. El
 * instrumento daba verde por no haber mirado.
 *
 * (Y cuando lo corri la primera vez SI lo midio... porque otro instrumento habia dejado la base
 * sucia, con un turno movido. Un verde que dependia de la basura de otro.)
 *
 * MatrizSeeder existe justo para esto: contiene los CUATRO estados de la tira. Y aqui abajo se
 * EXIGEN los cuatro: si falta uno, este instrumento GRITA en vez de medir lo que haya.
 */
const M = JSON.parse(readFileSync(new URL('./matriz.json', import.meta.url), 'utf8'));

const rgb = (css) => {
    const m = css.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);

    if (m) {
        return [+m[1], +m[2], +m[3]];
    }

    const h = css.trim().replace('#', '');

    return h.length === 6 ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) : null;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

await entrar(page, BASE);
await page.goto(`${BASE}${M.tira.url}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-t=tramo]', { timeout: 90000 });
await page.waitForTimeout(1500);

/* ── LO QUE LA PÁGINA DICE DE SÍ MISMA ────────────────────────────────────────── */

const leido = await page.evaluate(() => {
    const raiz = getComputedStyle(document.documentElement);
    const v = (n) => raiz.getPropertyValue(n).trim();

    // Las personas: el AVATAR lleva su color, y sale del servidor (PersonPalette).
    const personas = {};

    for (const a of document.querySelectorAll('[data-t=avatar]')) {
        personas[a.dataset.persona] = getComputedStyle(a).backgroundColor;
    }

    /*
     * ⚠️ LOS TRAMOS DE LA TIRA, LEÍDOS DE LOS TRAMOS DE VERDAD.
     *
     * No de una tabla copiada: del DOM. Si mañana alguien vuelve a pintar el exceso con la marca,
     * este instrumento lo VE — porque está mirando el mismo píxel que el usuario.
     */
    const tira = {};

    for (const t of document.querySelectorAll('[data-t=tramo][data-estado]')) {
        const c = getComputedStyle(t);

        tira[`tira · ${t.dataset.estado} (relleno)`] = c.backgroundColor;
        tira[`tira · ${t.dataset.estado} (borde)`] = c.borderTopColor;
    }

    return {
        personas,
        tira,
        vars: {
            'imposible (anillo)': v('--color-impossible') || '#C81E1E',
            'incumplimiento (anillo)': v('--color-breach'),
            'aviso (anillo)': v('--color-notice'),
            'cubierto (borde)': v('--color-ok'),
            'falta gente (borde)': v('--color-missing'),
            'sin candidato (rayado)': v('--color-void-fill'),
            'fondo hundido (pista)': v('--color-sunken'),
            'celda alterna': v('--color-band'),
            'línea de sección': v('--color-edge'),
        },
        marca: {
            'marca · brand-300': v('--color-brand-300'),
            'marca · brand-600': v('--color-brand-600'),
            'marca · brand-800': v('--color-brand-800'),
        },
    };
});

await browser.close();

const PERSONAS = Object.fromEntries(
    Object.entries(leido.personas).map(([n, c]) => [n, rgb(c)]).filter(([, c]) => c),
);

const SEMANTICOS = Object.fromEntries(
    Object.entries({ ...leido.vars, ...leido.tira })
        .map(([n, c]) => [n, rgb(c)])
        .filter(([, c]) => c),
);

const MARCA = Object.fromEntries(
    Object.entries(leido.marca).map(([n, c]) => [n, rgb(c)]).filter(([, c]) => c),
);

/*
 * ⚠️ EL UMBRAL DE 24 CONTESTA A: «¿puede esta barra confundirse con un ESTADO del cuadrante?».
 *
 * La MARCA no es un estado: no dice nada del cuadrante, no aparece en la parrilla diciendo qué le
 * pasa a nadie. Exigirle 20 HUNDE la paleta —se come el 84 % de la zona fría y las doce personas
 * caen a ΔE 2,5 unas de otras (`node techo.mjs`)—. Lo único que hay que impedir es que una persona
 * sea PRÁCTICAMENTE el mismo color que un botón.
 *
 * Dos umbrales, dos preguntas. Y los dos elegidos sobre la tabla, no a ojo.
 */
const UMBRAL = 20;
const UMBRAL_MARCA = 8;

const di = console.log;
const choques = [];

di(`\nCADA COLOR DE PERSONA CONTRA CADA COLOR QUE SIGNIFICA ALGO`);
di('═'.repeat(104));
di(`(leídos de la página: ${Object.keys(PERSONAS).length} personas · ${Object.keys(SEMANTICOS).length} colores semánticos)\n`);

/*
 * ⚠️ SI NO HAY NADA QUE MEDIR, SE GRITA. Cero casos probados NO es cero fallos.
 *
 * Si el selector cambia y no se encuentra ni un avatar ni un tramo, este instrumento imprimiría una
 * tabla vacía y un ✅ triunfal. Ya pasó con el <span> que cegó a pixeles.mjs: 0 barras con anillo, y
 * casi lo doy por bueno.
 */
if (Object.keys(PERSONAS).length < 2 || Object.keys(SEMANTICOS).length < 5) {
    di('❌ NO HAY NADA QUE MEDIR: no se han encontrado personas o colores en la página.');
    di('   Un instrumento sin casos NO ES UN INSTRUMENTO EN VERDE: es un instrumento CIEGO.\n');
    process.exit(1);
}

/*
 * ⚠️ Y LOS CUATRO ESTADOS DE LA TIRA TIENEN QUE ESTAR. SI FALTA UNO, SE GRITA.
 *
 * El exceso ESCAPÓ de este instrumento porque en la página que estaba midiendo —la demo— **NO HABÍA
 * NINGÚN EXCESO**. No había tramo, no había color que leer, y la comprobación pasaba sin haber
 * mirado. Verde por omisión, otra vez.
 *
 *     CERO CASOS PROBADOS NO ES CERO FALLOS.
 *
 * Y la primera vez SÍ lo midió… porque otro instrumento había dejado la base sucia con un turno
 * movido. Un verde que dependía de la basura de otro es peor que un rojo.
 */
const FALTAN = ['covered', 'missing', 'excess', 'unrequested']
    .filter((e) => ! Object.keys(SEMANTICOS).some((n) => n.includes(e)));

if (FALTAN.length) {
    di(`❌ FALTAN ESTADOS DE LA TIRA EN LA PÁGINA: ${FALTAN.join(', ')}`);
    di('   No se puede comprobar un color que no está pintado. Esto NO es un aprobado:');
    di('   es que el caso NO ESTÁ SEMBRADO, y el instrumento daría verde por no mirar.\n');
    process.exit(1);
}

const contra = (nombre, color, umbral) => {
    const peor = Object.entries(PERSONAS)
        .map(([n, p]) => ({ n, p, d: deltaE00(p, color) }))
        .sort((a, b) => a.d - b.d)[0];

    const mal = peor.d < umbral;

    if (mal) {
        choques.push({ nombre, ...peor });
    }

    di(`  ${mal ? '❌' : '✅'} ${nombre.padEnd(34)} rgb(${color.join(',')})`.padEnd(66)
        + `${peor.d.toFixed(1).padStart(5)}  ← ${peor.n}`);
};

for (const [n, c] of Object.entries(SEMANTICOS)) {
    contra(n, c, UMBRAL);
}

di(`\nLA MARCA (no es un estado: umbral ${UMBRAL_MARCA}, «prácticamente el mismo color»)`);
di('─'.repeat(104));

for (const [n, c] of Object.entries(MARCA)) {
    contra(n, c, UMBRAL_MARCA);
}

di('\n' + '═'.repeat(104));

if (! choques.length) {
    di('✅ Ningún color de persona suena a ningún color semántico, ni es el color de la marca.\n');
    process.exit(0);
}

di(`❌ ${choques.length} CHOQUES:\n`);

for (const c of choques) {
    di(`   · «${c.nombre}» está a ΔE ${c.d.toFixed(1)} del color de ${c.n}`);
}

di('\n   Un color que significa algo NO PUEDE vivir en la zona de las personas.');
di('   O se cambia ese color, o SE REGENERA LA PALETA con él en la exclusión.\n');
process.exitCode = 1;
