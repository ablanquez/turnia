/**
 * EL BACKTESTING. TRECE ESCENARIOS, ABIERTOS EN UN NAVEGADOR DE VERDAD, A 1366 px.
 *
 * ⚠️ NO SE COMPRUEBA NADA EN MEMORIA. NI UN ARRAY, NI UNA PROP, NI UN JSON.
 *
 * Cada caso se SIEMBRA en la base (BacktestSeeder), se ABRE en Chromium y se le pregunta al
 * NAVEGADOR qué ha pintado: qué color ha calculado, en qué píxel está cada barra, cuántos
 * rótulos hay y si alguno se sale de su caja.
 *
 * Y es así porque medir el dato me ha engañado tres veces:
 *   · "27 tramos verdes" era cierto en el array y FALSO en la pantalla (verde al 18 % sobre
 *     gris = un gris).
 *   · El panel "salía" en una captura fullPage de 2.640 px y estaba FUERA de un navegador real.
 *   · El detector de scroll le preguntaba al panel RECOGIDO y daba verde: un raíl de 40 px
 *     nunca tiene scroll.
 *
 * MIDE EL PÍXEL RESULTANTE, NO EL DECLARADO. Los data-t solo dicen DÓNDE mirar; qué hay ahí
 * lo dice getComputedStyle y getBoundingClientRect.
 *
 *   php artisan migrate:fresh --seed
 *   php artisan db:seed --class=BacktestSeeder
 *   node tests/Visual/backtest.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = 'http://turnia.test';
const { escenarios } = JSON.parse(readFileSync('tests/Visual/escenarios.json', 'utf8'));

const rgb = (s) => (s.match(/\d+/g) ?? []).map(Number);
const esVerde = ([r, g, b]) => g > r + 20 && g > b + 10;
const esRojo = ([r, g, b]) => r > g + 40 && r > b + 40;
const esLila = ([r, g, b]) => b > r + 15 && b > g + 20;

/**
 * LA RADIOGRAFÍA. Se ejecuta DENTRO de la página y no sabe nada del escenario.
 *
 * Devuelve hechos medidos, no juicios: colores calculados, cajas en píxeles, textos tal como
 * han quedado pintados. Quién decide si eso está bien es el navegador de fuera.
 */
