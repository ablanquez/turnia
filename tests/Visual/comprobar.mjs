/**
 * LAS TRES PREGUNTAS, AUTOMATIZADAS.
 *
 * ⚠️ ESTE FICHERO EXISTE PORQUE MEDIR EL DATO ME ENGAÑÓ DOS VECES.
 *
 * Dije "27 tramos verdes" mirando un array de PHP. En la pantalla no había ni uno: el verde
 * se pintaba a un 18 % de opacidad sobre gris y el color que salía era #DDE6DE — un gris.
 * El dato estaba y el píxel no.
 *
 * Así que estas comprobaciones NO miran props ni JSON. Le preguntan al NAVEGADOR qué color
 * ha calculado de verdad, con qué anchura y en qué sitio.
 *
 *   1. ¿Hay VERDE de verdad en la pantalla?
 *   2. ¿PESA MÁS el borde que separa puestos que el que separa columnas?
 *   3. ¿Se distingue el panel de la parrilla?
 *   4. ¿Se queda quieta la columna de puestos al desplazarse?
 *   5. ¿Cabe en un portátil de 1366 px sin desbordar la página?
 *
 *   node tests/Visual/comprobar.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://turnia.test';
const lunes = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
})();

const rgb = (s) => (s.match(/\d+/g) ?? []).map(Number);
const esVerde = ([r, g, b]) => g > r + 20 && g > b + 10;

const browser = await chromium.launch();

// 1366 px: un portátil normal. NO una pantalla de 2.640.
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'demo@turnia.test');
await page.fill('input[type=password]', 'turnia');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 20000 });

await page.goto(`${BASE}/companies/1/calendars/1/schedule?week=${lunes}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const medida = await page.evaluate(() => {
    const css = (el, p) => getComputedStyle(el)[p];

    const tramos = [...document.querySelectorAll('div')]
        .filter((e) => css(e, 'borderTopWidth') === '2px' && e.getBoundingClientRect().height < 20)
        .map((e) => css(e, 'backgroundColor'));

    const raíl = document.querySelector('.rail-sticky');
    const celda = [...document.querySelectorAll('div')].find((e) => e.className.includes?.('border-line'));
    const panel = document.querySelector('aside');
    const tarjeta = document.querySelector('.bg-card');

    return {
        rellenos: tramos,
        bordeSeccion: raíl ? parseFloat(css(raíl, 'borderRightWidth')) : 0,
        bordeCelda: celda ? parseFloat(css(celda, 'borderRightWidth')) : 0,
        fondoPanel: panel ? css(panel, 'backgroundColor') : null,
        fondoParrilla: tarjeta ? css(tarjeta, 'backgroundColor') : null,
        bordePanel: panel ? parseFloat(css(panel, 'borderLeftWidth')) : 0,
        railPegajoso: raíl ? css(raíl, 'position') : null,
        desborda: document.documentElement.scrollWidth > window.innerWidth,
    };
});

/*
 * El raíl, al desplazarse de verdad.
 *
 * ⚠️ Con el panel RECOGIDO la semana cabe entera y NO HAY SCROLL: preguntar aquí por el raíl
 * fijo no prueba nada. Hay que abrir el panel —que es cuando la parrilla sí se queda sin
 * sitio— y desplazarse hasta el domingo.
 */
const railVisibleTrasDesplazar = await page.evaluate(async () => {
    document.querySelector('aside button').click();
    await new Promise((r) => setTimeout(r, 300));

    const scroller = [...document.querySelectorAll('div')].find((e) => e.scrollWidth > e.clientWidth + 50);

    if (!scroller) {
        return false;
    }

    scroller.scrollLeft = scroller.scrollWidth;
    await new Promise((r) => setTimeout(r, 150));

    const raíl = document.querySelector('.rail-sticky');
    const sigueAhi = raíl.getBoundingClientRect().left < 200;

    document.querySelector('aside button').click();
    await new Promise((r) => setTimeout(r, 300));

    return sigueAhi;
});

/*
 * ── LA SEMANA, EL ALTO Y LOS SCROLLS ─────────────────────────────────────────────────
 *
 * Con el panel RECOGIDO (que es como arranca), la semana entera tiene que caber a 1366 px:
 * el sábado y el domingo son el pico de carga de un bar, y esconderlos detrás de un scroll
 * es esconder justo lo que más importa.
 *
 * Y la altura la manda LA PARRILLA. Estaba al revés: el panel (diez personas) estiraba el
 * contenedor y la parrilla —cinco puestos— flotaba sobre un vacío blanco enorme.
 */
