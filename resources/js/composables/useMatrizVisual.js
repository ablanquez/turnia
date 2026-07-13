/**
 * LA MATRIZ VISUAL: EL ÚNICO SITIO QUE DECIDE CÓMO SE PINTA CADA COSA.
 *
 * ⚠️ LEE docs/MATRIZ-VISUAL.md ANTES DE TOCAR ESTO. Ese documento manda sobre este fichero.
 *
 * Durante siete tandas la representación vivió repartida por los componentes Vue, decidida
 * sobre la marcha. Y cada tanda destapó una casuística nueva, siempre por el mismo motivo: un
 * canal visual haciendo DOS trabajos. El gris significaba a la vez "cubierto" y "no se pide
 * nada". El naranja, a la vez "forzado" e "incumple". El índigo, a la vez "esta persona" y
 * "cruza medianoche". Dos casos distintos, el mismo píxel — que es la forma más silenciosa que
 * tiene esta app de mentir.
 *
 * Esto no es una lista de casos: es un SISTEMA DE COMPOSICIÓN. De las dimensiones de un bloque
 * salen cientos de combinaciones, y no se enumeran: se derivan. Si una combinación no cae en
 * ninguna regla, FALTA UNA REGLA — no falta un caso.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LOS SEIS CANALES DE UNA BARRA. UNO POR PREGUNTA, Y NINGUNO CON DOS ENCIMA:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. COLOR del relleno   → ¿DE QUIÉN ES?        el color de la persona. Nunca el estado.
 *   2. DENSIDAD del relleno → ¿CUÁNTO CUENTA?     sólido / tramado / hueco (ver abajo)
 *   3. COLOR del borde     → ¿QUÉ GRAVEDAD TIENE? rojo / naranja / ámbar / ninguna
 *   4. ESTILO del borde    → ¿QUÉ ES?             continuo = turno · discontinuo = concepto
 *   5. MUESCA (esquina)    → ¿SE FORZÓ?           una decisión tomada, no un aviso desatendido
 *   6. FILO (borde del día) → ¿CRUZA MEDIANOCHE?  "sigue mañana"
 *
 * Y la POSICIÓN Y EL ANCHO no son un canal: son el eje X, y solo dicen CUÁNDO. Jamás otra cosa.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA DENSIDAD ES UNA ESCALA, Y SE LEE SIN APRENDERLA:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   SÓLIDO   → cubre el puesto.                    (turno normal)
 *   TRAMADO  → NO cubre el puesto, pero cuenta.    (turno imposible · concepto que computa)
 *   HUECO    → NO cubre el puesto y NO computa.    (concepto que solo ocupa)
 *
 * Y es la MISMA trama de la tira de cobertura, con el mismo significado: "esto no se resuelve
 * poniendo a alguien aquí". Un turno imposible no cubre porque la persona no puede estar; un
 * hueco incubrible no se cubre porque no hay a quién poner. La textura dice lo mismo en las
 * dos capas, y por eso no hay que aprenderla dos veces.
 */

import { BRAND_DARK, severityColor, severityFill, severityIcon, shortText, worst } from './useSeverity.js';

/**
 * LA TRAMA. Una sola, y siempre la misma.
 *
 * Suave a propósito: tiene que VERSE sin comerse lo que lleva encima. Con el rayado al 30 % el
 * "-1" del sumiller competía con las rayas; con un velo detrás del número, el velo se comía las
 * rayas. Ni una cosa ni la otra.
 */
export const TRAMA = 'repeating-linear-gradient(45deg, rgba(44,38,67,.30) 0 3px, transparent 3px 7px)';

/** La trama de la tira: más suave, porque debajo lleva un rojo fuerte y encima un número. */
export const TRAMA_TIRA = 'repeating-linear-gradient(45deg, rgba(60,56,84,.20) 0 4px, transparent 4px 9px)';

