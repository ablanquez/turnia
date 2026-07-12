/**
 * LA REJILLA DE FONDO DE LAS PISTAS.
 *
 * La referencia la fija en porcentajes: 25 % en la semana (una línea cada 6 h) y 12,5 % en
 * el día (cada 3 h). Le vale porque su eje SIEMPRE mide 24 h.
 *
 * El nuestro no: se ensancha si algo cae fuera de 06:00–06:00 (la panadería que entra a
 * las 04:00). Con porcentajes fijos, las líneas dejarían de caer en horas redondas y la
 * rejilla pasaría a mentir sobre la escala. Así que se calcula EN HORAS.
 *
 * Es la consecuencia de haber decidido no recortar. La referencia manda en lo visual; no
 * manda en lo que miente.
 */
export function gridEvery(axis, horas) {
    const total = axis.to - axis.from;

    return `${(horas / total) * 100}% 100%`;
}
