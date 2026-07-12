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

const SEVERITY = {
    impossible: { rank: 3, color: '#C81E1E', label: 'Imposible' },
    breach: { rank: 2, color: '#E8590C', label: 'Incumplimiento' },
    notice: { rank: 1, color: '#C2870A', label: 'Aviso' },
};

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

export function severityColor(severity) {
    return SEVERITY[severity]?.color ?? null;
}

/** El icono de estado del carril: dice QUÉ pasa, no solo que pasa algo. */
export function severityIcon(severity) {
    return { impossible: '●', breach: '⚠', notice: '↗' }[severity] ?? '';
}