const radiografia = () => {
    const css = (el, p) => getComputedStyle(el)[p];
    const caja = (el) => el.getBoundingClientRect();

    const indicador = document.querySelector('[data-t=indicador]');

    const tramo = (t) => {
        const c = caja(t);

        return {
            fondo: css(t, 'backgroundColor'),
            imagen: css(t, 'backgroundImage'),
            x1: c.left,
            x2: c.right,
            ancho: c.width,
        };
    };

    const carril = (l) => {
        const pista = l.querySelector('[data-t=pista]');
        const nombre = l.querySelector('[data-t=nombre]');
        const cn = caja(nombre);

        return {
            persona: l.dataset.persona,
            pista: { x1: caja(pista).left, x2: caja(pista).right },
            barras: [...l.querySelectorAll('[data-t=barra]')].map((b) => {
                const c = caja(b);

                return {
                    x1: c.left,
                    x2: c.right,
                    y: Math.round(c.top - caja(pista).top),
                    fondo: css(b, 'backgroundColor'),
                    imagen: css(b, 'backgroundImage'),
                };
            }),
            // El texto PINTADO, no el que se pretendía pintar.
            rotulos: [...l.querySelectorAll('[data-t=rotulo]')].map((r) => r.textContent.trim()),
            nombre: {
                texto: nombre.textContent.trim(),
                // Si el texto no cabe en su caja, la caja se queda corta: eso es truncar.
                desborda: nombre.scrollWidth > nombre.clientWidth + 1,
                // Más de una línea = ha envuelto, que es lo que tiene que hacer.
                lineas: Math.round(cn.height / parseFloat(css(nombre, 'lineHeight'))),
            },
        };
    };

    // Los rótulos de la tira: NINGUNO puede salirse de su caja. Un "sin…" recortado no es
    // medio dato: es un error con aspecto de dato.
    const rotulosDeTramo = [...document.querySelectorAll('[data-t=tramo-rotulo]')].map((r) => ({
        texto: r.textContent.trim(),
        desborda: r.scrollWidth > r.clientWidth + 1,
    }));

    /*
     * ⚠️ LOS TRAMOS VAN COLGADOS DE SU CELDA, Y NO ES UN DETALLE.
     *
     * La primera versión de este instrumento buscaba "el primer tramo rojo de la página" y
     * lo comparaba con las barras del MARTES. Como el requisito era diario, el primer rojo
     * era el del LUNES: geometría correcta, celda equivocada, y un fallo inventado.
     *
     * Es el mismo error de siempre —preguntarle a la cosa equivocada— y esta vez me lo hice
     * a mí mismo dentro del propio detector.
     */
    const celdas = [...document.querySelectorAll('[data-t=celda]')].map((c) => ({
        clave: c.dataset.celda,
        tramos: [...c.querySelectorAll('[data-t=tramo]')].map(tramo),
        rotulos: [...c.querySelectorAll('[data-t=tramo-rotulo]')].map((r) => r.textContent.trim()),
        tieneTira: !!c.querySelector('[data-t=tira]'),
        imposible: !!c.querySelector('[data-t=imposible]'),
        sinCandidato: !!c.querySelector('[data-t=sin-candidato]'),
        carriles: [...c.querySelectorAll('[data-t=carril]')].map(carril),
    }));

    return {
        indicador: indicador
            ? {
                texto: indicador.textContent.trim(),
                fondo: css(indicador, 'backgroundColor'),
                color: css(indicador, 'color'),
            }
            : null,
        tramos: [...document.querySelectorAll('[data-t=tramo]')].map(tramo),
        rotulosDeTramo,
        carriles: [...document.querySelectorAll('[data-t=carril]')].map(carril),
        celdas,
        imposibles: [...document.querySelectorAll('[data-t=imposible]')].map((e) => e.textContent.trim()),
        sinCandidato: document.querySelectorAll('[data-t=sin-candidato]').length,
        catalogo: !!document.querySelector('[data-t=catalogo]'),
        paginaDesborda: document.documentElement.scrollWidth > window.innerWidth,
    };
};

// ── Lo que se espera de cada escenario ──────────────────────────────────────────────────

const verdes = (r) => r.tramos.filter((t) => esVerde(rgb(t.fondo))).length;
const rojos = (r) => r.tramos.filter((t) => esRojo(rgb(t.fondo))).length;
const rayados = (r) => r.tramos.filter((t) => t.imagen.includes('repeating-linear')).length;
const lilas = (r) => r.tramos.filter((t) => esLila(rgb(t.fondo)) && !t.imagen.includes('repeating')).length;
const indicadorVerde = (r) => esVerde(rgb(r.indicador.fondo));
const persona = (r, nombre) => r.carriles.find((c) => c.persona.startsWith(nombre));
const celda = (r, clave) => r.celdas.find((c) => c.clave === clave);

const sePisan = (a, b) => a.x2 > b.x1 + 1;
const conHueco = (a, b) => b.x1 > a.x2 + 1;

