/**
 * EL COTEJO. CELDA A CELDA, PERSONA A PERSONA, CONTRA LA PÁGINA.
 *
 * ⚠️ ESTE FICHERO EXISTE PORQUE EL BACKTESTING ANTERIOR NO SIRVIÓ.
 *
 * Hice 72 comprobaciones visuales, dije que estaba todo arreglado, y el usuario abrió la
 * página y en treinta segundos encontró tres cosas que ninguna de las 72 vio: el déficit del
 * sumiller invisible (gris sobre gris), un cuadradito sin explicar, y un aviso al que le
 * faltaba la hora.
 *
 * No es que fallaran: es que MIRABAN DONDE NO ERA. Preguntaban "¿hay algún tramo rayado?",
 * "¿hay dos barras?" — preguntas sobre EL TIPO de cosa, no sobre LA COSA. Y una comprobación
 * que busca "el primero del tipo X" acierta por casualidad y falla por casualidad.
 *
 * ASÍ QUE AQUÍ NO SE INTUYE NADA:
 *
 *   1. Se le pide al SERVIDOR la verdad (el payload de Inertia: qué turnos hay, qué dice la
 *      cobertura, qué violaciones ha encontrado el motor).
 *   2. Se localiza CADA CELDA CONCRETA por (puesto, día) — nunca "la primera que…".
 *   3. Se enumera TODO lo que hay dentro: cada barra, cada rótulo, cada tramo, con el color
 *      que el navegador CALCULÓ y el píxel donde acabó.
 *   4. Se COTEJA una contra otra, y se imprime la tabla. No un veredicto: el cotejo.
 *
 *   node tests/Visual/cotejo.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://turnia.test';

const lunesDe = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);

    return d.toISOString().slice(0, 10);
};

const rgb = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);
const esVerde = ([r, g, b]) => g > r + 20 && g > b + 10;
const esRojo = ([r, g, b]) => r > g + 40 && r > b + 40;
const esLila = ([r, g, b]) => b > r + 15 && b > g + 20;

const colorDe = (fondo) => {
    const c = rgb(fondo);

    if (esVerde(c)) return 'verde';
    if (esRojo(c)) return 'rojo';
    if (esLila(c)) return 'lila';

    return `¿${fondo}?`;
};

/** LO QUE EL MOTOR DICE. Se lo pedimos al servidor, con la sesión del navegador. */
const verdadDelMotor = (url) => window.__pedir(url);