const layout = await page.evaluate(() => {
    const scroller = [...document.querySelectorAll('div')]
        .find((e) => e.className.includes?.('max-h-full') && e.className.includes('overflow-auto'));
    const rejilla = scroller?.firstElementChild;
    const panel = document.querySelector('aside');
    const tarjeta = scroller?.getBoundingClientRect();

    return {
        cabeLaSemana: rejilla ? rejilla.scrollWidth <= scroller.clientWidth + 1 : false,
        faltan: rejilla ? Math.max(0, Math.round(rejilla.scrollWidth - scroller.clientWidth)) : -1,
        anchoPanelRecogido: panel ? Math.round(panel.getBoundingClientRect().width) : -1,
        // El alto de la tarjeta lo dan las filas, no el panel.
        altoParrilla: tarjeta ? Math.round(tarjeta.height) : 0,
        altoPanel: panel ? Math.round(panel.getBoundingClientRect().height) : 0,
        panelScrollaSolo: panel ? getComputedStyle(panel).overflowY : null,
    };
});

/*
 * Se despliega, se mide ABIERTO y se vuelve a recoger.
 *
 * ⚠️ La primera versión de esta comprobación le preguntaba al panel RECOGIDO si tenía scroll
 * vertical. Un raíl de 40 px nunca lo tiene, claro. Preguntar a la cosa equivocada da una
 * respuesta correcta a una pregunta que no era la que había que hacer.
 */
const abre = await page.evaluate(async () => {
    document.querySelector('aside button').click();
    await new Promise((r) => setTimeout(r, 300));

    const panel = document.querySelector('aside');
    const caja = panel.getBoundingClientRect();

    const abierto = {
        ancho: Math.round(caja.width),
        alto: Math.round(caja.height),
        abajo: Math.round(caja.bottom),
        ventana: window.innerHeight,
        // EL PANEL LLEGA HASTA ABAJO DEL TODO, tenga dos personas o tenga cincuenta. El
        // número de personas no decide nada sobre el alto: el panel es un CONTENEDOR y la
        // lista es su CONTENIDO.
        llegaAbajo: Math.abs(caja.bottom - window.innerHeight) <= 2,
        overflowY: getComputedStyle(panel).overflowY,
        // Y si la lista no cabe, scrollea POR DENTRO, sin arrastrar a la página.
        scrolleaPorDentro: panel.scrollHeight > panel.clientHeight + 1,
        paginaDesborda: document.documentElement.scrollHeight > window.innerHeight,
    };

    panel.querySelector('button').click();
    await new Promise((r) => setTimeout(r, 300));

    return {
        ...abierto,
        vuelveARecogerse: Math.round(document.querySelector('aside').getBoundingClientRect().width) < 60,
    };
});

/*
 * ── LAS DOS BARRAS: QUE SE VEA, NO QUE SE LEA ───────────────────────────────────────
 *
 * En el zoom Día el solape de Tomás se VE (dos barras pisándose). En la Semana caían en la
 * misma pista de 8 px, se solapaban píxel a píxel y se leían como UNA barra larga: el
 * imposible había que creérselo leyendo el texto.
 *
 * Esta comprobación NO lee el rótulo. Cuenta las BARRAS y mira su GEOMETRÍA:
 *   · Tomás (imposible): dos barras que se pisan en el eje X y están en alturas distintas
 *   · Lucía (partida):   dos barras que NO se pisan y dejan un hueco físico entre ellas
 */
const barras = await page.evaluate(() => {
    const deLaPersona = (nombre) => {
        const carril = [...document.querySelectorAll('div[title]')]
            .find((d) => d.title.startsWith(nombre));

        if (!carril) {
            return null;
        }

        const pista = [...carril.children].find((e) => e.className.includes('bg-sunken'));
        const barras = [...pista.children].map((b) => {
            const r = b.getBoundingClientRect();

            return { x1: r.left, x2: r.right, y: Math.round(r.top - pista.getBoundingClientRect().top) };
        });

        return { cuantas: barras.length, barras, altoPista: Math.round(pista.getBoundingClientRect().height) };
    };

    const pisan = (b) => b.length === 2 && b[0].x2 > b[1].x1 + 1;
    const conHueco = (b) => b.length === 2 && b[1].x1 > b[0].x2 + 1;

    const tomas = deLaPersona('Tomás Vega');
    const lucia = deLaPersona('Lucía Díaz');

    return {
        tomas: tomas && {
            dosBarras: tomas.cuantas === 2,
            sePisan: pisan(tomas.barras),
            enAlturasDistintas: tomas.cuantas === 2 && tomas.barras[0].y !== tomas.barras[1].y,
            altoPista: tomas.altoPista,
        },
        lucia: lucia && {
            dosBarras: lucia.cuantas === 2,
            conHuecoFisico: conHueco(lucia.barras),
            enLaMismaAltura: lucia.cuantas === 2 && lucia.barras[0].y === lucia.barras[1].y,
        },
    };
});

const verdes = medida.rellenos.filter((c) => esVerde(rgb(c))).length;

