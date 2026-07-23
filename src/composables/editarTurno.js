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
import { formatoHora, anclarInicio } from './useEje.js';

/*
 * ⚠️ LA DURACIÓN MÍNIMA NO ES EL SNAP. Fueron el mismo número (30) hasta la 2.c, y allí DIVERGEN
 * (bitácora «dos motivos»). El snap (GRANULARIDAD_MIN, 15) es PRÁCTICO: a 5,35 px/hora no se agarra
 * nada más fino con el ratón — y por eso el teclado, que no tiene ese problema, no snapea. La duración
 * mínima (5) es TÉCNICA: es el muro contra la duración cero, que normaliza() leería como 24 h por su
 * `<=`. Ese muro NO desaparece nunca, venga el valor del ratón o del teclado; por eso 5 es un literal
 * con su razón, no un múltiplo del snap que alguien pueda "simplificar" quitándolo.
 */
export const DURACION_MINIMA = 5;       // minutos. El muro anti-duración-cero. Ver bitácora.
export const DURACION_MAXIMA = 24 * 60; // un turno de más de un día no significa nada

/** Fija horas (minutos absolutos), día y puesto de un turno. Guarda estructural: la duración queda
 *  acotada a [DURACION_MINIMA, DURACION_MAXIMA] pase lo que pase el llamante. Devuelve array nuevo. */
export function editarTurno(turnos, id, { iniMin, finMin, dia, puesto }) {
    const t = turnos.find((x) => x.id === id);
    if (!t) return turnos;
    const dur = Math.min(Math.max(finMin - iniMin, DURACION_MINIMA), DURACION_MAXIMA);
    // ⚠️ EL DÍA ACOMPAÑA AL RELOJ. `dia` es la base (lo que el selector muestra); si `iniMin` cruza la
    // medianoche del editor (≥1440), anclarInicio la rueda a la fecha real. Misma fuente que el arrastre.
    const { dia: diaAncla, inicio } = anclarInicio(dia, iniMin);
    const fin = formatoHora(iniMin + dur);
    if (inicio === t.inicio && fin === t.fin && diaAncla === t.dia && puesto === t.puesto) return turnos; // no-op
    return turnos.map((x) => (x.id === id ? { ...x, inicio, fin, dia: diaAncla, puesto } : x));
}

/** Quita un turno. Devuelve array nuevo; si el id no existe, la misma referencia (no-op). */
export function borrarTurno(turnos, id) {
    if (!turnos.some((t) => t.id === id)) return turnos;
    return turnos.filter((t) => t.id !== id);
}

/* ── EL MURO COMPARTIDO por tiradores (con snap) y teclado (sin snap) ──────────────────────────────
 * Funciones PURAS: reciben el borrador y devuelven el nuevo extremo acotado. Que las dos vías de
 * entrada pasen por AQUÍ es lo que hace la duración cero inalcanzable POR CUALQUIER CAMINO —no solo
 * por los tiradores, que es donde vivía toda la protección hasta la 2.c—. useEditor las aplica al
 * estado reactivo; los tests las prueban en aislado. */

/** Una hora de RELOJ (0..1439) tecleada → el minuto ABSOLUTO del borrador para ese extremo:
 *  · inicio: el representante dentro del día del eje ([eje.desde, eje.desde+1440)).
 *  · fin: el menor absoluto ESTRICTAMENTE mayor que iniMin → un fin ≤ inicio cruza medianoche solo
 *    (22:00 → 06:00 sube +1440 = 8 h), sin un `if` de cruce que recordar. */
export function horaAAbsoluto(clock, extremo, { iniMin, eje }) {
    if (extremo === 'inicio') {
        let i = clock;
        while (i < eje.desde) i += 1440;
        return i;
    }
    let f = clock;
    while (f <= iniMin) f += 1440;
    return f;
}

/** Acota el INICIO: no baja del suelo del eje (ni de fin−MÁX), y no se acerca al fin más que la
 *  mínima. Devuelve el minuto y si topó (para la señal del tirador). */
export function acotaInicio(valAbs, { finMin, eje }) {
    const suelo = Math.max(finMin - DURACION_MAXIMA, eje.desde);
    const techo = finMin - DURACION_MINIMA; // el muro: nunca a menos de la mínima del fin
    return { iniMin: Math.min(Math.max(valAbs, suelo), techo), topado: valAbs > techo ? 'inicio' : null };
}

/** Acota el FIN: no se acerca al inicio más que la mínima (el muro), ni pasa del techo del eje / +MÁX. */
export function acotaFin(valAbs, { iniMin, eje }) {
    const suelo = iniMin + DURACION_MINIMA; // el muro: nunca a menos de la mínima del inicio
    const techo = Math.min(iniMin + DURACION_MAXIMA, eje.hasta);
    return { finMin: Math.min(Math.max(valAbs, suelo), techo), topado: valAbs < suelo ? 'fin' : null };
}