/** LO QUE LA PANTALLA PINTA. Todo lo que hay dentro de cada celda, medido. */
const loPintado = () => {
    const css = (el, p) => getComputedStyle(el)[p];
    const caja = (el) => el.getBoundingClientRect();

    /*
     * ⚠️ ¿SE LEE SIN ESFUERZO? EL CONTRASTE, CALCULADO SOBRE EL PÍXEL QUE SALE.
     *
     * Es la trampa que ya me ha pillado dos veces: el verde al 18 % sobre gris DABA UN GRIS, y
     * el "-1" gris sobre rayado gris no se veía. En los dos casos el color estaba PUESTO y no
     * estaba VISTO.
     *
     * Aquí no se mira el color declarado: se COMPONE el fondo real —capa a capa, resolviendo
     * las transparencias hasta el blanco— y se calcula el contraste WCAG contra la tinta.
     * Menos de 4,5 es texto que cuesta leer, y un aviso que cuesta leer es un aviso que se
     * ignora.
     */
    const tinta = (c) => {
        const n = (c.match(/[\d.]+/g) ?? []).map(Number);

        return { r: n[0] ?? 0, g: n[1] ?? 0, b: n[2] ?? 0, a: n.length > 3 ? n[3] : 1 };
    };

    const sobre = (arriba, abajo) => ({
        r: arriba.r * arriba.a + abajo.r * (1 - arriba.a),
        g: arriba.g * arriba.a + abajo.g * (1 - arriba.a),
        b: arriba.b * arriba.a + abajo.b * (1 - arriba.a),
        a: 1,
    });

    // El fondo de verdad: se apilan las capas de los ancestros hasta el blanco de la página.
    const fondoDe = (el, extra = null) => {
        const capas = [];

        for (let e = el; e; e = e.parentElement) {
            const c = tinta(css(e, 'backgroundColor'));

            if (c.a > 0) {
                capas.push(c);
            }
        }

        let bg = { r: 255, g: 255, b: 255, a: 1 };

        for (let i = capas.length - 1; i >= 0; i--) {
            bg = sobre(capas[i], bg);
        }

        // Un rótulo de la tira flota SOBRE su tramo, que no es su padre sino su hermano: hay
        // que meter esa capa a mano o mediríamos el contraste contra un fondo que no está.
        return extra ? sobre(tinta(extra), bg) : bg;
    };

    const lum = ({ r, g, b }) => {
        const f = (v) => {
            const x = v / 255;

            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };

        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };

    const contraste = (el, extra = null) => {
        const bg = fondoDe(el, extra);
        const fg = sobre(tinta(css(el, 'color')), bg);
        const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);

        return Math.round(((a + 0.05) / (b + 0.05)) * 10) / 10;
    };

    const pintado = {};

    for (const celda of document.querySelectorAll('[data-t=celda]')) {
        const tira = celda.querySelector('[data-t=tira]');
        const cajaTira = tira ? caja(tira) : null;

        pintado[celda.dataset.celda] = {
            imposible: celda.querySelector('[data-t=imposible]')?.textContent.trim() ?? null,
            sinCandidato: !!celda.querySelector('[data-t=sin-candidato]'),

            carriles: [...celda.querySelectorAll('[data-t=carril]')].map((l) => {
                const pista = caja(l.querySelector('[data-t=pista]'));
                const nombre = l.querySelector('[data-t=nombre]');

                /*
                 * ⚠️ EL AGRUPAMIENTO SE MIDE, NO SE SUPONE.
                 *
                 * Contar "2 barras, 2 rótulos" daba ✅ mientras el segundo rótulo de Nuria
                 * caía debajo de su hora médica y pegado al nombre de Ana. Había dos rótulos,
                 * sí — y uno no se sabía de quién era. Contar elementos NO es preguntarse si
                 * la información es inequívoca.
                 *
                 * Aquí se apunta la Y de cada cosa y el color del filo que la agrupa; quien
                 * juzga si cada elemento cae bajo SU nombre y no bajo el del vecino es el
                 * cotejo de fuera, con todos los nombres de la celda delante.
                 */
                const grupo = l.querySelector('[data-t=rotulo]')?.parentElement;

                // El AIRE se mide entre el pie de uno y la frente del siguiente. Medirlo entre
                // "topes" mete dentro la ALTURA del elemento y convierte un hueco de 3 px en
                // uno de 17: el instrumento diría que el grupo está suelto cuando está pegado.
                const marca = (e) => ({
                    texto: e.textContent.trim().replace(/\s+/g, ' '),
                    y: caja(e).top,
                    y2: caja(e).bottom,
                    // ¿SE LEE? El contraste que de verdad sale en pantalla, no el declarado.
                    // En un rótulo con dos renglones (hora + pie) se mide el PEOR de los dos.
                    contraste: Math.min(...[e, ...e.querySelectorAll('span, div')]
                        .filter((x) => x.textContent.trim())
                        .map((x) => contraste(x))),
                });

                return {
                    persona: l.dataset.persona,
                    color: css(l.querySelector('[data-t=nombre]').previousElementSibling.firstElementChild, 'backgroundColor'),
                    // El filo vertical que ata todo lo suyo. Debe ser DE SU COLOR.
                    filo: grupo ? css(grupo, 'borderLeftColor') : null,
                    filoAncho: grupo ? parseFloat(css(grupo, 'borderLeftWidth')) : 0,
                    yNombre: caja(nombre).top,
                    yNombre2: caja(nombre).bottom,
                    contrasteNombre: contraste(nombre),
                    pista: { x: pista.left, ancho: pista.width, y: pista.top, y2: pista.bottom },
                    barras: [...l.querySelectorAll('[data-t=barra]')].map((b) => {
                        const c = caja(b);

                        return {
                            // El píxel REAL, no el declarado.
                            x1: c.left,
                            x2: c.right,
                            fila: Math.round(c.top - pista.top),
                            fondo: css(b, 'backgroundColor'),
                            imagen: css(b, 'backgroundImage'),
                        };
                    }),
                    // El texto TAL COMO HA QUEDADO PINTADO, y DÓNDE ha quedado.
                    rotulos: [...l.querySelectorAll('[data-t=rotulo]')].map(marca),
                    notas: [...l.querySelectorAll('[data-t=nota]')].map(marca),
                };
            }),

            tramos: [...celda.querySelectorAll('[data-t=tramo]')].map((t, i) => {
                const c = caja(t);
                const rotulo = celda.querySelectorAll('[data-t=tramo-rotulo]')[i];

                return {
                    x1: c.left,
                    x2: c.right,
                    fondo: css(t, 'backgroundColor'),
                    rayado: css(t, 'backgroundImage').includes('repeating-linear'),
                    texto: rotulo?.textContent.trim() ?? '',
                    // El "-1" flota sobre SU tramo, no sobre la tira: hay que meter esa capa.
                    contraste: rotulo?.textContent.trim() ? contraste(rotulo, css(t, 'backgroundColor')) : null,
                    // Un rótulo que no cabe en su caja es un rótulo recortado.
                    recortado: rotulo ? rotulo.scrollWidth > rotulo.clientWidth + 1 : false,
                };
            }),

            tira: cajaTira ? { x: cajaTira.left, ancho: cajaTira.width } : null,
        };
    }

    return pintado;
};

