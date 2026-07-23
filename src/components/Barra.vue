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
    turno: { type: Object, required: true }, // normalizado (iniMin/finMin) — bounds del TROZO a dibujar
    eje: { type: Object, required: true },
    color: { type: String, required: true },
    turnoId: { type: String, default: null }, // id del turno: empareja los dos trozos de un partido (instrumento)
    corteIni: { type: Boolean, default: false }, // el borde izquierdo es un tajo (el turno viene de antes)
    corteFin: { type: Boolean, default: false }, // el borde derecho es un tajo (el turno sigue después)
});

const pos = computed(() => posicion(props.turno, props.eje));
// El tajo se dibuja RECTO (los extremos reales van redondeados): forma, no color — señal de «continúa».
const radios = computed(() => (props.corteIni ? ' rounded-l-none' : '') + (props.corteFin ? ' rounded-r-none' : ''));
</script>

<template>
    <div
        data-t="barra"
        :data-persona="turno.persona"
        :data-turno="turnoId"
        :data-corte="corteIni ? 'ini' : corteFin ? 'fin' : null"
        class="absolute top-0 h-full rounded-[3px]"
        :class="radios"
        :style="{ left: pos.left + '%', width: pos.width + '%', background: color }"
    />
</template>
