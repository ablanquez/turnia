/**
 * LA SEMÁNTICA DEL COLOR Y LA FORMA CORTA DE CADA AVISO, EN UN SOLO SITIO.
 *
 * Si cada componente decidiera su rojo, el día que cambie el criterio quedaría una copia
 * vieja pintando mentiras. Y en Turnia una mentira pintada es peor que un error: no parece
 * un fallo, parece un dato.
 *
 * ROJO = imposible · NARANJA = incumplimiento · ÁMBAR = aviso · VERDE = correcto.
 * La marca (índigo) nunca se usa para estado, y el estado nunca se usa para adornar.
 */

export const BRAND = '#7F77DD';
export const BRAND_DARK = '#534AB7';

/**
 * ⚠️ EL COLOR QUE RELLENA Y EL COLOR QUE ESCRIBE NO PUEDEN SER EL MISMO.
 *
 * El naranja de incumplimiento (#E8590C) es perfecto para una barra —vibrante, se ve de un
 * vistazo— y es ILEGIBLE como texto: sobre blanco da un contraste de 3,4, por debajo del
 * mínimo de 4,5 que hace falta para leer sin esfuerzo. Lo mismo el ámbar del aviso.
 *
 * Es la trampa de siempre en este proyecto: el color estaba "puesto" y no estaba "visto". Así
 * que van dos:
 *
 *   · fill → el relleno de la barra, de la muestra, del chip. Manda el vistazo.
 *   · text → la tinta de los avisos. Manda la lectura. Siempre ≥ 4,5 sobre el fondo de celda.
 *
 * Y no es un capricho de accesibilidad: un aviso que cuesta leer es un aviso que se ignora, y
 * un aviso ignorado no existe.
 */
const SEVERITY = {
    impossible: { rank: 3, fill: '#C81E1E', text: '#B01414', label: 'Imposible' },
    breach: { rank: 2, fill: '#E8590C', text: '#A8410A', label: 'Incumplimiento' },
    notice: { rank: 1, fill: '#C2870A', text: '#7D5606', label: 'Aviso' },
};

/**
 * EL VERDE NO ES UNA GRAVEDAD —no hay nada que arreglar— pero necesita LAS DOS FORMAS igual.
 *
 * Y estaba en tres sitios a la vez: ScheduleHeader escribía en #15803D (contraste 4,27: no llega),
 * useMatrizVisual tenía su propio #0F5C2C para el tramo cubierto, y app.css un tercero. Tres copias
 * del mismo hecho, y la que escribía texto era la única mala.
 */
export const OK_FILL = '#15803D';
export const OK_TEXT = '#0F5C2C';

/**
 * ⚠️ EL TINTE DE FONDO DE UN CHIP: el relleno de su gravedad, muy diluido.
 *
 * Estaba escrito a mano en ScheduleHeader —`rgba(232,89,12,.1)`, `rgba(194,135,10,.12)`…— con
 * alfas distintos y sin relación con nada. Un chip es un relleno lavado: se DERIVA, no se copia.
 */
export function severityChip(severity) {
    const fill = severity === 'ok' ? OK_FILL : severityFill(severity);
    const text = severity === 'ok' ? OK_TEXT : severityColor(severity);

    const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));

    return { background: `rgba(${r},${g},${b},.12)`, color: text };
}

/**
 * LA FORMA CORTA DE CADA REGLA.
 *
 * En la celda cabe una línea. El mensaje completo del motor —"Se pasa del tope semanal:
 * quedaría en 42h 00min de un máximo de 40h 00min."— ocupa dos, se repite seis días
 * seguidos y estira la celda al triple. La parrilla se lee de un vistazo o no se lee.
 *
 * El texto largo NO se pierde: va en el `title` de la barra. Se pide, no se impone.
 */
const CORTO = {
    overlap: '● Solape imposible',
    unavailable: '● Ausente ese día',
    contract_inactive: '● Fuera de la vigencia del contrato',
    invalid_interval: '● Intervalo imposible',
    shift_too_long: '● Turno de más de 24 h',

    hour_limit: '⚠ Se pasa del tope de horas',
    shift_length: '⚠ Turno demasiado largo',
    minimum_rest: '⚠ Descanso corto entre turnos',
    workday_type: '⚠ El perfil no admite esta jornada',
    eligibility: '⚠ No cualificado para el puesto',
    overtime_limit: '⚠ Se pasa del tope de horas extra',

    shared_workday: '↗ También trabaja en otra empresa',
    missing_profile: '· Contrato sin condiciones definidas',
};

export function shortText(violation) {
    return CORTO[violation.code] ?? violation.message;
}

/** La gravedad que manda de una lista: la peor. */
export function worst(violations) {
    if (!violations || violations.length === 0) {
        return null;
    }

    return violations.reduce((peor, v) => {
        const actual = SEVERITY[v.severity];
        return !peor || actual.rank > SEVERITY[peor].rank ? v.severity : peor;
    }, null);
}

/** La TINTA de un aviso: la que se lee. Nunca la que rellena. */
export function severityColor(severity) {
    return SEVERITY[severity]?.text ?? null;
}

/** El RELLENO: barras, muestras, chips. El que se ve de un vistazo. */
export function severityFill(severity) {
    return SEVERITY[severity]?.fill ?? null;
}

/** El icono de estado del carril: dice QUÉ pasa, no solo que pasa algo. */
export function severityIcon(severity) {
    return { impossible: '●', breach: '⚠', notice: '↗' }[severity] ?? '';
}
