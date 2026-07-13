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

    const pintado = {};

    for (const celda of document.querySelectorAll('[data-t=celda]')) {
        const tira = celda.querySelector('[data-t=tira]');
        const cajaTira = tira ? caja(tira) : null;

        pintado[celda.dataset.celda] = {
            imposible: celda.querySelector('[data-t=imposible]')?.textContent.trim() ?? null,
            sinCandidato: !!celda.querySelector('[data-t=sin-candidato]'),

            carriles: [...celda.querySelectorAll('[data-t=carril]')].map((l) => {
                const pista = caja(l.querySelector('[data-t=pista]'));

                return {
                    persona: l.dataset.persona,
                    pista: { x: pista.left, ancho: pista.width },
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
                    // El texto TAL COMO HA QUEDADO PINTADO.
                    rotulos: [...l.querySelectorAll('[data-t=rotulo]')].map((r) => r.textContent.trim().replace(/\s+/g, ' ')),
                    notas: [...l.children]
                        .filter((e) => !e.hasAttribute('data-t') && e.textContent.trim() && !e.querySelector('[data-t=nombre]'))
                        .map((e) => e.textContent.trim().replace(/\s+/g, ' ')),
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

            for (const [personId, suyos] of porPersona) {
                const nombre = persona(personId);
                const carril = visto?.carriles.find((c) => c.persona === nombre);

                suyos.sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);

                const esperados = suyos.map((b) => (b.kind === 'concept'
                    ? `◷ ${b.name} · ${b.label}`
                    : b.label));

                const barrasOk = carril?.barras.length === suyos.length;
                const rotulosOk = JSON.stringify(carril?.rotulos ?? []) === JSON.stringify(esperados);

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

                for (const b of suyos) {
                    if (b.crossesMidnight && ! notas.some((n) => n.includes(b.label) && n.includes('medianoche'))) {
                        fallosDeNota.push(`el nocturno ${b.label} no dice su hora`);
                    }

                    if (b.kind === 'concept' && ! notas.some((n) => n.includes('no cubre puesto'))) {
                        fallosDeNota.push(`${b.name} no avisa de que no cubre puesto`);
                    }

                    if (b.forced && ! notas.some((n) => n.includes('Forzado'))) {
                        fallosDeNota.push('un turno forzado sin constancia');
                    }
                }

                // Cada regla rota del motor tiene que aparecer en alguna nota. Si el motor ve
                // tres cosas y la celda cuenta dos, una se ha perdido por el camino.
                const reglas = new Set(suyos.filter((b) => b.kind === 'shift')
                    .flatMap((b) => (motor.violations.assignments[b.id] ?? []).map((v) => v.code)));

                if (notas.length < reglas.size) {
                    fallosDeNota.push(`${reglas.size} reglas rotas y solo ${notas.length} notas`);
                }

                const ok = !! carril && barrasOk && rotulosOk && sitioOk && apiladasOk && ! fallosDeNota.length;

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
                    dicen: (carril?.rotulos ?? []).join(' | ') || '—',
                    notas: fallosDeNota.length ? '⚠ ' + fallosDeNota.join('; ') : (notas.join(' | ') || '—'),
                    sitio: barrasOk ? `±${desvio.toFixed(1)}px` : '—',
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

                const ok = JSON.stringify(esperado) === JSON.stringify(pintadoTira) && ! sinNumero && ! recortados;

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