const pruebas = [
    ['¿El SOLAPE se ve como DOS BARRAS pisándose (Semana)?',
        !!barras.tomas?.dosBarras && barras.tomas.sePisan && barras.tomas.enAlturasDistintas,
        barras.tomas
            ? `${barras.tomas.dosBarras ? 2 : '?'} barras · se pisan: ${barras.tomas.sePisan} · apiladas: ${barras.tomas.enAlturasDistintas}`
            : 'no encontrado'],

    ['¿La JORNADA PARTIDA se ve como dos barras con hueco (Semana)?',
        !!barras.lucia?.dosBarras && barras.lucia.conHuecoFisico && barras.lucia.enLaMismaAltura,
        barras.lucia
            ? `hueco físico: ${barras.lucia.conHuecoFisico} · misma línea: ${barras.lucia.enLaMismaAltura}`
            : 'no encontrado'],

    ['¿Cabe la SEMANA ENTERA con el panel recogido?', layout.cabeLaSemana,
        layout.cabeLaSemana ? 'cabe, sin scroll' : `faltan ${layout.faltan}px`],
    ['¿El panel arranca RECOGIDO?', layout.anchoPanelRecogido < 60, `${layout.anchoPanelRecogido}px`],
    ['¿Se despliega y se vuelve a recoger?', abre.ancho > 200 && abre.vuelveARecogerse,
        `abierto ${abre.ancho}px · vuelve a recogerse: ${abre.vuelveARecogerse}`],
    ['¿El panel LLEGA HASTA ABAJO de la ventana?', abre.llegaAbajo,
        `borde inferior del panel: ${abre.abajo}px · ventana: ${abre.ventana}px`],
    ['¿El panel scrollea POR DENTRO, sin arrastrar la página?', abre.scrolleaPorDentro && !abre.paginaDesborda,
        `overflow-y: ${abre.overflowY} · scroll interno: ${abre.scrolleaPorDentro} · página desborda: ${abre.paginaDesborda}`],

    ['¿HAY VERDE de verdad en la pantalla?', verdes > 0, `${verdes} tramos verdes`],
    ['¿El borde de SECCIÓN pesa más que el de columna?', medida.bordeSeccion > medida.bordeCelda,
        `sección ${medida.bordeSeccion}px vs columna ${medida.bordeCelda}px`],
    ['¿Se distingue el panel de la parrilla?', medida.fondoPanel !== medida.fondoParrilla && medida.bordePanel >= 2,
        `panel ${medida.fondoPanel} · parrilla ${medida.fondoParrilla} · borde ${medida.bordePanel}px`],
    ['¿Se queda la columna de puestos al desplazarse?', railVisibleTrasDesplazar, medida.railPegajoso],
    ['¿Cabe en 1366px sin desbordar la página?', !medida.desborda, medida.desborda ? 'DESBORDA' : 'cabe'],
];

/*
 * LA VENTANA MANDA. Se achica el navegador y todo tiene que seguir en su sitio: el panel se
 * encoge con ella (y su scroll interno se activa antes), y la parrilla hace el suyo. Ninguno
 * de los dos puede desbordar la página.
 */
await page.setViewportSize({ width: 1366, height: 560 });
await page.waitForTimeout(500);

const achicada = await page.evaluate(async () => {
    const boton = document.querySelector('aside button');

    if (Math.round(document.querySelector('aside').getBoundingClientRect().width) < 60) {
        boton.click();
        await new Promise((r) => setTimeout(r, 300));
    }

    const panel = document.querySelector('aside');
    const caja = panel.getBoundingClientRect();
    const parrilla = [...document.querySelectorAll('div')]
        .find((e) => e.className.includes?.('max-h-full') && e.className.includes('overflow-auto'));

    return {
        panelLlegaAbajo: Math.abs(caja.bottom - window.innerHeight) <= 2,
        panelScrollea: panel.scrollHeight > panel.clientHeight + 1,
        parrillaScrollea: parrilla.scrollHeight > parrilla.clientHeight + 1,
        paginaDesborda: document.documentElement.scrollHeight > window.innerHeight + 1,
    };
});

pruebas.push(
    ['Con la ventana ACHICADA (560px de alto): ¿el panel llega abajo y scrollea?',
        achicada.panelLlegaAbajo && achicada.panelScrollea,
        `llega abajo: ${achicada.panelLlegaAbajo} · scroll interno: ${achicada.panelScrollea}`],
    ['Con la ventana ACHICADA: ¿la parrilla hace SU scroll y no desborda la página?',
        achicada.parrillaScrollea && !achicada.paginaDesborda,
        `parrilla scrollea: ${achicada.parrillaScrollea} · página desborda: ${achicada.paginaDesborda}`],
);

let falla = false;

for (const [pregunta, ok, detalle] of pruebas) {
    console.log(`${ok ? '✅' : '❌'} ${pregunta}  → ${detalle}`);
    if (!ok) {
        falla = true;
    }
}

await browser.close();
process.exit(falla ? 1 : 0);
