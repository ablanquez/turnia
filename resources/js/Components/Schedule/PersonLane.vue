<script setup>
import { computed } from 'vue';
import { barFill, severityColor, worst } from '../../composables/useSeverity.js';

/**
 * UN CARRIL: una persona, dentro de un puesto, dentro de un día.
 *
 * Cada persona tiene su LÍNEA PROPIA. Nombre y hora COMPLETOS: se probó a truncar y
 * era ilegible ("Hu…" puede ser Hugo o Humberto, y en un cuadrante eso es un error
 * de plantilla esperando a ocurrir).
 *
 * Las barras se posicionan por su hora real sobre el eje. Por eso la jornada partida
 * se VE como dos barras con un agujero en medio, y el turno nocturno se VE cruzando
 * el borde del día. No hay que leerlo: se ve.
 */
const props = defineProps({
    person: { type: Object, required: true },
    blocks: { type: Array, required: true },
    // null mientras el informe no ha llegado. NO es "sin incidencias".
    violationsById: { type: Object, default: null },
});

const severityOf = (block) => {
    if (!props.violationsById) {
        return null;
    }

    return worst(props.violationsById[block.id] ?? []);
};

/** El estado del carril entero: el peor de sus barras. */
const laneSeverity = computed(() => {
    if (!props.violationsById) {
        return null;
    }

    const todas = props.blocks.flatMap((b) => props.violationsById[b.id] ?? []);

    return worst(todas);
});

const summary = computed(() =>
    props.blocks.map((b) => b.label).join('   ·   '),
);

const styleOf = (block) => {
    const severity = severityOf(block);

    return {
        position: 'absolute',
        left: `${block.left}%`,
        width: `${block.width}%`,
        top: 0,
        bottom: 0,
        borderRadius: '3px',
        boxSizing: 'border-box',
        background: barFill(severity, props.person.color),
        border: severity === 'impossible' ? '1px solid #C81E1E' : 'none',
    };
};
</script>

<template>
    <div :title="`${person.name} · ${summary}`">
        <div class="flex items-center gap-1.5">
            <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7.5px] font-semibold text-white"
                :style="{ background: person.color }"
            >{{ person.initials }}</span>

            <span class="shrink-0 text-xs font-semibold text-[--color-ink]">{{ person.name }}</span>

            <span class="tabular min-w-0 flex-1 truncate text-[10px] text-[#8A8896]">{{ summary }}</span>

            <span
                v-if="laneSeverity"
                class="shrink-0 text-[11px] leading-none"
                :style="{ color: severityColor(laneSeverity) }"
            >●</span>
        </div>

        <div
            class="relative mt-0.5 h-2 overflow-hidden rounded bg-[#F1F0F6]"
        >
            <div v-for="block in blocks" :key="block.id" :style="styleOf(block)" />
        </div>
    </div>
</template>
