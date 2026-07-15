<script setup>
/*
 * LA BARRA — el turno como BLOQUE DE COLOR dentro de su pista, y nada más (Ley 2 de la Semana).
 *
 * Cuánto = el ancho, FIEL a la duración (una de 1 h se ve estrecha; eso es el dato, no un defecto).
 * Cuándo = la posición en el eje.
 * Quién  = el color de identidad. El NOMBRE y la HORA no van aquí: son texto de la ficha, ENCIMA de
 *          la barra. Meter texto dentro amontonaría y enterraría el color, y la geometría dejaría de
 *          explicarse sola.
 *
 * Sin ancho mínimo a propósito: engordar la de 1 h para "hacerla visible" mentiría sobre su duración.
 */
import { computed } from 'vue';
import { posicion } from '../composables/useEje.js';

const props = defineProps({
    turno: { type: Object, required: true }, // normalizado (iniMin/finMin)
    eje: { type: Object, required: true },
    color: { type: String, required: true },
});

const pos = computed(() => posicion(props.turno, props.eje));
</script>

<template>
    <div
        data-t="barra"
        :data-persona="turno.persona"
        class="absolute top-0 h-full rounded-[3px]"
        :style="{ left: pos.left + '%', width: pos.width + '%', background: color }"
    />
</template>
