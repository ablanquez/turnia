/*
 * IDENTIDAD — el color de cada persona.
 *
 * ⚠️ Es DATO, no decoración: se reparte por ÍNDICE (nunca por hash — un hash módulo N colisiona, y
 * colisionaba: dos personas de la misma empresa con el mismo color). Y se pinta EN LÍNEA
 * (`:style="{ background: color }"`), no como utilidad de Tailwind: por eso vive aquí, en datos, y
 * no en tokens.css.
 *
 * Los 12 valores son LITERALES heredados del Turnia viejo (PersonPalette.php): maximizan el ΔE00
 * mínimo entre cualquier par (16,1), con croma ≥ 30 y luminosidad L* 31→78. No se recalculan —
 * son la fuente de verdad. El código que los reparte, sí se escribe limpio.
 */
export const IDENTIDAD = [
    '#2490B4', '#085C88', '#54588C', '#7C7CB0', '#C484FC', '#A830A4',
    '#44BCFC', '#789CFC', '#4068E8', '#905CDC', '#64249C', '#F45CC8',
];

/** El color de la persona nº `indice` (estable: la misma persona, el mismo color, siempre). */
export function colorDe(indice) {
    return IDENTIDAD[((indice % IDENTIDAD.length) + IDENTIDAD.length) % IDENTIDAD.length];
}