/**
 * ⚠️ LA TRAMA DE LA BANDA ES OTRA, Y NO ES UN CAPRICHO: ES QUE LA MISMA TEXTURA NO ESCALA.
 *
 * Reutilicé la trama de la barra —3 px de raya cada 7— y en una barra de 8 px se lee como una
 * textura, pero en una banda de 16 px que además lleva TEXTO ENCIMA se lee como cinta de obra:
 * un tachón que se come el "Ana López · Baja médica". Y como la baja se pinta ahora en todas las
 * filas que esa persona puede cubrir, eran ocho bloques rayados gritando a la vez.
 *
 * Misma gramática (rayas = aquí no hay servicio), otro volumen. Lo vi al abrir la página; los
 * tres tests estaban en verde.
 *
 * ⚠️ SEGUNDO INTENTO, Y EL PRIMERO SEGUÍA SIENDO UN TACHÓN. Bajé la raya a 2 px cada 8 al 16 %
 * y seguía compitiendo con el "Ana López · Baja médica" que lleva encima. Una banda no es una
 * barra: es un RÓTULO, y en un rótulo el texto manda.
 *
 * Ahora es una raya fina —1,5 px cada 8, al 11 %— que se ve como una textura y no como un
 * tachado. Sigue diciendo lo mismo (esta ausencia BLOQUEA la disponibilidad) y deja leer.
 */
export const TRAMA_BANDA = 'repeating-linear-gradient(45deg, rgba(60,52,137,.11) 0 1.5px, transparent 1.5px 8px)';

const DENSIDAD = { solido: 'solido', tramado: 'tramado', hueco: 'hueco' };

/** Las violaciones de ESTE bloque, venga de donde venga. Turno o concepto: el mismo trato. */
export function violacionesDe(block, violations) {
    if (!violations) {
        return [];
    }

    const fuente = block.kind === 'shift' ? violations.assignments : violations.conceptEntries;

    return fuente?.[block.id] ?? [];
}

/**
 * ¿CUÁNTO CUENTA ESTE BLOQUE? La escala de densidad, en un solo sitio.
 *
 * ⚠️ Un turno IMPOSIBLE no cubre el puesto. No es un matiz: si Tomás está en Caja de 10 a 18 y
 * de 14 a 20 a la vez, a las 15:00 en Caja NO HAY NADIE. El motor ya dejó de contarlo para la
 * cobertura (CoverageCalculator::$notCovering); aquí se dice también EN LA BARRA, para que la
 * pantalla y el número cuenten la misma historia.
 *
 * ⚠️ Y ningún concepto cubre puesto: la hora médica ocupa a Nuria, no atiende la barra. Lo que
 * cambia entre ellos es si SUMA TIEMPO a algún contador — que es la pregunta que el encargado
 * se hace de verdad: "¿le puedo dar otro turno?".
 */
export function densidadDe(block, severidad) {
    if (block.kind === 'concept') {
        return block.computa ? DENSIDAD.tramado : DENSIDAD.hueco;
    }

    return severidad === 'impossible' ? DENSIDAD.tramado : DENSIDAD.solido;
}

/**
 * El relleno de una barra. Color = quién. Densidad = cuánto cuenta. Nada más.
 *
 * ⚠️ LA ESCALA NO ES UN CANAL: es cuánta tinta cabe.
 *
 * En la semana la barra mide 8 px y no lleva texto dentro: el color va a plena intensidad y se
 * ve de un vistazo. En el zoom Día mide 30 px y lleva DENTRO el nombre y la hora, así que el
 * mismo color a plena intensidad haría ilegible el texto. Baja el alfa, y solo eso.
 *
 * Lo que NO cambia entre zooms es el SIGNIFICADO de ningún canal: el color sigue diciendo de
 * quién es, la densidad sigue diciendo cuánto cuenta, el borde sigue diciendo la gravedad. Dos
 * vistas del mismo hecho no pueden contarlo de dos maneras — que es exactamente lo que pasaba:
 * el zoom Día tenía su PROPIA tabla de colores, y el imposible era rojo aquí y rojo distinto
 * allí, y el nocturno tenía un tono en una vista y otro en la otra.
 */
