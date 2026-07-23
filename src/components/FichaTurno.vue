<script setup>
/*
 * UNA FICHA DE TURNO — el turno como bloque vertical de tres pisos (estructura del viejo, reescrita):
 *
 *   1. arriba  · insignia de iniciales (color de identidad) + NOMBRE
 *   2. cuelga de la insignia, con un HILO-GUÍA de identidad a la izquierda:
 *        · la HORA (cifras tabulares, mono)
 *        · la BARRA de color sobre su pista (eje 06→06), posicionada por la hora
 *
 * El HILO-GUÍA es un border-left del MISMO color de identidad que la barra (person.color): la persona
 * se dice en la barra y se REFUERZA en el hilo. Cuelga de la insignia y recorre hora + pista; NO sube
 * al nombre (la insignia ya lleva el color allí; subirlo repetiría la identidad de más). Es un canal
 * de IDENTIDAD y solo identidad — las gravedades, cuando lleguen, irán en otro canal (ver ESTILO.md).
 *
 * Un hilo POR FICHA (no por persona como el viejo): dos turnos de alguien = dos fichas apiladas, cada
 * una con su hilo, y así se ve dónde acaba un turno y empieza el otro.
 *
 * El texto (nombre y hora) es visible encima de la barra, nunca dentro; la barra es color puro (Ley 2).
 */
import { computed } from 'vue';
import { marcasHoras } from '../composables/useEje.js';
import { tintaSobre } from '../estilo/reglas.js';
import Barra from './Barra.vue';

const props = defineProps({
    turno: { type: Object, required: true }, // normalizado (iniMin/finMin) + inicio/fin en HH:MM
    eje: { type: Object, required: true },
    color: { type: String, required: true },
    nombre: { type: String, required: true },
});

// Iniciales de las dos primeras palabras del nombre: "Elena Gil" → "EG".
const iniciales = computed(() =>
    props.nombre.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase());

// Las líneas de la rejilla son ELEMENTOS posicionados por marcasHoras() —la única función que sabe de
// horas—, así caen en horas redondas (06/12/18/00) aunque el eje se ensanche. No una trama CSS de
// fondo (que arrancaba en el borde = eje.desde y, con el eje ensanchado, caía en 04:00 en vez de 06:00).
const marcas = computed(() => marcasHoras(props.eje, 6));
</script>

<template>
    <div class="flex flex-col gap-1">
        <div class="flex items-start gap-1.5">
            <span
                class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none"
                :style="{ background: color, color: tintaSobre(color) }"
            >{{ iniciales }}</span>
            <!-- El nombre ENVUELVE (min-w-0 flex-1 break-words), nunca se trunca: un nombre a medias
                 ("Hu…") es una mentira dibujada. Sin min-w-0 el flex no encoge y el nombre ensancharía
                 su columna rompiendo el "7 días caben". -->
            <span class="min-w-0 flex-1 break-words text-[13px] font-semibold leading-tight text-ink">{{ nombre }}</span>
        </div>

        <!-- Cuelga de la insignia: el hilo-guía de identidad recorre la hora + la pista, no el nombre. -->
        <div class="ml-[9px] flex flex-col gap-1 border-l-2 pl-[9px]" :style="{ borderColor: color }">
            <div class="font-mono text-[11px] leading-none text-ink-soft">{{ turno.inicio }}–{{ turno.fin }}</div>

            <div class="relative h-4 overflow-hidden rounded bg-sunken">
                <span
                    v-for="m in marcas"
                    :key="m.etiqueta"
                    data-t="linea"
                    :data-hora="m.etiqueta"
                    class="absolute inset-y-0 w-px bg-line-soft"
                    :style="{ left: m.left + '%' }"
                />
                <Barra :turno="turno" :eje="eje" :color="color" />
            </div>
        </div>
    </div>
</template>