// ── El cotejo ───────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'demo@turnia.test');
await page.fill('input[type=password]', 'turnia');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 20000 });

// El ayudante que le pide al servidor el payload ENTERO, diferidas incluidas.
await page.addInitScript(() => {
    window.__pedir = async (url) => {
        const version = JSON.parse(document.querySelector('[data-page]').textContent).version;

        const r = await fetch(url, {
            headers: {
                'X-Inertia': 'true',
                'X-Inertia-Version': version,
                'X-Inertia-Partial-Component': 'Schedule/Week',
                'X-Inertia-Partial-Data': 'axis,window,positions,people,assignments,conceptEntries,coverage,violations',
            },
        });

        return (await r.json()).props;
    };
});

const filas = [];
let noes = 0;

for (const [etiqueta, offset] of [['semana anterior', -1], ['semana en curso', 0]]) {
    const url = `/companies/1/calendars/1/schedule?week=${lunesDe(offset)}`;

    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-t=indicador]', { timeout: 20000 });

    const motor = await page.evaluate(verdadDelMotor, url);
    const pantalla = await page.evaluate(loPintado);

    const persona = (id) => motor.people.find((p) => p.id === id)?.name ?? `#${id}`;
    const imposibles = (id) => (motor.violations.assignments[id] ?? []).filter((v) => v.severity === 'impossible');

    for (const position of motor.positions) {
        for (const day of motor.window.days) {
            const clave = `${position.name}|${day.date}`;
            const visto = pantalla[clave];

            // ── LO QUE EL MOTOR DICE QUE DEBERÍA HABER EN ESTA CELDA ──
            const turnos = motor.assignments.filter((a) => a.positionId === position.id && a.workDate === day.date);
            const conTurno = new Set(turnos.map((t) => t.personId));

            // Los conceptos van en el carril de su persona si esa persona tiene turno en este
            // puesto ese día; y si no tiene turno en NINGUNO, en el primer puesto que puede cubrir.
            const conTurnoEseDia = new Set(motor.assignments.filter((a) => a.workDate === day.date).map((a) => a.personId));

            const conceptos = motor.conceptEntries.filter((c) => c.workDate === day.date && (
                conTurno.has(c.personId)
                || (! conTurnoEseDia.has(c.personId) && (c.eligiblePositionIds ?? [])[0] === position.id)
            ));

            const bloques = [...turnos.map((t) => ({ ...t, kind: 'shift' })), ...conceptos.map((c) => ({ ...c, kind: 'concept' }))];
            const tramos = motor.coverage.segments.filter((s) => s.positionId === position.id && s.workDate === day.date);

            if (! bloques.length && ! tramos.length) {
                continue;
            }

            // ── EL COTEJO, PERSONA A PERSONA ──
            const porPersona = new Map();

            for (const b of bloques) {
                if (! porPersona.has(b.personId)) {
                    porPersona.set(b.personId, []);
                }
                porPersona.get(b.personId).push(b);
            }

            let primera = true;

            // Con una sola persona no hay a quién confundir. Con dos o más, la pregunta
            // "¿de quién es esto?" tiene que tener UNA respuesta, no una deducción.
            const personasEnCelda = porPersona.size;

            for (const [personId, suyos] of porPersona) {
                const nombre = persona(personId);
                const carril = visto?.carriles.find((c) => c.persona === nombre);

                suyos.sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);

                // La HORA manda y va sola en su renglón; debajo, lo que ese bloque ES.
                // (Los dos renglones del rótulo son bloques pegados: textContent no mete
                // espacio entre ellos, y el esperado tampoco.)
                const esperados = suyos.map((b) => (b.kind === 'concept'
                    ? `${b.label}◷ ${b.name} · no cubre puesto`
                    : b.label));

                const barrasOk = carril?.barras.length === suyos.length;
                const rotulosOk = JSON.stringify((carril?.rotulos ?? []).map((r) => r.texto)) === JSON.stringify(esperados);

                // ⚠️ Y LA BARRA TIENE QUE ESTAR DONDE DICE EL EJE, no solo existir. Un contador
                // de barras no habría visto los dos huecos de hora que tuvimos en la tanda 5.
                let sitioOk = barrasOk;
                let desvio = 0;

                if (barrasOk && carril) {
                    for (let i = 0; i < suyos.length; i++) {
                        const x1 = carril.pista.x + (suyos[i].left / 100) * carril.pista.ancho;
                        const x2 = x1 + (suyos[i].width / 100) * carril.pista.ancho;

                        desvio = Math.max(desvio, Math.abs(carril.barras[i].x1 - x1), Math.abs(carril.barras[i].x2 - x2));
                    }

                    sitioOk = desvio <= 1.5;
                }

                // Un solape imposible SE VE: barras a distinta altura. Una partida, a la misma.
                const seSolapa = suyos.some((a, i) => suyos.some((b, j) => j > i && b.startHour < a.endHour));
                const alturas = new Set(carril?.barras.map((b) => b.fila) ?? []);
                const apiladasOk = ! seSolapa || alturas.size === carril?.barras.length;

                /*
                 * ⚠️ LAS NOTAS TAMBIÉN SE COTEJAN, Y ESTE ES EL AGUJERO QUE SE ME COLÓ.
                 *
                 * A la nota del nocturno se le cayó la hora ("cruza medianoche" a secas: el
                 * aviso sin el dato) y ninguna de mis 72 comprobaciones lo vio, porque
                 * ninguna miraba las notas. Un aviso que no dice DE QUÉ TURNO habla no sirve
                 * en un carril con dos barras.
                 *
                 * No se predice el texto exacto de cada regla —eso sería copiar la vista y
                 * bendecirla—: se exige que cada aviso LLEVE SU DATO.
                 */
                const notas = carril?.notas ?? [];
                const fallosDeNota = [];

                /*
                 * ⚠️ TODA NOTA TIENE QUE DECIR DE QUÉ TURNO HABLA.
                 *
                 * Es la misma lección tres veces: "cruza medianoche" a secas, "no cubre
                 * puesto" a secas, "descanso corto" en un carril con dos turnos. Un aviso sin
                 * sujeto obliga a deducir. La regla, ahora general: TODA nota empieza por la
                 * hora del bloque del que habla.
                 */
                for (const n of notas) {
                    if (! suyos.some((b) => n.texto.includes(b.label))) {
                        fallosDeNota.push(`"${n.texto}" no dice de qué turno habla`);
                    }
                }

                for (const b of suyos) {
                    if (b.crossesMidnight && ! notas.some((n) => n.texto.includes(b.label) && n.texto.includes('medianoche'))) {
                        fallosDeNota.push(`el nocturno ${b.label} no avisa de que cruza medianoche`);
                    }

                    if (b.kind === 'concept' && ! (carril?.rotulos ?? []).some((r) => r.texto.includes(b.name) && r.texto.includes('no cubre puesto'))) {
                        fallosDeNota.push(`${b.name} no dice que no cubre puesto`);
                    }

                    if (b.forced && ! notas.some((n) => n.texto.includes('Forzado'))) {
                        fallosDeNota.push('un turno forzado sin constancia');
                    }
                }

                // Cada regla rota del motor tiene que aparecer en alguna nota. Si el motor ve
                // tres cosas y la celda cuenta dos, una se ha perdido por el camino.
                // ⚠️ Menos las que el CARTEL de la celda ya grita: repetirlas por barra daba
                // tres avisos para un solo hecho. Lo que se exige es que se diga UNA vez, no
                // que se diga en todas partes.
                const reglas = new Set(suyos.filter((b) => b.kind === 'shift')
                    .flatMap((b) => (motor.violations.assignments[b.id] ?? []))
                    .filter((v) => ! (v.severity === 'impossible' && visto?.imposible))
                    .map((v) => v.code));

                if (notas.length < reglas.size) {
                    fallosDeNota.push(`${reglas.size} reglas rotas y solo ${notas.length} notas`);
                }

                // Y al revés: si el cartel lo grita, el carril NO puede repetirlo.
                if (visto?.imposible && notas.some((n) => n.texto.includes('mposible'))) {
                    fallosDeNota.push('el imposible se dice DOS veces: en el cartel y en la nota');
                }

                /*
                 * ⚠️ ¿SE SABE DE QUIÉN ES CADA COSA? La columna que faltaba.
                 *
                 * "2 barras, 2 rótulos ✅" era CIERTO y no probaba nada: el segundo rótulo de
                 * Nuria no decía de quién era. Aquí se comprueba lo que el ojo hace de verdad
                 * —agrupar por proximidad y por color— y se exige que ese agrupamiento NO
                 * MIENTA:
                 *
                 *   · cada rótulo y cada nota cuelga del nombre de SU persona, no del de otra
                 *   · lo suyo está MÁS CERCA de su nombre que del nombre del vecino
                 *   · y el filo que los ata es DE SU COLOR (tapa los nombres y aún se sabe)
                 */
                const fallosDeDueno = [];

                // 1. Cada cosa cuelga del nombre de SU persona: el nombre inmediatamente por
                //    encima de un rótulo o una nota tiene que ser el suyo, nunca el del vecino.
                for (const e of [...(carril?.rotulos ?? []), ...notas]) {
                    const encima = (visto?.carriles ?? [])
                        .filter((c) => c.yNombre <= e.y)
                        .sort((a, b) => b.yNombre - a.yNombre)[0];

                    if (encima?.persona !== nombre) {
                        fallosDeDueno.push(`"${e.texto}" cuelga de ${encima?.persona ?? 'nadie'}`);
                    }
                }

                /*
                 * 2. LA LEY DE PROXIMIDAD, MEDIDA.
                 *
                 * ⚠️ Y aquí corrijo mi propio criterio, porque el primero era imposible.
                 *
                 * Empecé exigiendo que cada elemento estuviera más cerca de SU nombre que del
                 * de cualquier otro. Eso NO lo puede cumplir el último elemento de un carril:
                 * la nota de Marco está a 60 px de su nombre por pura acumulación (rótulos +
                 * pista + notas) y a 12 px del nombre de Iker, que viene justo debajo. El test
                 * daba ❌ sobre un carril que se lee perfectamente.
                 *
                 * Lo que el ojo usa de verdad no es la distancia AL TÍTULO: son los HUECOS.
                 * Un grupo se lee como grupo cuando el aire DENTRO es menor que el aire que lo
                 * separa del siguiente. Eso es lo que hay que exigir, y es lo que se mide:
                 *
                 *     el hueco que separa a dos personas > el mayor hueco dentro de una
                 */
                const hitos = [
                    { y: carril?.yNombre ?? 0, y2: carril?.yNombre2 ?? 0 },
                    ...(carril?.rotulos ?? []),
                    { y: carril?.pista.y ?? 0, y2: carril?.pista.y2 ?? 0 },
                    ...notas,
                ].sort((a, b) => a.y - b.y);

                let huecoInterno = 0;

                for (let i = 1; i < hitos.length; i++) {
                    huecoInterno = Math.max(huecoInterno, hitos[i].y - hitos[i - 1].y2);
                }

                const siguiente = (visto?.carriles ?? []).find((c) => c.yNombre > (carril?.yNombre ?? 0));

                if (siguiente) {
                    const huecoExterno = siguiente.yNombre - hitos[hitos.length - 1].y2;

                    // Con el mismo aire dentro que fuera, el ojo no sabe dónde acaba una
                    // persona y empieza la otra. Se exige que fuera haya AL MENOS el doble.
                    if (huecoExterno < huecoInterno * 2) {
                        fallosDeDueno.push(`aire entre personas ${huecoExterno.toFixed(0)}px vs ${huecoInterno.toFixed(0)}px dentro (hace falta el doble)`);
                    }
                }

                // 3. El filo de color: el hilo que ata lo suyo AUNQUE TAPES LOS NOMBRES.
                if (carril && (carril.filo !== carril.color || carril.filoAncho < 2)) {
                    fallosDeDueno.push(`el filo (${carril.filo}) no es el color de la persona (${carril.color})`);
                }

                const dueno = !! carril && ! fallosDeDueno.length;

                /*
                 * ⚠️ ¿SE LEE SIN ESFUERZO? La columna nueva.
                 *
                 * La hora iba en gris claro (#8A8896 → contraste 3,4) debajo de un nombre en
                 * negrita: se susurraba. Y en una parrilla de turnos la hora vale lo mismo que
                 * el nombre. 4,5 es el mínimo para leer un texto pequeño sin esforzarse; por
                 * debajo, el dato está pintado y no está leído.
                 */
                const lecturas = [
                    { que: 'nombre', c: carril?.contrasteNombre ?? 0 },
                    ...(carril?.rotulos ?? []).map((r) => ({ que: `"${r.texto}"`, c: r.contraste })),
                    ...notas.map((n) => ({ que: `"${n.texto}"`, c: n.contraste })),
                ];

                const flojas = lecturas.filter((l) => l.c < 4.5);
                const peor = Math.min(...lecturas.map((l) => l.c));

                const ok = !! carril && barrasOk && rotulosOk && sitioOk && apiladasOk
                    && ! fallosDeNota.length && dueno && ! flojas.length;

                if (! ok) {
                    noes++;
                }

                filas.push({
                    semana: etiqueta,
                    celda: `${position.name} · ${day.weekday} ${day.label}`,
                    persona: nombre,
                    turno: suyos.map((b) => (b.kind === 'concept' ? `◷${b.label}` : b.label)).join(' + '),
                    barras: `${carril?.barras.length ?? 0}/${suyos.length}${seSolapa ? (apiladasOk ? ' apiladas' : ' ¡PISADAS!') : ''}`,
                    rotulos: `${carril?.rotulos.length ?? 0}/${suyos.length}`,
                    dicen: (carril?.rotulos ?? []).map((r) => r.texto).join(' | ') || '—',
                    notas: fallosDeNota.length
                        ? '⚠ ' + fallosDeNota.join('; ')
                        : (notas.map((n) => n.texto).join(' | ') || '—'),
                    sitio: barrasOk ? `±${desvio.toFixed(1)}px` : '—',
                    dueno: fallosDeDueno.length ? '❌ ' + fallosDeDueno[0] : (personasEnCelda > 1 ? 'SÍ (filo propio)' : 'SÍ (única)'),
                    lee: flojas.length ? `❌ ${flojas[0].que} a ${flojas[0].c}` : `sí · peor ${peor.toFixed(1)}:1`,
                    ok,
                });

                primera = false;
            }

            // ── Y LA TIRA DE COBERTURA DE ESTA CELDA ──
            if (tramos.length || visto?.tramos.length) {
                const esperado = tramos.map((s) => {
                    const color = s.state === 'missing' ? 'rojo' : s.state === 'excess' ? 'lila' : 'verde';
                    const num = s.state === 'missing' ? `-${s.missing}` : s.state === 'excess' ? `+${s.excess}` : '';

                    return `${color}${s.uncoverable ? '+rayas' : ''}${num ? ' ' + num : ''}`;
                });

                const pintadoTira = (visto?.tramos ?? []).map((t) => (
                    `${colorDe(t.fondo)}${t.rayado ? '+rayas' : ''}${t.texto ? ' ' + t.texto : ''}`
                ));

                // ⚠️ EL DÉFICIT SE TIENE QUE VER. Un hueco cuyo número no está pintado es un
                // hueco que el encargado no puede contar: el gris sobre gris del sumiller.
                const sinNumero = (visto?.tramos ?? []).filter((t, i) => tramos[i]?.missing > 0 && ! t.texto).length;
                const recortados = (visto?.tramos ?? []).filter((t) => t.recortado).length;

                // Y el número del hueco tiene que LEERSE. El "-1" gris sobre rayado gris estaba
                // pintado y no se veía: es exactamente este caso.
                const ilegibles = (visto?.tramos ?? []).filter((t) => t.contraste !== null && t.contraste < 4.5);
                const peorTira = Math.min(...(visto?.tramos ?? []).map((t) => t.contraste).filter((c) => c !== null), Infinity);

                /*
                 * ⚠️ UN SOLO EJE X PARA TODA LA CELDA. Y esto casi se me escapa.
                 *
                 * Al indentar los carriles bajo su nombre, las PISTAS se movieron 18 px a la
                 * derecha y la TIRA se quedó donde estaba. Las 15:00 de la barra de Tomás
                 * dejaron de caer sobre las 15:00 de su hueco: el eje mentía por 18 px.
                 *
                 * Y con él se iba la única lectura que esta parrilla presume de dar sin leer
                 * —la vertical: "aquí falta gente justo a esta hora"—. Lo cazó el otro
                 * instrumento, no este. Ahora lo caza este.
                 */
                const desalineadas = (visto?.carriles ?? []).filter((c) => (
                    Math.abs(c.pista.x - (visto.tira?.x ?? c.pista.x)) > 1
                    || Math.abs(c.pista.ancho - (visto.tira?.ancho ?? c.pista.ancho)) > 1
                ));

                const ok = JSON.stringify(esperado) === JSON.stringify(pintadoTira)
                    && ! sinNumero && ! recortados && ! desalineadas.length && ! ilegibles.length;

                if (! ok) {
                    noes++;
                }

                filas.push({
                    semana: etiqueta,
                    celda: `${position.name} · ${day.weekday} ${day.label}`,
                    persona: '— tira de cobertura —',
                    turno: tramos.map((s) => s.label).join(' + '),
                    barras: '',
                    rotulos: '',
                    dicen: pintadoTira.join(' | ') || '—',
                    sitio: esperado.join(' | ') || '—',
                    notas: desalineadas.length
                        ? `⚠ ${desalineadas.length} pistas desalineadas del eje`
                        : 'eje alineado con las pistas',
                    dueno: 'SÍ (es de la celda)',
                    lee: ilegibles.length
                        ? `❌ "${ilegibles[0].texto}" a ${ilegibles[0].contraste}`
                        : (peorTira === Infinity ? '— (sin número)' : `sí · peor ${peorTira.toFixed(1)}:1`),
                    ok,
                });
            }

            // ── Y EL CARTEL DE IMPOSIBLE: si el motor lo dice, tiene que estar. ──
            const hayImposible = turnos.some((t) => imposibles(t.id).length);

            if (hayImposible !== !! visto?.imposible) {
                noes++;

                filas.push({
                    semana: etiqueta,
                    celda: `${position.name} · ${day.weekday} ${day.label}`,
                    persona: '— cartel IMPOSIBLE —',
                    turno: '',
                    barras: '',
                    rotulos: '',
                    dicen: visto?.imposible ?? 'no está',
                    sitio: hayImposible ? 'el motor dice que SÍ' : 'el motor dice que NO',
                    dueno: '—',
                    lee: '—',
                    ok: false,
                });
            }
        }
    }
}

