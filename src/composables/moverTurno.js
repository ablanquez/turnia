/*
 * MOVER UN TURNO DE CELDA — la lógica pura del arrastre (Bloque 4 · tanda 1).
 *
 * Mueve el turno `id` a la celda destino (día y/o puesto), CONSERVANDO sus horas: en esta tanda el
 * turno cambia de sitio, no de duración. No juzga si el movimiento es legal (motor y reglas no
 * existen todavía): mueve.
 *
 * ⚠️ DEVUELVE UN NUEVO ARRAY, nunca muta el que recibe. Dos razones: (1) la reactividad de Vue se
 * dispara al REEMPLAZAR la referencia, no al mutar en sitio; (2) una mutación en sitio no rompe nada
 * visible de inmediato y luego corrompe estado por sitios que no se esperan — es el fallo más
 * traicionero, por eso el test de inmutabilidad es el que más pesa.
 */
export function moverTurno(turnos, id, destino) {
    const actual = turnos.find((t) => t.id === id);
    if (!actual) return turnos; // id desconocido → no se toca nada
    // Misma celda = no-op de verdad: se devuelve la MISMA referencia (ni re-render ni objeto nuevo).
    if (actual.dia === destino.dia && actual.puesto === destino.puesto) return turnos;
    return turnos.map((t) =>
        t.id === id ? { ...t, dia: destino.dia, puesto: destino.puesto } : t,
    );
}
