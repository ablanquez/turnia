/**
 * LA SEMÁNTICA DEL COLOR, EN UN SOLO SITIO.
 *
 * Si cada componente decidiera su rojo, el día que cambie el criterio quedaría una
 * copia vieja pintando mentiras. Y en Turnia una mentira pintada es peor que un
 * error: no parece un fallo, parece un dato.
 *
 * ROJO = imposible · NARANJA = incumplimiento · ÁMBAR = aviso · VERDE = correcto.
 * La marca (índigo) nunca se usa para estado, y el estado nunca se usa para adornar.
 */

const SEVERITY = {
    impossible: { rank: 3, color: '#C81E1E', label: 'Imposible' },
    breach: { rank: 2, color: '#E8590C', label: 'Incumplimiento' },
    notice: { rank: 1, color: '#C2870A', label: 'Aviso' },
};

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

export function severityLabel(severity) {
    return SEVERITY[severity]?.label ?? '';
}

/**
 * El relleno de una barra según su estado.
 *
 * El imposible va RAYADO además de rojo: en una parrilla llena de barras de color,
 * el rojo solo se pierde. La textura se ve aunque no mires.
 */
export function barFill(severity, personColor) {
    if (severity === 'impossible') {
        return 'repeating-linear-gradient(45deg, rgba(200,30,30,.55) 0 4px, rgba(200,30,30,.2) 4px 8px)';
    }

    if (severity === 'breach') {
        return SEVERITY.breach.color;
    }

    return personColor;
}
