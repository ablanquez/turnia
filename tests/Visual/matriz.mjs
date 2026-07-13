/**
 * EL BACKTEST COMBINATORIO. TODAS LAS COMBINACIONES, NO LAS QUE SE ME OCURRAN.
 *
 * ⚠️ ESTE FICHERO NO IMPORTA useMatrizVisual. A PROPÓSITO.
 *
 * Si importara la función que decide los colores, estaría comprobando el código contra sí
 * mismo: cualquier regla mal escrita pasaría el test con las dos manos. Aquí las reglas se
 * vuelven a escribir, LEÍDAS DE docs/MATRIZ-VISUAL.md, y se comparan con lo que el navegador
 * ha pintado de verdad. Si las dos implementaciones divergen, una de las dos miente — y eso es
 * exactamente lo que hay que descubrir.
 *
 * TRES PREGUNTAS POR CADA COMBINACIÓN:
 *
 *   1. ¿CAE EN UNA REGLA?      Si no, es un AGUJERO: se apunta y se pregunta. No se inventa.
 *   2. ¿SE PINTA COMO DICE?    Se le pregunta al NAVEGADOR el color que CALCULÓ, no el declarado.
 *   3. ¿SE DISTINGUE DE TODAS LAS DEMÁS?  ← LA IMPORTANTE.
 *
 * La tercera es la que ha fallado siete veces. El gris significaba a la vez "esto está
 * cubierto" y "aquí no se pide nada" — dos cosas OPUESTAS, el mismo píxel. Cada caso estaba
 * "bien pintado" por separado y el conjunto mentía. Así que se comparan TODOS los pares.
 *
 * ⚠️ Y LA FIRMA VISUAL EXCLUYE LA IDENTIDAD DE LA PERSONA, o el test pasaría mintiendo.
 *
 * Cada caso vive con SU persona, y cada persona tiene SU color. Si el color entrara en la
 * firma, los 96 casos serían trivialmente distintos entre sí —por el color del pelo, no por lo
 * que significan— y el instrumento daría verde sin haber comprobado nada. Así que el color de
 * la persona se normaliza a "P": lo que se compara es LA GRAMÁTICA, no el vocabulario.
 *
 *   php artisan db:seed --class=MatrizSeeder
 *   node tests/Visual/matriz.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';

const BASE = 'http://turnia.test';
const M = JSON.parse(readFileSync(new URL('./matriz.json', import.meta.url), 'utf8'));

/* ══════════════════════════════════════════════════════════════════════════════
 * LAS REGLAS, REESCRITAS DESDE EL DOCUMENTO. Segunda implementación, a propósito.
 * ══════════════════════════════════════════════════════════════════════════════ */

/**
 * EL ANILLO LLEVA EL RELLENO DE LA GRAVEDAD, NO SU TINTA.
 *
 * Hay dos versiones de cada color de gravedad, y por una buena razón: el que RELLENA (vibrante,
 * para verse de un vistazo) y el que ESCRIBE (oscuro, para leerse con 4,5 de contraste). El
 * naranja de relleno #E8590C es ilegible como letra; el marrón de tinta #A8410A es invisible
 * como marca.
 *
 * Una marca no se lee: se VE. Estaba pintada con la tinta, y el aviso ámbar de Marco salía marrón
 * sucio — la ley 3 dice "ámbar = aviso" y la barra no decía ámbar. Mi propia regla, al revés.
 *
 * ⚠️ Y EL GROSOR SUBE CON LA GRAVEDAD. La misma pregunta contestada dos veces (ley 6), que es lo
 * contrario de un canal con dos preguntas (ley 0).
 */
const ANILLO = {
    impossible: { color: 'rgb(200, 30, 30)', px: 4 },     // #C81E1E
    breach: { color: 'rgb(232, 89, 12)', px: 3 },         // #E8590C
    notice: { color: 'rgb(194, 135, 10)', px: 2 },        // #C2870A
};

const RANGO = { impossible: 3, breach: 2, notice: 1 };

const peor = (sevs) => sevs.slice().sort((a, b) => RANGO[b] - RANGO[a])[0] ?? null;

const hexRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);

    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

/**
 * LEY 2 (color = quién) + LEY 3 (ANILLO = gravedad) + LEY 4 (trama = no cubre)
 * + LEY 5 (estilo del borde = qué es) + las dos marcas + LEY 14 (el cartel = pide una decisión).
 *
 * Esto es la matriz, escrita otra vez y sin mirar el código de producción.
 */
