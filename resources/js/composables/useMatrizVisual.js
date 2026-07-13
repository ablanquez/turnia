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
 *   3. ANILLO (fuera)      → ¿QUÉ GRAVEDAD TIENE? rojo / naranja / ámbar / ninguno
 *   4. ESTILO del borde    → ¿QUÉ ES?             continuo = turno · discontinuo = concepto
 *   5. MUESCA (esquina)    → ¿SE FORZÓ?           una decisión tomada, no un aviso desatendido
 *   6. FILO (borde del día) → ¿CRUZA MEDIANOCHE?  "sigue mañana"
 *
 * Y la POSICIÓN Y EL ANCHO no son un canal: son el eje X, y solo dicen CUÁNDO. Jamás otra cosa.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ LA GRAVEDAD VA POR FUERA DE LA BARRA. Y ESO NO ES UN DETALLE DE CSS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Durante dos tandas la gravedad fue un BORDE, o sea: tinta DENTRO de la barra. Y una barra de
 * la semana mide 10 px, así que un borde de 2 px arriba y 2 abajo es el CUARENTA POR CIENTO de
 * la barra. El ojo no ve dos canales: ve UNA MEZCLA. Medido (ΔE00 sobre la imagen):
 *
 *     Marco  #5C4460  + borde ámbar   →  #855F3E   marrón     · ΔE 10,1 de la tinta de aviso
 *     Iker   #14748A  + borde ámbar   →  #5A7C57   VERDE      · ΔE 10,2 del verde de COBERTURA
 *     Marco  #5C4460  + borde naranja →  #944C3E   ladrillo   · ΔE 11,1 de la tinta de imposible
 *
 * La segunda línea es la que da miedo: una barra CON UN AVISO se veía del color que esta app usa
 * para decir "cobertura correcta". Y la mezcla se alejaba ΔE 20–31 del color de la persona, así
 * que el borde también se estaba comiendo la ley 2 — la misma que subir de 8 a 10 px solo alivió.
 *
 * La paleta NO tenía la culpa: ningún color de persona está a menos de ΔE 29,6 de un color de
 * estado. La culpa era de meter dos canales en el mismo espacio físico.
 *
 * Ahora la gravedad es un ANILLO POR FUERA (outline): no ocupa ni un píxel del relleno, no se
 * mezcla con nada, y el relleno conserva sus 10 px enteros de persona. Dos preguntas, dos
 * espacios. Es la ley 0 en su forma más literal.
 *
 * Y el GROSOR del anillo sube con la gravedad (aviso 1,5 · incumplimiento 2 · imposible 3): la
 * misma pregunta contestada dos veces, que es lo que la ley 6 pide y no lo que la ley 0 prohíbe.
 * Lo que la ley 0 prohíbe es un canal con DOS preguntas, no una pregunta con DOS canales.
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
 * EL BORDE YA NO DICE LA GRAVEDAD: SOLO DICE QUÉ ES. Continuo = turno · discontinuo = concepto.
 *
 * Y se pinta con el color de la PERSONA, no con un gris neutro: en un concepto hueco el borde
 * es toda la forma que hay, y también ahí tiene que poder reconstruirse de quién es.
 */
function bordeDe(block, person) {
    const estilo = block.kind === 'concept' ? 'dashed' : 'solid';

    return `1.5px ${estilo} ${person.color}`;
}

