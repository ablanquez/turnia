/*
 * RETIMAR UN TURNO — cambiar su hora conservando su DURACIÓN (Bloque 4 · tanda 2).
 *
 * Desplaza el turno a un nuevo inicio (en minutos, YA ajustado a la granularidad por quien llama) y
 * recalcula el fin sumando la duración original. NO cambia de duración —eso sería resize, ingrabbable
 * a 5,35 px/hora (ver bitácora/diseño)— ni de celda (eso es reubicar, tanda 1). Y como CONSERVA la
 * duración, partiendo de un turno válido nunca fabrica un turno de duración cero: el hallazgo del <=
 * de normaliza sigue teórico.
 *
 * ⚠️ Devuelve un array NUEVO, nunca muta (misma razón que moverTurno: la reactividad y no corromper
 * estado en sitios que no se esperan). Los campos originales inicio/fin (HH:MM) se sustituyen; normaliza
 * re-derivará iniMin/finMin, incluido el cruce de medianoche si el nuevo horario lo produce.
 */
import { minutos, formatoHora } from './useEje.js';

export function retimarTurno(turnos, id, nuevoInicioMin) {
    const t = turnos.find((x) => x.id === id);
    if (!t) return turnos; // id desconocido → no se toca nada
    let dur = minutos(t.fin) - minutos(t.inicio);
    if (dur <= 0) dur += 24 * 60; // el turno original cruzaba medianoche: la duración es la real
    const inicio = formatoHora(nuevoInicioMin);
    const fin = formatoHora(nuevoInicioMin + dur);
    if (inicio === t.inicio && fin === t.fin) return turnos; // sin cambio → no-op (misma referencia)
    return turnos.map((x) => (x.id === id ? { ...x, inicio, fin } : x));
}
