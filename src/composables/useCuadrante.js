/*
 * EL CUADRANTE, EN MEMORIA — el estado reactivo de los turnos (datos a fuego, mutables hasta recargar).
 *
 * Módulo-singleton: un solo cuadrante para toda la app, sin Pinia (prototipo; un `ref` de módulo es lo
 * idiomático en Vue para esto). Se copia el sembrado de semana.js —no se muta el `const` importado— y
 * las mutaciones REEMPLAZAN el array (moverTurno devuelve uno nuevo), que es lo que la reactividad
 * necesita para reaccionar.
 *
 * Es la FONTANERÍA que heredarán las tandas 2 (cambiar hora) y 3 (crear): todas mutan este estado.
 */
import { ref } from 'vue';
import { TURNOS } from '../datos/semana.js';
import { moverTurno } from './moverTurno.js';

const turnos = ref(TURNOS.map((t) => ({ ...t })));

/** Mueve el turno `id` a la celda destino ({ dia, puesto }), conservando sus horas. */
export function mover(id, destino) {
    turnos.value = moverTurno(turnos.value, id, destino);
}

export function useCuadrante() {
    return { turnos };
}
