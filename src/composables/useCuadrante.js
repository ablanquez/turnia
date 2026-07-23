/*
 * EL CUADRANTE, EN MEMORIA — el estado reactivo de los turnos (datos a fuego, mutables hasta recargar).
 *
 * Módulo-singleton: un solo cuadrante para toda la app, sin Pinia (prototipo; un `ref` de módulo es lo
 * idiomático en Vue para esto). Se copia el sembrado de semana.js —no se muta el `const` importado— y
 * las mutaciones REEMPLAZAN el array (mover/retimar devuelven uno nuevo), que es lo que la reactividad
 * necesita para reaccionar.
 *
 * `norm` y `eje` viven aquí como FUENTE ÚNICA: los comparten la Parrilla (para pintar) y el arrastre
 * (que necesita el eje para mapear píxeles a horas). Recalcular es barato (computed); duplicar, no.
 *
 * Es la FONTANERÍA que heredarán la tanda 3 (crear): también mutará este estado.
 */
import { ref, computed } from 'vue';
import { TURNOS } from '../datos/semana.js';
import { normaliza, calcularEje } from './useEje.js';
import { moverTurno } from './moverTurno.js';
import { retimarTurno } from './retimarTurno.js';
import { editarTurno, borrarTurno } from './editarTurno.js';

const turnos = ref(TURNOS.map((t) => ({ ...t })));

const norm = computed(() => turnos.value.map(normaliza));
const eje = computed(() => calcularEje(norm.value));

/** Mueve el turno `id` a la celda destino ({ dia, puesto }), conservando sus horas (tanda 1). */
export function mover(id, destino) {
    turnos.value = moverTurno(turnos.value, id, destino);
}

/** Retima el turno `id` a un nuevo inicio (min, ya ajustado a la granularidad), conservando duración (tanda 2). */
export function retimar(id, inicioMin) {
    turnos.value = retimarTurno(turnos.value, id, inicioMin);
}

/** Edita horas (min absolutos), día y puesto del turno `id`, con la guarda de duración (tanda 2.b). */
export function editar(id, cambios) {
    turnos.value = editarTurno(turnos.value, id, cambios);
}

/** Borra el turno `id` (tanda 2.b). No hay deshacer: el editor pide confirmación antes de llamar aquí. */
export function borrar(id) {
    turnos.value = borrarTurno(turnos.value, id);
}

export { eje, norm };

export function useCuadrante() {
    return { turnos, norm, eje };
}