function reglaDe(caso) {
    const { kind, computa, sevs, forzado, nocturno } = caso;
    const sev = peor(sevs);

    // LEY 4: la densidad dice cuánto cuenta este bloque.
    //   sólido  → cubre el puesto
    //   tramado → NO cubre el puesto, pero cuenta tiempo
    //   hueco   → NO cubre el puesto y NO cuenta tiempo
    const densidad = kind === 'concept'
        ? (computa ? 'tramado' : 'hueco')
        : (sev === 'impossible' ? 'tramado' : 'solido');

    return {
        densidad,
        // LEY 2: el relleno lleva el color de la persona. Salvo el hueco, que no lleva relleno.
        rellenoEsDeLaPersona: densidad !== 'hueco',
        tramado: densidad === 'tramado',
        // LEY 3: la gravedad va en un ANILLO POR FUERA, y NO en el borde. Como borde se comía el
        // 40 % de una barra de 16 px y salía una MEZCLA: ámbar sobre teal daba verde de cobertura.
        anillo: sev ? ANILLO[sev] : null,
        // El borde solo dice QUÉ ES, y lo pinta con el color de la persona.
        bordeColor: 'P',
        // LEY 5: continuo = turno, discontinuo = concepto.
        bordeEstilo: kind === 'concept' ? 'dashed' : 'solid',
        // Canales propios. El forzado NO comparte el naranja del que incumple.
        muesca: !!forzado,
        filo: !!nocturno,

        /*
         * LEY 14: EL CARTEL ES PARA LO QUE PIDE UNA DECISIÓN, NO PARA LO QUE OCURRE.
         *
         *   · imposible                   → cartel rojo (siempre: no hay "forzar" un imposible)
         *   · incumplimiento SIN forzar   → cartel naranja
         *   · incumplimiento YA forzado   → NINGÚN cartel: la decisión ya se tomó, con constancia
         *   · aviso                       → nunca: informa, no pide nada
         */
        carteles: [
            ...(sevs.includes('impossible') ? ['IMPOSIBLE'] : []),
            ...(sevs.includes('breach') && !forzado ? ['INCUMPLIMIENTO'] : []),
        ],
    };
}

/**
 * LA FIRMA VISUAL DE UN CASO. Lo que se compara, par a par, contra todos los demás.
 *
 * ⚠️ SIN LA IDENTIDAD DE LA PERSONA, o el test pasaría mintiendo: cada caso vive con su
 * persona y su color, así que los 96 serían trivialmente distintos entre sí —por el color del
 * pelo, no por lo que significan—. Se normaliza a "P".
 *
 * ⚠️ Y CON LAS PALABRAS DENTRO. Esta es la corrección que el propio instrumento me obligó a
 * hacer en su primera pasada.
 *
 * Cazó 8 pares de "gemelos": un turno IMPOSIBLE+INCUMPLE pinta el mismo borde rojo que uno solo
 * IMPOSIBLE. Y eso NO es un fallo: es la LEY 7 —manda la peor gravedad en el color, y todas van
 * a las notas—. Lo que estaba mal era la firma, que solo miraba los seis canales de pintura y
 * se dejaba fuera el séptimo: el TEXTO. La ley 6 dice que ningún color va solo, o sea que las
 * palabras no son un adorno del pintado: son parte del pintado.
 *
 * Con las notas dentro, los dos casos SÍ se distinguen — y si algún día dejaran de distinguirse
 * (porque una nota se perdiera), este mismo test lo cazaría. Que es justo lo que tiene que pasar.
 */
const firmaDeRegla = (r, notas = [], carteles = []) => [
    r.rellenoEsDeLaPersona ? 'P' : 'nada',
    r.tramado ? 'trama' : 'liso',
    r.anillo ? `${r.anillo.px}px ${r.anillo.color}` : 'sin anillo',
    r.bordeEstilo,
    r.muesca ? 'muesca' : '-',
    r.filo ? 'filo' : '-',
    // Los carteles de la celda también son pintura: es donde el incumplimiento dice su motivo
    // desde que dejó de decirlo en la nota. Sin ellos, un breach y un breach+notice colapsarían.
    carteles.map((c) => c.split(' · ')[0]).sort().join('+') || 'sin cartel',
    // Las palabras, normalizadas: fuera la hora (que es igual en todos los casos) y ordenadas.
    notas.map((n) => n.replace(/\d{2}:\d{2}–\d{2}:\d{2}/g, '⏱').trim()).sort().join(' / ') || 'sin palabras',
].join(' │ ');

/* ══════════════════════════════════════════════════════════════════════════════
 * LO QUE EL NAVEGADOR PINTÓ. Se le pregunta a él, nunca al atributo.
 * ══════════════════════════════════════════════════════════════════════════════ */