const CASOS = {
    vacia: (r) => [
        // ⚠️ EL SILENCIO FALSO. Un cuadrante sin un turno no es un cuadrante sin problemas.
        ['El indicador NO puede estar en verde', !indicadorVerde(r), `fondo ${r.indicador.fondo} · "${r.indicador.texto}"`],
        ['Y NO puede decir "Sin incidencias"', !r.indicador.texto.includes('Sin incidencias'), `"${r.indicador.texto}"`],
        ['Hay huecos ROJOS pintados en la pantalla', rojos(r) === 7, `${rojos(r)} tramos rojos`],
        ['Y no hay ni una barra colocada', r.carriles.length === 0, `${r.carriles.length} carriles`],
    ],

    'huecos-sin-violaciones': (r) => [
        ['Falta gente y el indicador lo dice', !indicadorVerde(r) && rojos(r) === 7, `${rojos(r)} rojos · fondo ${r.indicador.fondo}`],
        ['Nadie incumple nada', r.imposibles.length === 0, `${r.imposibles.length} imposibles`],
        ['Los siete turnos están pintados', r.carriles.length === 7, `${r.carriles.length} carriles`],
    ],

    perfecta: (r) => [
        // El único escenario donde el verde es la verdad.
        ['AQUÍ SÍ: el indicador está en VERDE', indicadorVerde(r), `fondo ${r.indicador.fondo} · "${r.indicador.texto}"`],
        ['Y dice "Sin incidencias"', r.indicador.texto.includes('Sin incidencias'), `"${r.indicador.texto}"`],
        ['Los siete tramos están cubiertos, en verde', verdes(r) === 7 && rojos(r) === 0, `${verdes(r)} verdes · ${rojos(r)} rojos`],
    ],

    'violaciones-sin-huecos': (r) => [
        ['No falta nadie: cero huecos', rojos(r) === 0 && verdes(r) === 7, `${rojos(r)} rojos · ${verdes(r)} verdes`],
        ['Y aun así el indicador NO se calla ni se pone verde', !indicadorVerde(r), `fondo ${r.indicador.fondo} · "${r.indicador.texto}"`],
    ],

    'imposible-con-requisito': (r) => {
        // EL MARTES, y no "el primer tramo rojo que encuentre": el requisito es diario y el
        // primer rojo de la página es el del lunes, donde no hay ningún imposible.
        const c = celda(r, 'Caja|2026-08-04');
        const t = c?.carriles[0];
        const hueco = c?.tramos.find((x) => esRojo(rgb(x.fondo)));

        return [
            ['El solape son DOS barras que se pisan, apiladas',
                t?.barras.length === 2 && sePisan(t.barras[0], t.barras[1]) && t.barras[0].y !== t.barras[1].y,
                `${t?.barras.length} barras · se pisan: ${t && sePisan(t.barras[0], t.barras[1])} · apiladas: ${t && t.barras[0].y !== t.barras[1].y}`],

            ['Y DOS rótulos, uno por barra', t?.rotulos.length === 2, `${t?.rotulos.length} rótulos: ${t?.rotulos.join(' / ')}`],

            ['El motor grita el imposible', c?.imposible === true, r.imposibles[0] ?? 'no hay badge'],

            // ⚠️ EL SILENCIO FALSO QUE ESCONDÍA EL HUECO. La celda se quedaba MUDA.
            ['LA TIRA DE COBERTURA ESTÁ AHÍ (no se esconde)', c?.tieneTira === true && c.tramos.length > 0,
                `${c?.tramos.length ?? 0} tramos en la celda del martes`],

            ['Y pinta el DÉFICIT REAL: Tomás no cuenta, así que no hay NADIE',
                !!hueco && hueco.x1 <= t.barras[0].x1 + 1 && hueco.x2 >= t.barras[1].x2 - 1,
                hueco ? `hueco rojo de ${Math.round(hueco.ancho)}px, de punta a punta de las dos barras` : 'NO HAY HUECO PINTADO'],

            ['Y el hueco dice CUÁNTOS faltan', c?.rotulos.some((x) => /\d/.test(x)), `"${c?.rotulos.join(' / ')}"`],
        ];
    },

    'imposible-sin-requisito': (r) => {
        const c = celda(r, 'Caja|2026-08-04');

        return [
            ['El imposible se grita igual', c?.imposible === true, r.imposibles[0] ?? 'no hay badge'],
            // Si nadie pide gente ahí, que Tomás no pueda estar no deja ningún hueco.
            ['Pero NO se inventa un hueco donde nadie pide gente', c?.tramos.length === 0, `${c?.tramos.length ?? 0} tramos en la celda de Caja`],
            ['Y la barra, que sí se pide, sigue en verde', verdes(r) === 7, `${verdes(r)} verdes`],
        ];
    },

    'sin-candidato-con-deficit': (r) => {
        const rayado = r.tramos.find((t) => t.imagen.includes('repeating-linear'));

        return [
            // ⚠️ ROJO **Y** RAYADO. Las rayas se ponen ENCIMA del hueco, no en su lugar: que
            // nadie pueda cubrirlo no hace que falte menos gente. Cuando el rayado sustituía
            // al rojo, el déficit del sumiller quedaba en gris sobre gris y NO SE VEÍA.
            ['El hueco incubrible lleva RAYAS', rayados(r) === 7, `${rayados(r)} rayados`],
            ['Y SIGUE SIENDO UN HUECO ROJO (las rayas no lo sustituyen)',
                !!rayado && esRojo(rgb(rayado.fondo)), `fondo ${rayado?.fondo}`],

            // ⚠️ EL DATO QUE SE RECORTABA. Ponía "sin…" y el número no aparecía en ningún sitio.
            ['El DÉFICIT sale con su número', r.rotulosDeTramo.some((x) => /\d/.test(x.texto)),
                `rótulos: ${[...new Set(r.rotulosDeTramo.map((x) => x.texto).filter(Boolean))].join(' / ')}`],
            ['Y NINGÚN rótulo se recorta', r.rotulosDeTramo.every((x) => !x.desborda && !x.texto.includes('…')),
                r.rotulosDeTramo.filter((x) => x.desborda).length + ' recortados'],

            ['El "sin candidato" se dice en la celda', r.sinCandidato === 7, `${r.sinCandidato} etiquetas`],
            ['Y en la banda de catálogo', r.catalogo, r.catalogo ? 'presente' : 'FALTA'],
        ];
    },

    'sin-candidato-sin-deficit': (r) => [
        // Se pide sumiller SOLO el lunes: los otros seis días no falta nadie, así que no se
        // pinta nada. No hay hueco donde nadie ha pedido gente.
        ['Solo el lunes hay rayado (los otros seis días no se pide)', rayados(r) === 1, `${rayados(r)} rayados`],
        ['Y una sola etiqueta de "sin candidato"', r.sinCandidato === 1, `${r.sinCandidato} etiquetas`],
        // El problema de catálogo NO desaparece: sigue estando mal configurado.
        ['La banda de catálogo sigue avisando', r.catalogo, r.catalogo ? 'presente' : 'FALTA'],
        ['Y el indicador no se pone verde', !indicadorVerde(r), `"${r.indicador.texto}"`],
    ],

    'tres-solapes': (r) => {
        const t = persona(r, 'Tomás');

        return [
            ['TRES barras', t?.barras.length === 3, `${t?.barras.length} barras`],
            ['En TRES alturas distintas', new Set(t?.barras.map((b) => b.y)).size === 3, `alturas: ${t?.barras.map((b) => b.y).join(', ')}`],
            ['Y TRES rótulos, uno por barra', t?.rotulos.length === 3, `${t?.rotulos.join(' / ')}`],
        ];
    },

    'partida-tres-bloques': (r) => {
        const l = persona(r, 'Lucía');
        const b = l?.barras ?? [];

        return [
            ['TRES barras', b.length === 3, `${b.length} barras`],
            ['En LA MISMA línea (no se pisan)', new Set(b.map((x) => x.y)).size === 1, `alturas: ${b.map((x) => x.y).join(', ')}`],
            ['Con DOS agujeros físicos entre ellas',
                b.length === 3 && conHueco(b[0], b[1]) && conHueco(b[1], b[2]),
                b.length === 3 ? `huecos de ${Math.round(b[1].x1 - b[0].x2)}px y ${Math.round(b[2].x1 - b[1].x2)}px` : '—'],
            ['Y TRES rótulos', l?.rotulos.length === 3, `${l?.rotulos.join(' / ')}`],
        ];
    },

    nocturno: (r) => {
        const d = persona(r, 'Diego');
        const b = d?.barras[0];
        const filo = b ? Math.abs(b.x2 - d.pista.x2) : 999;

        return [
            // El eje va de 06:00 a 06:00. Un turno que acaba a las 06:00 acaba EN EL FILO.
            ['El nocturno LLEGA AL FILO DERECHO del eje', filo <= 1, `le faltan ${filo.toFixed(1)}px para el borde`],
            ['Y arranca a las 22:00, no antes',
                !!b && Math.abs((b.x1 - d.pista.x1) / (d.pista.x2 - d.pista.x1) - 16 / 24) < 0.01,
                b ? `arranca en el ${(100 * (b.x1 - d.pista.x1) / (d.pista.x2 - d.pista.x1)).toFixed(1)}% (las 22:00 son el 66,7%)` : '—'],
        ];
    },

    madrugador: (r) => {
        const s = persona(r, 'Sara');
        const b = s?.barras[0];
        const filo = b ? Math.abs(b.x1 - s.pista.x1) : 999;

        return [
            // Entra a las 05:00 y el eje empieza a las 06:00: EL EJE SE ENSANCHA, no recorta.
            ['El eje SE ENSANCHA: la barra empieza en el filo izquierdo', filo <= 1, `se sale ${filo.toFixed(1)}px del borde`],
            ['Y no se recorta: dura 8 de las 25 horas del eje',
                !!b && Math.abs((b.x2 - b.x1) / (s.pista.x2 - s.pista.x1) - 8 / 25) < 0.01,
                b ? `ocupa el ${(100 * (b.x2 - b.x1) / (s.pista.x2 - s.pista.x1)).toFixed(1)}% (8 de 25 h = 32%)` : '—'],
        ];
    },

    'nombre-largo': (r) => {
        const p = r.carriles[0];

        return [
            ['El nombre entero está pintado', p?.nombre.texto === 'Maximiliano Fernández-Etxeberría del Castillo', `"${p?.nombre.texto}"`],
            ['NO se trunca: no desborda su caja', p?.nombre.desborda === false, p?.nombre.desborda ? 'DESBORDA' : 'cabe'],
            ['ENVUELVE en varias líneas', p?.nombre.lineas >= 2, `${p?.nombre.lineas} líneas`],
            ['Y la hora se lee entera', p?.rotulos[0] === '12:00–20:00', `"${p?.rotulos[0]}"`],
        ];
    },
};