function rellenoDe(block, person, severidad, escala) {
    const densidad = densidadDe(block, severidad);

    if (densidad === DENSIDAD.hueco) {
        return 'transparent';
    }

    /*
     * ⚠️ EL ALFA DEL DÍA ESTABA AL 15 %, Y A ESE ALFA NINGÚN COLOR IDENTIFICA A NADIE.
     *
     * Medido sobre la imagen renderizada (tests/Visual/pixeles.mjs): con 0x26, las barras del Día
     * daban #DDE5ED, #DCEAEE, #F4E0F0… — todo lavado, con ΔE00 de 2,5 · 3,7 · 6,6 entre personas
     * distintas. Diez pares indistinguibles. La ley 2 se cumplía en la Semana y no en el Día, y
     * una ley que se cumple según la vista no es una ley.
     *
     * 0x6E (43 %) es lo que hace falta para que el relleno identifique Y el nombre siga
     * leyéndose dentro de la barra. No es un número elegido: es el que pasa el instrumento.
     */
    const color = escala === 'dia' ? `${person.color}6E` : person.color;

    if (densidad === DENSIDAD.tramado) {
        // La trama va ENCIMA del color de la persona, no en vez de él: el bloque sigue
        // diciendo de quién es. Tapa los nombres de la celda y todavía puedes reconstruirlo.
        return `${TRAMA}, ${color}`;
    }

    return color;
}

/**
 * EL BORDE DICE LA GRAVEDAD, Y SU ESTILO DICE LA NATURALEZA. Dos preguntas, dos propiedades.
 *
 * ⚠️ EL NARANJA ERA DE DOS DUEÑOS, Y ESO ERA UN AVISO FALSO.
 *
 * Antes: `if (block.forced || severity === 'breach') → naranja`. Un turno FORZADO LIMPIO —uno
 * cuyo motivo ya no existe— se pintaba EXACTAMENTE igual que uno que INCUMPLE. Y son cosas
 * opuestas: el forzado es una decisión tomada con constancia; el incumplimiento es un aviso
 * que nadie ha atendido. El encargado veía naranja y no sabía cuál de las dos estaba mirando.
 *
 * Ahora el naranja es SOLO del incumplimiento, y el forzado tiene su muesca. Así un turno
 * forzado QUE ADEMÁS incumple enseña las DOS cosas, y uno forzado y limpio no finge un
 * problema que no tiene.
 */
function bordeDe(block, person, severidad) {
    const estilo = block.kind === 'concept' ? 'dashed' : 'solid';

    /*
     * ⚠️ EL BORDE ES UN RELLENO, NO UN TEXTO. Y LO ESTABA PINTANDO CON LA TINTA.
     *
     * Aquí ponía severityColor(), que devuelve la TINTA de la gravedad —#7D5606 para el aviso,
     * #A8410A para el incumplimiento—: colores oscuros y apagados, calculados para LEERSE como
     * letra sobre el fondo de la celda, con 4,5 de contraste.
     *
     * Pero un borde no se lee: se VE. Y con la tinta, el borde ámbar del aviso de Marco salía
     * marrón sucio, indistinguible de un borde de incumplimiento, y ni siquiera parecía ámbar.
     * La ley 3 dice "ámbar = aviso" y la barra no decía ámbar.
     *
     * Es MI PROPIA REGLA aplicada al revés ("el color que rellena y el color que escribe no
     * pueden ser el mismo"): tengo las dos versiones desde hace dos tandas, y usé la que no era.
     *
     * severityFill() → #C2870A / #E8590C / #C81E1E. Vibrantes, que es lo que hace falta para que
     * un borde de 2 px se vea de un vistazo.
     */
    const color = severityFill(severidad) ?? person.color;
    const grosor = severidad ? '2px' : '1.5px';

    return `${grosor} ${estilo} ${color}`;
}

/**
 * LA TINTA QUE SE LEE SOBRE UN COLOR DE PERSONA. Blanca o negra, la que contraste.
 *
 * La paleta ya no es toda de tonos medios: ahora va de un azul marino (L* 32) a un malva claro
 * (L* 74), porque la diferencia de LUMINOSIDAD es la única señal que sobrevive a una barra de
 * 10 px. Pero eso rompe la inicial blanca del avatar: blanco sobre #CEAAC6 da 2,1 de contraste,
 * que no se lee.
 *
 * Así que la inicial la decide el color, no una constante.
 */
export function tintaSobre(hex) {
    const n = parseInt(hex.slice(1), 16);

    const canal = (v) => {
        const c = v / 255;

        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };

    const L = 0.2126 * canal((n >> 16) & 255)
        + 0.7152 * canal((n >> 8) & 255)
        + 0.0722 * canal(n & 255);

    // El umbral que iguala los dos contrastes: por encima gana la tinta, por debajo el blanco.
    return L > 0.184 ? '#2C2643' : '#FFFFFF';
}