/**
 * EL GROSOR DEL ANILLO SUBE CON LA GRAVEDAD. La misma pregunta, contestada dos veces.
 *
 * ⚠️ Y LOS TRES NÚMEROS SALEN DE UNA MEDIDA, NO DE UN GUSTO.
 *
 * El imposible empezó en 2 px y la barra de Tomás —dos turnos que se pisan— se veía AZUL con una
 * textura rara: el rojo era un filete y el relleno mandaba. A 3 px y por fuera se volvió una
 * cápsula roja con el color de Tomás dentro.
 *
 * Y entonces el que se quedó corto fue el INCUMPLIMIENTO: a 2 px sobre una barra de 12, el
 * naranja de Sara se leía como un borde, no como una alarma. Subirlo a 3 no era gratis —cada
 * píxel de anillo se lo quita al relleno, y con la paleta de entonces el margen se iba a −2,4—,
 * así que se recalculó todo junto: alto de barra, grosores y paleta, en un solo cálculo.
 *
 *   aviso 2 · incumplimiento 3 · imposible 4, sobre una barra de 16 px.
 *
 * El aviso se queda fino A PROPÓSITO: informa, no pide nada (ley 14). Los dos que PIDEN UNA
 * DECISIÓN son los gordos. El grosor dice lo mismo que el cartel.
 *
 * ⚠️ Si tocas estos números, hay que REGENERAR LA PALETA (tests/Visual/paleta.mjs): los doce
 * colores están calculados CON esta geometría dentro, y sin ella la garantía no vale.
 */
const ANILLO = { notice: '2px', breach: '3px', impossible: '4px' };

/**
 * ⚠️ EL ANILLO NO RODEA: SON DOS FRANJAS, ARRIBA Y ABAJO. Y ESO NO ES ESTÉTICA: ES LA LEY 0.
 *
 * Era un `outline`, o sea un anillo que rodea la barra por los CUATRO lados. Y ahí el peso del
 * anillo —lo que el ojo integra— es 1 − (ancho×alto)/((ancho+2w)(alto+2w)): DEPENDE DEL ANCHO.
 *
 * En un turno de ocho horas la barra mide 50 px y el anillo pesa el 35 %. En un turno de UNA hora
 * mide 5 px y ese mismo anillo pasa a pesar el SESENTA Y SIETE POR CIENTO. Medido sobre la imagen:
 *
 *     barra de  5 px · anillo 67 %  →  el peor color queda a ΔE  5,8 de una gravedad AJENA  ❌
 *     barra de 29 px · anillo 40 %  →  ΔE 17,5                                              ❌
 *     barra de 50 px · anillo 35 %  →  ΔE 20,1                                              ✅
 *
 * O sea: un turno de una hora con un aviso ámbar se veía MARRÓN. El bug de Marco otra vez, y esta
 * vez la culpa no era del color: era que EL CANAL CAMBIABA DE PESO CON LA GEOMETRÍA. Un canal que
 * significa una cosa u otra según lo ancha que sea la barra no es un canal: es una lotería. Y la
 * paleta estaba calibrada a un ancho concreto (50 px), así que solo era cierta ahí.
 *
 * Con dos franjas por fuera (box-shadow, que no come relleno), el peso es 2w/(ALTO+2w) y NO
 * DEPENDE DEL ANCHO: 20 % / 27 % / 33 %, siempre. El problema del turno corto DESAPARECE POR
 * CONSTRUCCIÓN, no por ajuste. Y contamina menos que el anillo que rodeaba, incluso en barras
 * anchas.
 *
 * ⚠️ Y NI LA DEMO NI LOS 96 CASOS DEL CUADRANTE LO HABRÍAN ENSEÑADO NUNCA: todos usan turnos de
 * ocho horas. El peor caso geométrico de la app no estaba sembrado en ninguna parte. Ahora sí
 * (MatrizSeeder::anchos → tests/Visual/anchos.mjs).
 *
 * severityFill() → #C2870A / #E8590C / #C81E1E. Vibrantes: una marca no se lee, se VE. Con la
 * TINTA (severityColor) el aviso salía marrón sucio y ni siquiera parecía ámbar.
 */