const medirBloques = (celdas) => {
    const css = (el, p) => getComputedStyle(el)[p];
    const out = {};

    for (const { clave, celda, persona } of celdas) {
        const cell = document.querySelector(`[data-celda="${CSS.escape(celda)}"]`);

        if (!cell) {
            out[clave] = { error: 'la celda no existe en la página' };
            continue;
        }

        const carril = [...cell.querySelectorAll('[data-t=carril]')]
            .find((c) => c.dataset.persona === persona);

        if (!carril) {
            out[clave] = { error: `la persona "${persona}" no aparece en su celda` };
            continue;
        }

        const barras = [...carril.querySelectorAll('[data-t=barra]')];

        if (barras.length !== 1) {
            out[clave] = { error: `se esperaba 1 barra y hay ${barras.length}` };
            continue;
        }

        const barra = barras[0];

        const sinAnillo = css(barra, 'outlineStyle') === 'none';

        out[clave] = {
            // El color que el navegador CALCULÓ. No el que yo declaré.
            fondo: css(barra, 'backgroundColor'),
            // La trama vive en background-image. Si no hay imagen, no hay trama.
            imagen: css(barra, 'backgroundImage'),
            // La gravedad va en el ANILLO, por fuera. El borde solo dice turno/concepto.
            anilloColor: sinAnillo ? null : css(barra, 'outlineColor'),
            anilloPx: sinAnillo ? 0 : parseFloat(css(barra, 'outlineWidth')),
            bordeColor: css(barra, 'borderTopColor'),
            bordeEstilo: css(barra, 'borderTopStyle'),
            // Las dos marcas son ELEMENTOS: o están o no están. Nada que interpretar.
            muesca: !!barra.querySelector('[data-t=muesca]'),
            filo: !!barra.querySelector('[data-t=filo-noche]'),
            rotulos: [...carril.querySelectorAll('[data-t=rotulo]')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
            notas: [...carril.querySelectorAll('[data-t=nota]')].map((n) => n.innerText.replace(/\s+/g, ' ').trim()),
            // Los carteles de la CELDA. Desde que el incumplimiento va a cartel, su motivo vive
            // aquí y no en la nota: si esto no se midiera, la ley 6 daría verde sobre un silencio.
            carteles: [...cell.querySelectorAll('[data-t=cartel]')].map((c) => c.innerText.replace(/\s+/g, ' ').trim()),
            ancho: barra.getBoundingClientRect().width,
        };
    }

    return out;
};

const medirTira = (celdas) => {
    const css = (el, p) => getComputedStyle(el)[p];
    const out = {};

    for (const [clave, celda] of Object.entries(celdas)) {
        const cell = document.querySelector(`[data-celda="${CSS.escape(celda)}"]`);
        const tramos = cell ? [...cell.querySelectorAll('[data-t=tramo]')] : [];

        out[clave] = {
            existe: !!cell,
            tramos: tramos.map((t) => ({
                estado: t.dataset.estado,
                fondo: css(t, 'backgroundColor'),
                imagen: css(t, 'backgroundImage'),
                borde: css(t, 'borderTopColor'),
            })),
            rotulos: cell ? [...cell.querySelectorAll('[data-t=tramo-rotulo]')].map((r) => r.innerText.trim()).filter(Boolean) : [],
            sinCandidato: !!cell?.querySelector('[data-t=cartel][data-severidad=catalog]'),
        };
    }

    return out;
};

const medirBandas = (personas) => {
    const css = (el, p) => getComputedStyle(el)[p];
    const out = {};

    /*
     * ⚠️ SE LOCALIZA POR data-persona, EXACTO. Y no es un detalle: es la quinta vez que el
     * instrumento miente por buscar mal.
     *
     * Buscaba la banda cuyo TEXTO contuviera el nombre del caso, y "no-bloquea-con-alta"
     * CONTIENE "bloquea-con-alta". Así que al pedir la banda que bloquea me devolvía la que no
     * bloquea, y el test denunciaba —con toda la razón aparente— que "falta la trama". El fallo
     * no estaba en la página: estaba en el que miraba.
     */
    for (const [clave, nombre] of Object.entries(personas)) {
        const banda = [...document.querySelectorAll('[data-t=banda]')]
            .find((b) => b.dataset.persona === nombre);

        out[clave] = banda ? {
            existe: true,
            imagen: css(banda, 'backgroundImage'),
            mask: css(banda, 'maskImage') || css(banda, 'webkitMaskImage'),
            texto: banda.innerText.replace(/\s+/g, ' ').trim(),
            bordeDerecho: css(banda, 'borderRightWidth'),
        } : { existe: false };
    }

    return out;
};

const medirCeldas = (celdas) => {
    const out = {};

    for (const [clave, celda] of Object.entries(celdas)) {
        const cell = document.querySelector(`[data-celda="${CSS.escape(celda)}"]`);
        const carteles = cell ? [...cell.querySelectorAll('[data-t=cartel]')] : [];

        out[clave] = {
            existe: !!cell,
            // El ORDEN importa: rojo, naranja, gris. Se lee de arriba abajo por gravedad.
            severidades: carteles.map((c) => c.dataset.severidad),
            textos: carteles.map((c) => c.innerText.replace(/\s+/g, ' ').trim()),
        };
    }

    return out;
};

/* ══════════════════════════════════════════════════════════════════════════════ */

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

/**
 * ⚠️ EL LOGIN TENÍA UNA CARRERA, Y SALÍA POR LA VENTANA COMO SI FUERA UN HALLAZGO.
 *
 * Con `domcontentloaded` el HTML ya está, pero Vue TODAVÍA NO HA HIDRATADO: el clic en el botón
 * cae en un formulario que aún no escucha, no pasa nada, y el instrumento se queda esperando en
 * /login hasta el timeout. Y un TimeoutError devuelve el mismo código de salida que un fallo de
 * verdad: la contraprueba de mutaciones cantaba "REVENTÓ" y yo me ponía a buscar un bug en la
 * banda de las bajas que no existía.
 *
 * Se espera al `load` (que incluye el JS), y si aun así no entra, se vuelve a intentar. No es
 * paranoia: es que una carrera perdida y un bug se parecen mucho desde fuera.
 */
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

await page.addInitScript(() => {
    window.__pedir = async (url) => {
        const version = JSON.parse(document.querySelector('[data-page]').textContent).version;

        const r = await fetch(url, {
            headers: {
                'X-Inertia': 'true',
                'X-Inertia-Version': version,
                'X-Inertia-Partial-Component': 'Schedule/Week',
                'X-Inertia-Partial-Data': 'axis,window,positions,people,assignments,conceptEntries,absences,coverage,violations',
            },
            credentials: 'same-origin',
        });

        return (await r.json()).props;
    };
});

/**
 * ⚠️ ABRIR CON REINTENTO, Y REVENTAR NO ES LO MISMO QUE FALLAR.
 *
 * La página de la matriz lleva ~100 celdas y sus props diferidas tardan. Con un `waitFor` corto,
 * un pico de lentitud tira el instrumento con un TimeoutError... que devuelve el mismo código de
 * salida que una discrepancia de verdad. Y entonces la contraprueba de mutaciones anunciaba
 * "CAZADO" sobre un test que en realidad se había caído: un detector roto disfrazado de detector
 * que funciona. Es la sexta vez que el instrumento miente, y esta vez me mentía a favor.
 *
 * Se reintenta una vez, y si de verdad no carga, se dice — no se cuenta como hallazgo.
 */
const abrir = async (url) => {
    for (let intento = 1; intento <= 3; intento++) {
        try {
            /*
             * ⚠️ NADA DE `networkidle`. ERA LA CAUSA DE QUE EL INSTRUMENTO SE CAYERA.
             *
             * `networkidle` espera a que la red lleve 500 ms callada, y en esta página nunca se
             * calla del todo: props diferidas, fuentes, peticiones sueltas. Se colgaba al azar en
             * una mutación distinta cada vez, y el fallo salía como TimeoutError — el mismo
             * código de salida que un hallazgo de verdad. La contraprueba anunciaba "CAZADO"
             * sobre un test que se había caído.
             *
             * Se espera AL DATO QUE IMPORTA (el indicador, que solo aparece cuando las props
             * diferidas han llegado), no a que la red se aburra.
             */
            await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
            // La cobertura y las violaciones son props DIFERIDAS: llegan en una segunda petición.
            // Medir antes sería medir una página a medio pintar y llamarlo "sin incidencias".
            // 90 s no es generosidad: la matriz tiene 96 contratos y su informe se DERIVA entero
            // en cada petición (que es justo lo que impide que mienta). Es lento a propósito.
            await page.waitForSelector('[data-t=indicador]', { timeout: 90000 });
            await page.waitForTimeout(500);

            return await page.evaluate((u) => window.__pedir(u), url);
        } catch (e) {
            if (intento === 3) {
                throw new Error(`no se pudo abrir ${url} tras tres intentos: ${e.message}`);
            }
        }
    }
};

const fallos = [];
const filas = [];

/* ── CAPA 1: LOS BLOQUES ────────────────────────────────────────────────────── */

const props = await abrir(M.bloques.url);
const pintado = await page.evaluate(medirBloques, M.bloques.casos);

const personas = Object.fromEntries(props.people.map((p) => [p.id, p]));
const turnos = Object.fromEntries(props.assignments.map((a) => [a.id, a]));
const conceptos = Object.fromEntries(props.conceptEntries.map((c) => [c.id, c]));

const alcanzadas = new Set();

for (const caso of M.bloques.casos) {
    const p = pintado[caso.clave];
    const persona = props.people.find((x) => x.name === caso.persona);

    if (!persona) {
        fallos.push(`${caso.clave}: la persona no llegó en el payload`);
        continue;
    }

    // El bloque de esta persona, según el SERVIDOR.
    const esTurno = caso.intencion.kind === 'shift';
    const bloque = esTurno
        ? Object.values(turnos).find((a) => a.personId === persona.id)
        : Object.values(conceptos).find((c) => c.personId === persona.id);

    if (!bloque) {
        fallos.push(`${caso.clave}: el motor no devuelve el bloque de ${caso.persona}`);
        continue;
    }

    // ⚠️ LA GRAVEDAD ES LA QUE EL MOTOR INFORMA, no la que yo pretendía sembrar.
    const rotas = (esTurno ? props.violations.assignments : props.violations.conceptEntries)[bloque.id] ?? [];
    const sevs = [...new Set(rotas.map((v) => v.severity))];

    const real = {
        kind: esTurno ? 'shift' : 'concept',
        computa: !esTurno && !!bloque.computa,
        sevs,
        forzado: !!bloque.forced,
        nocturno: !!bloque.crossesMidnight,
    };

    // La clave del caso: lo que ES, no lo que yo quería que fuera.
    const clave = [
        real.kind,
        esTurno ? '-' : (real.computa ? 'computa' : 'no-computa'),
        sevs.slice().sort().join('+') || 'limpio',
        real.forzado ? 'forzado' : '-',
        real.nocturno ? 'nocturno' : '-',
    ].join(' · ');

    alcanzadas.add(clave);

    // ── 1. ¿CAE EN UNA REGLA? ──
    const regla = reglaDe(real);

    if (!regla) {
        fallos.push(`${clave}: NO CAE EN NINGUNA REGLA — es un agujero de la matriz`);
        continue;
    }

    if (p.error) {
        fallos.push(`${caso.clave} (${clave}): ${p.error}`);
        continue;
    }

    // ── 2. ¿SE PINTA COMO DICE LA REGLA? ──
    const colorPersona = hexRgb(persona.color);
    const problemas = [];

    const fondoEsPersona = p.fondo === colorPersona;
    const fondoVacio = p.fondo === 'rgba(0, 0, 0, 0)' || p.fondo === 'transparent';
    const tieneTrama = p.imagen.includes('repeating-linear-gradient');

    if (regla.rellenoEsDeLaPersona && !fondoEsPersona) {
        problemas.push(`relleno ${p.fondo}, se esperaba el color de la persona (${colorPersona})`);
    }

    if (!regla.rellenoEsDeLaPersona && !fondoVacio) {
        problemas.push(`relleno ${p.fondo}, se esperaba hueco`);
    }

    if (regla.tramado !== tieneTrama) {
        problemas.push(regla.tramado ? 'falta la trama (no cubre puesto)' : 'sobra la trama');
    }

    // LEY 3: la gravedad va en el ANILLO, por fuera, y con el grosor que le toca.
    if ((p.anilloColor ?? null) !== (regla.anillo?.color ?? null)) {
        problemas.push(`anillo ${p.anilloColor ?? 'ninguno'}, se esperaba ${regla.anillo?.color ?? 'ninguno'}`);
    }

    if (regla.anillo && Math.abs(p.anilloPx - regla.anillo.px) > 0.51) {
        problemas.push(`anillo de ${p.anilloPx}px, se esperaban ${regla.anillo.px}px`);
    }

    // ⚠️ Y EL BORDE NO PUEDE LLEVAR LA GRAVEDAD. Ese era el bug: 2 px de gravedad DENTRO de una
    // barra de 12 se mezclaban con el relleno y la barra acababa siendo de un color que no es de
    // nadie. El borde lleva el color de la PERSONA, y no se discute.
    if (p.bordeColor !== colorPersona) {
        problemas.push(`el borde es ${p.bordeColor} y tiene que ser el color de la persona (${colorPersona}): la gravedad va FUERA`);
    }

    if (p.bordeEstilo !== regla.bordeEstilo) {
        problemas.push(`borde ${p.bordeEstilo}, se esperaba ${regla.bordeEstilo}`);
    }

    // LEY 14: el cartel es para lo que pide una decisión. Ni uno de más, ni uno de menos.
    const titulos = p.carteles.map((c) => c.split(' · ')[0]).filter((t) => t !== 'SIN CANDIDATO EN CATÁLOGO').sort();

    if (titulos.join('+') !== regla.carteles.slice().sort().join('+')) {
        problemas.push(`carteles [${titulos.join(', ') || 'ninguno'}], se esperaba [${regla.carteles.join(', ') || 'ninguno'}]`);
    }

    if (p.muesca !== regla.muesca) {
        problemas.push(regla.muesca ? 'falta la muesca (forzado)' : 'sobra la muesca');
    }

    if (p.filo !== regla.filo) {
        problemas.push(regla.filo ? 'falta el filo (cruza medianoche)' : 'sobra el filo');
    }

    /*
     * ── LEY 6: NINGÚN COLOR VA SOLO. Toda gravedad tiene su palabra, EN ALGUNA PARTE. ──
     *
     * ⚠️ Y "EN ALGUNA PARTE" ES LA CORRECCIÓN DE ESTA TANDA.
     *
     * Antes la palabra vivía siempre en la NOTA del carril, y este test exigía una nota. Ahora el
     * incumplimiento SIN FORZAR dice su motivo en el CARTEL —"INCUMPLIMIENTO · descanso corto"— y
     * la nota se calla para no repetirlo (ley 9). Si el test siguiera mirando solo las notas,
     * pasaría una de dos cosas, y las dos malas: o denunciaría un silencio que no existe, o —lo
     * de verdad peligroso— daría verde el día que el cartel se cayera y la nota siguiera callada.
     *
     * Se mira dónde ESTÁ la palabra: notas ∪ carteles. El canal cambia; la ley no.
     */
    const DICE = {
        impossible: () => p.carteles.some((c) => c.startsWith('IMPOSIBLE')),
        breach: () => p.carteles.some((c) => c.startsWith('INCUMPLIMIENTO')),
        notice: () => false,   // el aviso NUNCA va a cartel: informa, no pide nada
    };

    for (const s of sevs) {
        if (!DICE[s]() && p.notas.length === 0) {
            problemas.push(`tiene ${s} y ni una palabra —ni nota ni cartel—: el color va solo (ley 6)`);
        }
    }

    // ── LEY 8: toda nota lleva la hora del bloque del que habla. ──
    for (const n of p.notas) {
        if (!n.includes(bloque.label)) {
            problemas.push(`nota sin sujeto: "${n}" no dice de qué bloque habla`);
        }
    }

    // ── 3. ¿SE DISTINGUE DE TODAS LAS DEMÁS? ──
    // La firma se construye con lo que el NAVEGADOR pintó (las notas de verdad), no con lo que
    // la regla dice que debería haber. Si el pintado perdiera una palabra, la firma colapsaría
    // contra la de otro caso y saltaría aquí.
    const firma = firmaDeRegla(regla, p.notas, p.carteles);

    if (problemas.length) {
        fallos.push(`${caso.clave} (${clave}): ${problemas.join(' · ')}`);
    }

    filas.push({
        clave: caso.clave,
        caso: clave,
        densidad: regla.densidad,
        firma,
        rotulo: p.rotulos[0] ?? '—',
        notas: p.notas.join(' | ') || '—',
        ok: problemas.length === 0,
    });
}

/*
 * ⚠️ ¿SE HAN ALCANZADO TODOS LOS CASOS QUE DEBERÍAN ALCANZARSE? EL PUNTO CIEGO DEL INSTRUMENTO.
 *
 * Este test compara el pintado con LO QUE EL SERVIDOR DICE. Y ahí hay un agujero: si el
 * servidor CALLA un dato, el pintado es coherente con el silencio y el test da verde.
 *
 * Pasó de verdad: `conceptRows` no mandaba `crossesMidnight`. Un concepto de 22:00 a 06:00
 * llegaba al navegador afirmando que NO cruza medianoche, la parrilla —obediente— no pintaba
 * ni el filo ni la nota, y las tres comprobaciones pasaban tan contentas. El caso "concepto
 * nocturno" simplemente NO EXISTÍA, y un caso que no existe no se puede probar.
 *
 * Lo cacé contando los casos a mano (36 de los 44 que el modelo permite). Contar a mano no es
 * un instrumento: así que la cuenta se declara AQUÍ, y si falta un caso, el test lo grita.
 *
 * Los 44 salen del modelo, no de mi gusto:
 *   · TURNO    → 8 subconjuntos de gravedad × forzado × nocturno = 32
 *   · CONCEPTO → no puede ser forzado (no cuelga de un turno) ni tener `notice` (ninguna de sus
 *     reglas es informativa), y solo el de CONTADOR APARTE puede incumplir (el tope de horas
 *     extra es su única regla de gravedad media). Ver Validation/Rules/Concept/.
 */
const clavesDe = (kind, computa, sevs, forzados, nocturnos) => sevs.flatMap((s) => forzados.flatMap((f) => nocturnos.map((n) => [
    kind,
    kind === 'shift' ? '-' : computa,
    s.slice().sort().join('+') || 'limpio',
    f ? 'forzado' : '-',
    n ? 'nocturno' : '-',
].join(' · '))));

const ESPERADAS = [
    ...clavesDe('shift', null, [
        [], ['notice'], ['breach'], ['impossible'],
        ['breach', 'notice'], ['breach', 'impossible'], ['impossible', 'notice'],
        ['breach', 'impossible', 'notice'],
    ], [false, true], [false, true]),

    // El que SUMA TIEMPO puede además romper el tope de horas extra.
    ...clavesDe('concept', 'computa', [[], ['impossible'], ['breach'], ['breach', 'impossible']], [false], [false, true]),

    // El que NO suma tiempo no tiene tope que romper: solo puede ser limpio o imposible.
    ...clavesDe('concept', 'no-computa', [[], ['impossible']], [false], [false, true]),
];

for (const esperada of ESPERADAS) {
    if (!alcanzadas.has(esperada)) {
        fallos.push(`CASO NO ALCANZADO: «${esperada}» — el modelo lo permite y no ha salido ni uno. O el seeder no lo siembra, o el SERVIDOR se está callando un dato.`);
    }
}

for (const suelta of alcanzadas) {
    if (!ESPERADAS.includes(suelta)) {
        fallos.push(`CASO INESPERADO: «${suelta}» — ha salido un caso que el modelo no debería permitir. Revisa las reglas antes de creerte el pintado.`);
    }
}

/* ── La contraprueba del propio instrumento: ¿de verdad compara TODOS los pares? ── */
const firmasPorCaso = new Map();

for (const f of filas) {
    if (!firmasPorCaso.has(f.caso)) {
        firmasPorCaso.set(f.caso, f.firma);
    } else if (firmasPorCaso.get(f.caso) !== f.firma) {
        fallos.push(`${f.caso}: el MISMO caso se pinta de dos maneras distintas`);
    }
}

const porFirma = new Map();

for (const [caso, firma] of firmasPorCaso) {
    porFirma.set(firma, [...(porFirma.get(firma) ?? []), caso]);
}

const gemelos = [...porFirma.entries()].filter(([, casos]) => casos.length > 1);

for (const [firma, casos] of gemelos) {
    fallos.push(`GEMELOS VISUALES (${casos.length}): ${casos.join('  ≡  ')}\n     firma: ${firma}`);
}

/* ── CAPA 2: LA TIRA ────────────────────────────────────────────────────────── */

await abrir(M.tira.url);
const tira = await page.evaluate(medirTira, M.tira.celdas);

const ESPERADO_TIRA = {
    covered: { estado: 'covered', trama: false, rotulo: null },
    missing: { estado: 'missing', trama: false, rotulo: '-1' },
    'missing-uncoverable': { estado: 'missing', trama: true, rotulo: '-1' },
    excess: { estado: 'excess', trama: false, rotulo: '+1' },
    unrequested: { estado: 'unrequested', trama: false, rotulo: null },
    'cerrado-con-gente': { estado: 'excess', trama: false, rotulo: '+1' },
};

const firmasTira = new Map();

for (const [clave, esperado] of Object.entries(ESPERADO_TIRA)) {
    const t = tira[clave];

    if (!t?.existe) {
        fallos.push(`tira/${clave}: la celda no existe`);
        continue;
    }

    const tramo = t.tramos.find((x) => x.estado === esperado.estado);

    if (!tramo) {
        fallos.push(`tira/${clave}: no hay ningún tramo "${esperado.estado}" (hay: ${t.tramos.map((x) => x.estado).join(', ') || 'ninguno'})`);
        continue;
    }

    const trama = tramo.imagen.includes('repeating-linear-gradient');

    if (trama !== esperado.trama) {
        fallos.push(`tira/${clave}: ${esperado.trama ? 'falta' : 'sobra'} el rayado de "sin candidato"`);
    }

    if (esperado.rotulo && !t.rotulos.includes(esperado.rotulo)) {
        fallos.push(`tira/${clave}: se esperaba el rótulo "${esperado.rotulo}" y hay [${t.rotulos.join(', ')}]`);
    }

    if (!esperado.rotulo && t.rotulos.length) {
        fallos.push(`tira/${clave}: no debería llevar número y lleva [${t.rotulos.join(', ')}]`);
    }

    /*
     * ⚠️ LA FIRMA DE LA TIRA SE AGRUPA POR ESTADO, NO POR ESCENARIO.
     *
     * En su primera pasada este test gritó que «cerrado-con-gente» y «excess» se pintaban igual.
     * Y era verdad — pero NO era un fallo: los dos SON un exceso. Un día declarado cerrado con
     * alguien colocado es exactamente eso, gente que sobra (y de la cara: pagas una jornada un
     * día que el negocio no abre). Dos escenarios distintos que producen el MISMO estado tienen
     * que pintarse igual; lo contrario sería el bug.
     *
     * Lo que no puede pasar es que dos ESTADOS distintos compartan píxel — que es el bug del
     * gris, el que lleva siete tandas volviendo.
     */
    const firma = `${tramo.fondo}|${trama}|${tramo.borde}`;
    const clavePintado = `${esperado.estado}${esperado.trama ? '+incubrible' : ''}`;
    const gemelo = [...firmasTira.entries()].find(([f, c]) => f === firma && c !== clavePintado);

    if (gemelo) {
        fallos.push(`tira: los estados «${clavePintado}» y «${gemelo[1]}» se pintan IGUAL — ${firma}`);
    }

    firmasTira.set(firma, clavePintado);
}

/* ── CAPA 3: LAS BANDAS ─────────────────────────────────────────────────────── */

await abrir(M.bandas.url);
const bandas = await page.evaluate(medirBandas, M.bandas.personas);

const firmasBanda = new Map();

for (const [clave, b] of Object.entries(bandas)) {
    if (!b.existe) {
        fallos.push(`banda/${clave}: no se pinta en ninguna parte`);
        continue;
    }

    const bloquea = clave.startsWith('bloquea');
    const abierta = clave.endsWith('sin-alta');

    const trama = b.imagen.includes('repeating-linear-gradient');

    if (trama !== bloquea) {
        fallos.push(`banda/${clave}: ${bloquea ? 'falta' : 'sobra'} la trama de "bloquea la disponibilidad"`);
    }

    // Ley 6: lo que dice el desvanecido lo dice también una palabra.
    if (abierta && !b.texto.includes('sin alta')) {
        fallos.push(`banda/${clave}: es una baja SIN ALTA y no lo dice con letras (ley 6)`);
    }

    if (!abierta && b.texto.includes('sin alta')) {
        fallos.push(`banda/${clave}: dice "sin alta" y tiene fecha de alta`);
    }

    const firma = `${trama}|${abierta ? b.mask : 'sin-mask'}`;
    const gemelo = [...firmasBanda.entries()].find(([f, c]) => f === firma && c !== clave);

    if (gemelo) {
        fallos.push(`banda: «${clave}» y «${gemelo[1]}» se pintan IGUAL`);
    }

    firmasBanda.set(firma, clave);
}

/* ── CAPA 4: LOS CARTELES DE LA CELDA ───────────────────────────────────────── */

await abrir(M.celdas.url);
const celdas = await page.evaluate(medirCeldas, M.celdas.celdas);

/**
 * LEY 14: EL CARTEL ES PARA LO QUE PIDE UNA DECISIÓN, NO PARA LO QUE SIMPLEMENTE OCURRE.
 *
 * Y los dos últimos son EL MISMO incumplimiento: lo único que cambia es que uno está forzado. Si
 * el cartel saliera en los dos —o en ninguno—, la decisión sería una mentira.
 */
const ESPERADO_CELDA = {
    'solo-imposible': ['impossible'],
    'solo-sin-candidato': ['catalog'],
    /*
     * LA COMBINACIÓN QUE NADIE HABÍA MIRADO. Eran v-if/v-else-if: el segundo cartel no salía.
     *
     * ⚠️ Y SON TRES, NO DOS. Yo esperaba dos y el test me corrigió: esta persona está contratada
     * para OTRO puesto (así se consigue el "sin candidato"), o sea que además NO ESTÁ CUALIFICADA
     * — un incumplimiento de pleno derecho. Tres hechos independientes, tres carteles apilados, y
     * la página tenía razón. Escribir la expectativa a mano y que la página te enmiende es
     * exactamente para lo que sirve tener las reglas escritas dos veces.
     */
    'imposible-y-sin-candidato': ['impossible', 'breach', 'catalog'],
    'incumplimiento': ['breach'],
    // ⚠️ Ya se decidió, con constancia. La barra conserva su anillo, su muesca y su nota — pero
    // no pide una decisión que ya está tomada. Un cuadrante en llamas alarma, y se ignora.
    'incumplimiento-forzado': [],
};

for (const [clave, esperado] of Object.entries(ESPERADO_CELDA)) {
    const c = celdas[clave];

    if (!c?.existe) {
        fallos.push(`celda/${clave}: no existe`);
        continue;
    }

    if (c.severidades.join(',') !== esperado.join(',')) {
        fallos.push(
            `celda/${clave}: carteles [${c.severidades.join(', ') || 'ninguno'}], se esperaba `
            + `[${esperado.join(', ') || 'ninguno'}]  ${c.textos.length ? `— dicen: ${c.textos.join(' // ')}` : ''}`,
        );
    }
}

await browser.close();

/* ══════════════════════════════════════════════════════════════════════════════
 * EL INFORME
 * ══════════════════════════════════════════════════════════════════════════════ */

const linea = (s = '─') => s.repeat(150);
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

let salida = '';
const di = (s = '') => { salida += s + '\n'; console.log(s); };

di();
di('EL BACKTEST COMBINATORIO — la matriz visual, sobre la página real, a 1366 px');
di(linea('═'));
di();
di(`${pad('CASO (lo que el motor dice que es)', 52)} ${pad('DENSIDAD', 9)} ${pad('FIRMA VISUAL (sin la identidad de la persona)', 56)} ¿?`);
di(linea());

const unicos = new Map();
for (const f of filas) {
    if (!unicos.has(f.caso)) unicos.set(f.caso, f);
}

for (const f of [...unicos.values()].sort((a, b) => a.caso.localeCompare(b.caso))) {
    di(`${pad(f.caso, 52)} ${pad(f.densidad, 9)} ${pad(f.firma, 56)} ${f.ok ? '✅' : '❌'}`);
}

di(linea());
di();
di(`CAPA 1 · BLOQUES        ${M.bloques.casos.length} combinaciones sembradas → ${alcanzadas.size} casos alcanzados de ${ESPERADAS.length} que el modelo permite`);
di(`                        ${porFirma.size} firmas visuales distintas · ${gemelos.length} pares de gemelos`);
di(`CAPA 2 · TIRA           ${Object.keys(ESPERADO_TIRA).length} estados · ${firmasTira.size} firmas distintas`);
di(`CAPA 3 · BANDAS         ${Object.keys(bandas).length} combinaciones · ${firmasBanda.size} firmas distintas`);
di(`CAPA 4 · CARTELES       ${Object.keys(ESPERADO_CELDA).length} combinaciones, incluida imposible + sin candidato`);
di();

if (fallos.length) {
    di(`❌ ${fallos.length} DISCREPANCIAS:`);
    di();
    fallos.forEach((f) => di(`   · ${f}`));
} else {
    di('✅ Todas las combinaciones caen en una regla, se pintan como dice la regla, y ninguna');
    di('   se pinta igual que otra distinta.');
}

di();

mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });
writeFileSync(new URL('./salida/matriz.txt', import.meta.url), salida);

process.exit(fallos.length ? 1 : 0);