/**
 * CÓMO SE PINTA UN BLOQUE. La función que todo componente lee y ninguno discute.
 *
 * @param {object} block   turno o concepto, ya posicionado por el servidor
 * @param {object} ctx     { person, violations, celdaGrita }
 */
export function pintarBloque(block, { person, violations, celdaGrita = false, escala = 'semana' }) {
    const rotas = violacionesDe(block, violations);
    const severidad = worst(rotas);

    return {
        severidad,
        densidad: densidadDe(block, severidad),

        relleno: {
            background: rellenoDe(block, person, severidad, escala),
            border: bordeDe(block, person, severidad),
            boxSizing: 'border-box',
        },

        // La MUESCA: se forzó. Un canal propio, que no le quita el sitio a ningún otro.
        forzado: block.kind === 'shift' && !!block.forced,

        /*
         * EL FILO: cruza medianoche. Y ESTE ES EL CAMBIO MÁS IMPORTANTE DE LA TANDA.
         *
         * ⚠️ El nocturno se pintaba #534AB7 —un índigo— SUSTITUYENDO al color de la persona. Dos
         * fallos en uno: la barra dejaba de identificar a nadie (en una celda con tres personas
         * no sabías de quién era), y ese índigo es casi idéntico a los de la propia paleta de
         * personas (#5566B8, #6478C4, #6C74C6), así que ni siquiera decía "nocturno" de forma
         * fiable. El canal del relleno estaba llevando dos preguntas y contestando mal a las dos.
         *
         * Ahora la nocturnidad es una MARCA DE FORMA —un filo en el borde del día, "sigue
         * mañana"— y el relleno vuelve a significar SOLO una cosa: de quién es.
         */
        nocturno: !!block.crossesMidnight,

        rotulo: rotuloDe(block),
        notas: notasDe(block, rotas, celdaGrita),
    };
}

/**
 * UNA LÍNEA POR BLOQUE, Y CADA UNA CON SU HORA. La hora se lee: no se susurra.
 *
 * ⚠️ Y EL PIE DEL CONCEPTO DEJA DE MENTIR POR OMISIÓN.
 *
 * Decía "no cubre puesto" y se callaba lo otro: que una hora extra SÍ suma horas y una hora
 * médica NO. Los cuatro cómputos pintaban idéntico y decían lo mismo, y son cosas distintas
 * justo donde importa — cuando el encargado decide a quién puede cargarle otro turno.
 *
 * Los espacios son DUROS a propósito: sin ellos la frase rompía por donde le daba la gana
 * ("· no" arriba y "cubre puesto" abajo), y un "no" suelto al final de un renglón se lee fatal.
 */
function rotuloDe(block) {
    if (block.kind !== 'concept') {
        return { hora: block.label, pie: null };
    }

    const cuenta = block.computa ? 'cuenta horas' : 'no cuenta horas';

    return {
        hora: block.label,
        pie: `${block.name} · ${cuenta} · no cubre puesto`,
    };
}

const sinIcono = (texto) => texto.replace(/^[●⚠↗·]\s*/, '').toLowerCase();

/**
 * LAS NOTAS: UNA LÍNEA CADA UNA, Y TODAS CON SU SUJETO Y SU HORA.
 *
 * ⚠️ TODA NOTA EMPIEZA POR LA HORA DEL BLOQUE DEL QUE HABLA. SIN EXCEPCIÓN.
 *
 * Es la misma lección tres veces: "cruza medianoche" a secas no decía de qué turno; "no cubre
 * puesto" a secas no decía de qué bloque; y "descanso corto" en un carril con dos turnos no
 * diría en cuál. Un aviso sin sujeto obliga a deducir, y deducir en una parrilla es equivocarse.
 *
 * ⚠️ Y AHORA LOS CONCEPTOS TAMBIÉN TIENEN NOTAS, QUE ES UN SILENCIO QUE LLEVABA AQUÍ DESDE EL
 * PRINCIPIO. El motor calculaba sus violaciones, el payload las mandaba y la cabecera LAS
 * CONTABA — y la parrilla no las pintaba jamás, porque violationsOf() exigía kind === 'shift'.
 * Una hora extra que se pasa del tope no salía por ningún lado. Un silencio falso con contador.
 */