function anilloDe(severidad, escala = 1) {
    if (!severidad) {
        return {};
    }

    const px = parseFloat(ANILLO[severidad]) * escala;
    const color = severityFill(severidad);

    // Dos copias de la barra, desplazadas arriba y abajo. Sin desenfoque y sin extensión: lo único
    // que asoma son `px` píxeles de color, con el mismo redondeo que la barra.
    return {
        boxShadow: `0 -${px}px 0 0 ${color}, 0 ${px}px 0 0 ${color}`,
    };
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
export function pintarBloque(block, { person, violations, gritadas = null, escala = 'semana' }) {
    const rotas = violacionesDe(block, violations);
    const severidad = worst(rotas);

    const base = {
        background: rellenoDe(block, person, severidad, escala),
        border: bordeDe(block, person),
        boxSizing: 'border-box',
    };

    return {
        severidad,
        densidad: densidadDe(block, severidad),

        relleno: { ...base, ...anilloDe(severidad) },

        // La muestra del rótulo mide 10×7: el anillo va a la mitad, o se comería la muestra
        // entera. Mismo relleno, mismo anillo, otra escala — por eso se emparejan de un vistazo.
        muestra: { ...base, ...anilloDe(severidad, 0.5) },

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
        notas: notasDe(block, rotas, gritadas),
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
function notasDe(block, rotas, gritadas) {
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

    if (block.forced && ! rotas.length) {
        añadir('⚠', 'Forzado, con constancia', severityColor('breach'));
    }

    for (const v of rotas) {
        if (cubiertaPorCartel(block, v, gritadas)) {
            // El cartel se lleva el motivo. Pero NO dice que el turno esté forzado, y eso es
            // justo lo que hay que saber: que la decisión ya se tomó y hay constancia de ella.
            if (block.forced) {
                añadir('⚠', 'Forzado, con constancia', severityColor('breach'));
            }

            continue;
        }

        // "⚠ 08:00–16:00 · Forzado · descanso corto entre turnos", en UNA nota. Separar el
        // "forzado" de su motivo daba dos líneas para un solo hecho.
        const texto = block.forced ? `Forzado · ${sinIcono(shortText(v))}` : sinIcono(shortText(v));

        añadir(severityIcon(v.severity), texto, severityColor(v.severity), v.severity === 'notice');
    }

    return out;
}

/**
 * LEY 9: LO QUE LA CELDA YA GRITA, EL CARRIL NO LO REPITE.
 *
 * El solape de Tomás se decía TRES veces —el cartel, y una nota por cada una de sus dos barras—
 * cuando las dos barras pisándose YA LO ENSEÑAN. El ruido entrena a no leer.
 *
 * ⚠️ PERO "GRITA" TIENE QUE SIGNIFICAR "GRITA ESTE BLOQUE", NO "GRITA ALGO PARECIDO".
 *
 * El cartel naranja NO recoge los incumplimientos de un turno FORZADO (ver cartelesDe). Si aquí
 * bastara con `gritadas.has('breach')`, una celda con dos personas —una incumpliendo sin forzar
 * y otra forzada— haría que el cartel de la primera CALLASE la nota de la segunda, y el motivo
 * del turno forzado desaparecería de la pantalla. Un silencio falso construido por una regla de
 * silencio: el ruido se combate quitando REPETICIONES, no datos.
 */
function cubiertaPorCartel(block, v, gritadas) {
    if (! gritadas?.has(v.severity)) {
        return false;
    }

    return v.severity === 'impossible' || ! block.forced;
}

/* ══════════════════════════════════════════════════════════════════════════════
 * LOS CARTELES DE UNA CELDA
 * ══════════════════════════════════════════════════════════════════════════════ */

/**
 * EL CARTEL ES PARA LO QUE PIDE UNA DECISIÓN. NO PARA LO QUE SIMPLEMENTE OCURRE.
 *
 * Ese criterio es la mitad del diseño; la otra mitad —qué va y qué no— sale de él sola.
 *
 * VA A CARTEL lo que EXIGE que alguien haga algo:
 *   · IMPOSIBLE       → hay que quitarlo o cambiarlo                        (rojo)
 *   · INCUMPLIMIENTO  → hay que decidir si se fuerza o se arregla           (naranja)
 *   · SIN CANDIDATO   → hay que cualificar a alguien o cambiar el requisito (gris)
 *
 * NO VA A CARTEL lo que solo informa: una hora médica, un permiso o una hora extra (el bloque ya
 * está ahí, con su forma y su etiqueta); una baja o unas vacaciones (la banda ya lo dice); un
 * "también trabaja en otra empresa" (dato útil, ninguna acción).
 *
 * Y el motivo es el mismo por el que existe esta matriz: UN CUADRANTE EN LLAMAS NO IMPRESIONA,
 * ALARMA. Si cada hora médica levantase un cartel rojo, la parrilla se llenaría de alarmas que no
 * piden nada y el encargado aprendería a no mirarlas. Un aviso que se ignora no existe.
 *
 * ⚠️ EL INCUMPLIMIENTO YA FORZADO NO LLEVA CARTEL, y eso sale del mismo criterio: el cartel
 * naranja dice "hay que decidir si se fuerza o se arregla", y ahí YA SE DECIDIÓ, con constancia.
 * No se esconde nada —la barra conserva su anillo naranja, su muesca y su nota "Forzado, con
 * constancia"—: lo que no hace es pedir una decisión que ya está tomada.
 *
 * ⚠️ Y ESTA TABLA VIVE AQUÍ, NO EN LOS COMPONENTES. La constante IMPOSIBLE estaba DUPLICADA en
 * WeekGrid.vue y en DayGrid.vue, que es exactamente lo que la ley 13 prohíbe: el día que cambie
 * un motivo, una de las dos copias se queda pintando la versión vieja y nadie se entera.
 */
const MOTIVO = {
    overlap: 'solape de la misma persona',
    unavailable: 'la persona está ausente',
    contract_inactive: 'fuera de la vigencia del contrato',
    invalid_interval: 'intervalo imposible',
    shift_too_long: 'más de 24 horas',

    hour_limit: 'se pasa del tope de horas',
    shift_length: 'turno demasiado largo',
    minimum_rest: 'descanso corto entre turnos',
    workday_type: 'el perfil no admite esta jornada',
    eligibility: 'no cualificado para el puesto',
    overtime_limit: 'se pasa del tope de horas extra',
};

const CARTEL = {
    impossible: { titulo: 'IMPOSIBLE', bg: severityFill('impossible') },
    breach: { titulo: 'INCUMPLIMIENTO', bg: severityFill('breach') },
};

/**
 * LOS CARTELES DE UNA CELDA: en orden de gravedad, y APILADOS.
 *
 * Se apilan porque son HECHOS INDEPENDIENTES (ley 0): una celda puede ser imposible Y además no
 * tener a nadie cualificado en el catálogo. Eran `v-if` / `v-else-if`, y la segunda no se veía.
 *
 * El cartel dice QUÉ pasa. QUIÉN y CUÁNDO los siguen diciendo la barra (su color, su anillo) y su
 * rótulo (su hora): el cartel no repite lo que otro canal ya lleva.
 */
export function cartelesDe(blocks, violations, { sinCandidato = false } = {}) {
    const out = [];

    for (const severidad of ['impossible', 'breach']) {
        const motivos = [...new Set(
            blocks
                .filter((b) => severidad === 'impossible' || ! b.forced)
                .flatMap((b) => violacionesDe(b, violations))
                .filter((v) => v.severity === severidad)
                .map((v) => MOTIVO[v.code] ?? 'revisar'),
        )];

        if (motivos.length) {
            out.push({
                severidad,
                texto: `${CARTEL[severidad].titulo} · ${motivos.join(' · ')}`,
                bg: CARTEL[severidad].bg,
            });
        }
    }

    if (sinCandidato) {
        // Gris, y no naranja, porque el problema NO está en el cuadrante: está en el catálogo.
        // Ninguna combinación de personas arregla un puesto que nadie de la plantilla sabe cubrir.
        out.push({ severidad: 'catalog', texto: 'SIN CANDIDATO EN CATÁLOGO', bg: '#5A5A66' });
    }

    return out;
}

/** Las gravedades que la celda ya grita: lo que el carril NO debe repetir. */
export function gritadasDe(carteles) {
    return new Set(carteles.map((c) => c.severidad));
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
            // Ley 3: el borde se ve, no se lee. Con la TINTA (severityColor) salía marrón sucio,
            // el mismo error que tenía la barra. Aquí no contamina el relleno —1 px sobre una
            // banda de 16— así que sigue siendo un borde y no hace falta sacarlo fuera.
            borderColor: severityFill(severidad) ?? BANDA_BORDE,
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
