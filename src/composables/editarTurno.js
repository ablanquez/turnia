/*
 * EDITAR Y BORRAR UN TURNO — la lógica del editor (Bloque 4 · tanda 2.b).
 *
 * ⚠️ MINUTOS ABSOLUTOS, no cadenas. editarTurno recibe iniMin/finMin en un marco donde `finMin > iniMin`
 * SIEMPRE (el fin puede pasar de 1440 al cruzar medianoche, nunca envuelve por debajo del inicio). En
 * ese marco, la DURACIÓN CERO es estructuralmente inalcanzable: no es un `if` que haya que recordar, es
 * que el estado absurdo no existe: `fin` vive siempre por delante de `inicio`. La guarda solo acota
 * [DURACION_MINIMA, 24h]; aunque un llamante pida duración 0 o negativa, sale la mínima, nunca cero.
 *
 * NO se parsea inicio/fin de cadena aquí: eso reintroduciría la ambigüedad del `<=` de normaliza (una
 * cadena "08:00"–"08:00" no distingue 0 de 24 h). Trabajando en minutos absolutos no hay ambigüedad.
 * (Ver bitácora: por qué el fin puede pasar de 1440; que nadie lo "arregle" con un mod 24.)
 */
import { formatoHora, GRANULARIDAD_MIN } from './useEje.js';

// La duración mínima es la misma que el snap (decisión 2.c): media hora. Un turno de menos no
// significa nada en un cuadrante. Si algún día deben divergir, se separan en dos constantes.
export const DURACION_MINIMA = GRANULARIDAD_MIN;
export const DURACION_MAXIMA = 24 * 60; // un turno de más de un día no significa nada

/** Fija horas (minutos absolutos), día y puesto de un turno. Guarda estructural: la duración queda
 *  acotada a [DURACION_MINIMA, DURACION_MAXIMA] pase lo que pase el llamante. Devuelve array nuevo. */
export function editarTurno(turnos, id, { iniMin, finMin, dia, puesto }) {
    const t = turnos.find((x) => x.id === id);
    if (!t) return turnos;
    const dur = Math.min(Math.max(finMin - iniMin, DURACION_MINIMA), DURACION_MAXIMA);
    const inicio = formatoHora(iniMin);
    const fin = formatoHora(iniMin + dur);
    if (inicio === t.inicio && fin === t.fin && dia === t.dia && puesto === t.puesto) return turnos; // no-op
    return turnos.map((x) => (x.id === id ? { ...x, inicio, fin, dia, puesto } : x));
}

/** Quita un turno. Devuelve array nuevo; si el id no existe, la misma referencia (no-op). */
export function borrarTurno(turnos, id) {
    if (!turnos.some((t) => t.id === id)) return turnos;
    return turnos.filter((t) => t.id !== id);
}