function notasDe(block, rotas, celdaGrita) {
    const out = [];
    const vistas = new Set();

    const añadir = (icono, texto, color, dot = false) => {
        const text = `${icono} ${block.label} · ${texto}`;

        if (!vistas.has(text)) {
            vistas.add(text);
            out.push({ text, color, dot });
        }
    };

    if (block.crossesMidnight) {
        añadir('☾', 'cruza medianoche', BRAND_DARK);
    }

    // "⚠ 08:00–16:00 · Forzado · descanso corto entre turnos", en UNA nota. Separar el "forzado"
    // de su motivo daba dos líneas para un solo hecho.
    if (block.forced && rotas.length) {
        for (const v of rotas) {
            if (v.severity === 'impossible' && celdaGrita) {
                añadir('⚠', 'Forzado, con constancia', severityColor('breach'));
                continue;
            }

            añadir(severityIcon(v.severity), `Forzado · ${sinIcono(shortText(v))}`, severityColor(v.severity));
        }

        return out;
    }

    if (block.forced) {
        añadir('⚠', 'Forzado, con constancia', severityColor('breach'));
    }

    for (const v of rotas) {
        // Ley 9: lo que la celda ya grita arriba, aquí no se repite. El solape de Tomás se decía
        // TRES veces —el cartel, y una nota por cada una de sus dos barras— cuando las dos
        // barras tramadas pisándose YA LO ENSEÑAN. El ruido entrena a no leer.
        if (v.severity === 'impossible' && celdaGrita) {
            continue;
        }

        añadir(severityIcon(v.severity), sinIcono(shortText(v)), severityColor(v.severity), v.severity === 'notice');
    }

    return out;
}

/* ══════════════════════════════════════════════════════════════════════════════
 * LA TIRA DE COBERTURA
 * ══════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ CUATRO ESTADOS, NO TRES. Y EL CUARTO EXISTE PORQUE EL TERCERO MENTÍA.
 *
 * Un turno de 10 a 18 contra una demanda declarada solo de 12 a 16 parte el día en tres, y en
 * los tramos de los bordes la demanda es CERO. Eso se pintaba índigo con un "+1" — igual que un
 * exceso real. Y no es lo mismo: no es que SOBRE uno, es que ahí NO SE PIDE NINGUNO. Dos hechos
 * distintos con el mismo píxel, que es el bug del gris otra vez, reencarnado en índigo.
 *
 * `unrequested` es neutro y NO lleva número: donde no se pide a nadie no hay déficit ni exceso
 * que dar. Y se distingue de los otros tres, que es lo único que se le pide.
 */
const ESTADO = {
    covered: { bg: 'var(--color-ok-fill)', border: 'var(--color-ok)', color: '#0F5C2C' },
    missing: { bg: 'var(--color-missing-fill)', border: 'var(--color-missing)', color: '#9E1616' },
    excess: { bg: 'var(--color-excess-fill)', border: 'var(--color-brand-300)', color: 'var(--color-brand-600)' },
    unrequested: { bg: '#EFEEF4', border: '#C9C6D6', color: 'transparent' },
};

/**
 * CÓMO SE PINTA UN TRAMO.
 *
 * ⚠️ EL DÉFICIT ES ROJO. EL RAYADO SE PONE ENCIMA. LOS DOS, A LA VEZ.
 *
 * "Faltan 2" y "no hay a quién poner" son DOS informaciones, y el rayado gris se comió a la
 * primera dos veces seguidas: antes con un "sin…" truncado, y después —ya con su número—
 * pintando gris sobre gris. El número estaba en el DOM y el hueco no estaba en el ojo.
 *
 * El rojo dice CUÁNTA GENTE FALTA. La trama dice que el problema NO SE ARREGLA COLOCANDO A
 * NADIE — está en el catálogo, no en el cuadrante. Ninguna de las dos tapa a la otra.
 */
export function pintarTramo(s) {
    const base = ESTADO[s.state] ?? ESTADO.unrequested;
    const rayado = !!s.uncoverable && s.state === 'missing';

    return {
        rayado,
        estilo: {
            background: rayado ? `${TRAMA_TIRA}, ${base.bg}` : base.bg,
            borderTop: `2px solid ${base.border}`,
            boxSizing: 'border-box',
        },
        // Sobre las rayas, un rojo más oscuro: el número tiene que ganarle a la textura.
        tinta: rayado ? '#8A1010' : base.color,
        escalones: escalonesDe(s),
        tip: tipDe(s),
    };
}

