<script setup>
/*
 * UNA CELDA — puesto × día. Apila las FICHAS de sus turnos (una por turno, en orden), y al fondo
 * reserva el HUECO de la tira de cobertura.
 *
 * Una persona con dos turnos en el día son DOS fichas apiladas (cada una con su barra), no dos
 * barras en la misma pista: así cada turno tiene su propio alto y se lee sin amontonar.
 *
 * ⚠️ EL HUECO DE COBERTURA ES SITIO RESERVADO, NO UN ESTADO. La tira funcional del viejo
 * (verde/rojo/ámbar + conteos -3/-2/+1) es capa SEMÁNTICA y necesita el motor, que aún no existe. Se
 * reserva ya su alto real (15 px + 9 de separación, medidos en el viejo) para que al llegar sea
 * encajar y no rehacer el alto de la celda —igual que el stub de la vista móvil—. Y NO se pinta con
 * el gris `sunken` del viejo: allí ese gris significaba a la vez «cubierto» y «no se pide nada» (dos
 * cosas opuestas, un color), y mordió. Aquí es un borde punteado neutro: «pendiente», no un estado.
 */
import { computed } from 'vue';
import { PERSONAS_POR_ID } from '../datos/semana.js';
import { useArrastre } from '../composables/useArrastre.js';
import FichaTurno from './FichaTurno.vue';

const props = defineProps({
    turnos: { type: Array, required: true }, // normalizados, de esta celda
    eje: { type: Object, required: true },
    dia: { type: String, required: true }, // clave del día (para ser destino del arrastre)
    puesto: { type: String, required: true }, // id del puesto
});

const { arrastre } = useArrastre();

const ordenados = computed(() => [...props.turnos].sort((a, b) => a.iniMin - b.iniMin));

// ¿Es esta la celda bajo el puntero durante un arrastre? → se resalta. El resalte va en la CELDA
// (anillo interior de marca), NUNCA en la barra: la restricción del color se respeta al pie.
const esDestino = computed(() =>
    arrastre.activo && arrastre.destino
    && arrastre.destino.dia === props.dia && arrastre.destino.puesto === props.puesto);
</script>

<template>
    <div
        class="flex min-h-16 flex-col p-2"
        :class="{ 'ring-2 ring-inset ring-brand-300': esDestino }"
        data-celda
        :data-dia="dia"
        :data-puesto="puesto"
    >
        <div class="flex flex-col gap-3">
            <FichaTurno
                v-for="t in ordenados"
                :key="t.id"
                :turno="t"
                :eje="eje"
                :color="PERSONAS_POR_ID[t.persona].color"
                :nombre="PERSONAS_POR_ID[t.persona].nombre"
            />
        </div>

        <!--
            Hueco de cobertura RESERVADO (Bloque 3): vacío, al fondo de la celda (el flex-1 lo empuja,
            como en el viejo), alineado bajo las pistas. Alto de la tira real (15 px) + su separación
            (9 px). Borde punteado neutro = «pendiente», nunca el gris-estado del viejo.
        -->
        <template v-if="ordenados.length">
            <div class="flex-1" />
            <div class="ml-5 mt-[9px] h-[15px] rounded-sm border border-dashed border-line" aria-hidden="true" />
        </template>
    </div>
</template>