// ── La tabla ────────────────────────────────────────────────────────────────────────────

const COLS = [
    ['semana', 'Semana', 15],
    ['celda', 'Celda (puesto · día)', 24],
    ['persona', 'Persona', 22],
    ['turno', 'Turno / tramos (motor)', 30],
    ['barras', 'Barras v/e', 18],
    ['rotulos', 'Rót. v/e', 9],
    ['dicen', 'RÓTULOS pintados', 40],
    ['sitio', 'Sitio / tira ESPERADA', 30],
    ['notas', 'NOTAS pintadas', 46],
    ['dueno', '¿DE QUIÉN ES CADA COSA?', 30],
    ['lee', '¿SE LEE SIN ESFUERZO? (contraste)', 34],
];

const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));

console.log('\n' + COLS.map(([, t, n]) => pad(t, n)).join(' │ ') + ' │ ¿?');
console.log(COLS.map(([, , n]) => '─'.repeat(n)).join('─┼─') + '─┼───');

let anterior = null;

for (const f of filas) {
    if (anterior && anterior !== f.celda) {
        console.log(COLS.map(([, , n]) => ' '.repeat(n)).join(' │ ') + ' │');
    }

    anterior = f.celda;

    console.log(COLS.map(([k, , n]) => pad(String(f[k] ?? ''), n)).join(' │ ') + ' │ ' + (f.ok ? '✅' : '❌'));
}

console.log(`\n${noes ? '❌' : '✅'} ${filas.length} filas cotejadas · ${noes} discrepancias\n`);

await browser.close();
process.exit(noes ? 1 : 0);