/**
 * ⚠️ NUNCA SE RECORTA UN DATO AL PINTARLO.
 *
 * Aquí ponía `truncate`, y en un tramo estrecho salía "sin…": ilegible Y sin el número. Un
 * rótulo a medias no es medio dato, es un error con aspecto de dato. Así que se BAJA DE
 * ESCALÓN: la frase entera, luego la cifra sola, y si no cabe ni la cifra, nada — el color
 * sigue diciendo qué pasa y el tooltip lo dice entero. Eso es degradar, no recortar.
 */
function escalonesDe(s) {
    if (s.state === 'missing') {
        return [`faltan ${s.missing}`, `-${s.missing}`];
    }

    if (s.state === 'excess') {
        return [`sobra${s.excess > 1 ? 'n' : ''} ${s.excess}`, `+${s.excess}`];
    }

    // Ni el correcto ni el "no se pide nada" llevan número: el verde ya lo dice, y donde no hay
    // demanda un "0" sería ruido con aspecto de dato.
    return [];
}

function tipDe(s) {
    const partes = [
        s.state === 'unrequested'
            ? `${s.label} · no se pide a nadie, hay ${s.covered}`
            : `${s.label} · pide ${s.required}, hay ${s.covered}`,
    ];

    if (s.uncoverable) {
        partes.push('nadie de la plantilla está cualificado para este puesto');
    }

    return partes.join(' · ');
}

/* ══════════════════════════════════════════════════════════════════════════════
 * LA BANDA DE AUSENCIA
 * ══════════════════════════════════════════════════════════════════════════════ */

const BANDA_BG = 'rgba(60,52,137,.13)';
const BANDA_BORDE = 'rgba(60,52,137,.28)';

/**
 * CÓMO SE PINTA UNA BANDA DE AUSENCIA.
 *
 * ⚠️ TRES CANALES QUE NO EXISTÍAN, Y TRES HECHOS QUE SE PERDÍAN:
 *
 *  · Una ausencia que BLOQUEA la disponibilidad y una que solo se registra (una formación) se
 *    pintaban idénticas. Ahora la que bloquea va tramada — la misma trama de siempre: "aquí no
 *    hay servicio".
 *
 *  · Una baja SIN ALTA (ends_on = null) se pintaba igual que una que simplemente continúa la
 *    semana que viene: mismo borde recto. Ahora la abierta se DESVANECE por la derecha y lo
 *    dice con letras.
 *
 *  · Y sus violaciones (cupo de vacaciones agotado, ausencias que se pisan, turnos que quedan
 *    al descubierto) no se pintaban en ninguna parte, aunque la cabecera LAS CONTABA.
 */
export function pintarBanda(banda, violations) {
    const rotas = violations?.absences?.[banda.id] ?? [];
    const severidad = worst(rotas);
    const abierta = banda.endsOn === null;

    const fondo = banda.blocks ? `${TRAMA_BANDA}, ${BANDA_BG}` : BANDA_BG;

    // El desvanecido solo tiene sentido en el ÚLTIMO día que se pinta: es el borde por el que
    // la baja "se va" sin final conocido.
    const seDesvanece = abierta && banda.esUltimo;

    return {
        severidad,
        abierta,
        seDesvanece,
        rotas,
        estilo: {
            background: fondo,
            borderStyle: 'solid',
            borderWidth: '1px',
            borderColor: severityColor(severidad) ?? BANDA_BORDE,
            borderLeftWidth: banda.esPrimero ? '1px' : '0',
            borderRightWidth: seDesvanece ? '0' : (banda.esUltimo ? '1px' : '0'),
            borderRadius: banda.esPrimero && banda.esUltimo ? '5px'
                : banda.esPrimero ? '5px 0 0 5px'
                    : banda.esUltimo && !seDesvanece ? '0 5px 5px 0'
                        : '0',
            ...(seDesvanece ? { maskImage: 'linear-gradient(to right, #000 55%, transparent 100%)' } : {}),
            boxSizing: 'border-box',
        },
        // Ley 6: lo que dice el desvanecido lo dice también una palabra.
        sufijo: abierta ? ' · sin alta' : '',
        notas: rotas.map((v) => ({
            text: `${severityIcon(v.severity)} ${banda.name} · ${sinIcono(shortText(v))}`,
            color: severityColor(v.severity),
        })),
    };
}
