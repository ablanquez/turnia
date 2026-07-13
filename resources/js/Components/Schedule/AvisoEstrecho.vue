<script setup>
import { computed } from 'vue';
import { Link } from '@inertiajs/vue3';
import { MIN_SEMANA, useAncho } from '../../composables/useAncho.js';

/**
 * «ESTA VENTANA ES DEMASIADO ESTRECHA PARA VER LA SEMANA ENTERA.» Y SE DICE.
 *
 * ⚠️ EL SILENCIO NO SIGNIFICA "TODO BIEN" TAMPOCO AQUÍ.
 *
 * Por debajo de MIN_SEMANA los siete días no caben a la vez. La parrilla sigue funcionando —se
 * desplaza, y no esconde ni recorta NADA (ley 10)— pero se pierde lo único que una vista de
 * semana sabe hacer: verla entera de un vistazo.
 *
 * Si alguien abre Turnia en una ventana a media pantalla y ve tres días y medio, tiene que SABER
 * que le faltan cuatro. Deducirlo de que hay una barra de scroll es pedirle que adivine, y en
 * esta app un dato que hay que deducir es un dato que se pierde.
 *
 * ⚠️ Y NO BLOQUEA. Un cartel que tape la parrilla sería peor que el problema: el encargado que
 * SOLO tiene esa pantalla se quedaría sin cuadrante. Avisa, ofrece la salida buena (el zoom Día,
 * que sí cabe en estrecho) y se aparta.
 */
const props = defineProps({
    company: { type: Object, required: true },
    calendar: { type: Object, required: true },
    // El lunes de la ventana visible: si hay que ir al Día, se va AL DÍA QUE SE ESTÁ MIRANDO.
    day: { type: String, required: true },
});

const { ancho } = useAncho();

const estrecha = computed(() => ancho.value < MIN_SEMANA);

const faltan = computed(() => MIN_SEMANA - ancho.value);

const dayUrl = computed(() => `/companies/${props.company.id}/calendars/${props.calendar.id}/schedule/day?day=${props.day}`);
</script>

<template>
    <div
        v-if="estrecha"
        data-t="demasiado-estrecho"
        class="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-brand-50 px-6 py-2 text-[11.5px] text-brand-800"
    >
        <span class="font-bold">La semana entera no cabe en esta ventana.</span>

        <span class="text-[#41404E]">
            Faltan <span class="tabular font-semibold">{{ faltan }} px</span> para ver los siete
            días a la vez. No se oculta nada: la parrilla se desplaza a lo ancho.
        </span>

        <Link
            :href="dayUrl"
            class="rounded-lg border border-brand-300 bg-card px-2.5 py-1 text-[11px] font-bold text-brand-600 hover:bg-white"
        >Ver el zoom DÍA →</Link>
    </div>
</template>