// ── El paseo ────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'demo@turnia.test');
await page.fill('input[type=password]', 'turnia');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 20000 });

let falla = false;
let total = 0;

for (const escenario of escenarios) {
    await page.goto(`${BASE}${escenario.url}`, { waitUntil: 'networkidle' });

    // El informe va DIFERIDO. Hasta que llega, el indicador es un "comprobando…" sin data-t:
    // esperar a que aparezca [data-t=indicador] es esperar a que la parrilla sepa la verdad.
    await page.waitForSelector('[data-t=indicador]', { timeout: 20000 });

    const r = await page.evaluate(radiografia);
    const pruebas = CASOS[escenario.slug](r);

    // Dos reglas que valen para TODOS los escenarios, sin excepción.
    pruebas.push(
        ['Ningún rótulo de la tira se sale de su caja',
            r.rotulosDeTramo.every((x) => !x.desborda),
            `${r.rotulosDeTramo.filter((x) => x.desborda).length} desbordados`],
        ['Y la página no desborda a 1366px', !r.paginaDesborda, r.paginaDesborda ? 'DESBORDA' : 'cabe'],
    );

    console.log(`\n\x1b[1m${escenario.nombre}\x1b[0m  (${escenario.url})`);

    for (const [pregunta, ok, detalle] of pruebas) {
        console.log(`  ${ok ? '✅' : '❌'} ${pregunta}  → ${detalle}`);
        total++;
        if (!ok) {
            falla = true;
        }
    }
}

console.log(`\n${falla ? '❌' : '✅'} ${total} comprobaciones sobre ${escenarios.length} escenarios\n`);

await browser.close();
process.exit(falla ? 1 : 0);
