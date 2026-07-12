<script setup>
import { computed } from 'vue';
import { barFill, severityColor, worst } from '../../composables/useSeverity.js';

/**
 * UN CARRIL: una persona, dentro de un puesto, dentro de un día.
 *
 * CADA PERSONA EN SU PROPIA LÍNEA. Se probó a apilar las barras y era ilegible: con tres
 * turnos encima ni se sabía de quién era cada uno ni dónde empezaba. Con carriles, el
 * cuadrante se lee de un vistazo.
 *
 * Nombre y hora COMPLETOS. Truncar es ilegible: "Hu…" puede ser Hugo o Humberto, y en un
 * cuadrante eso es un error de plantilla esperando a ocurrir.
 *
 * EL TIEMPO ES EL EJE X. Las barras se posicionan por su hora real, así que:
 *   · la jornada partida se VE como dos barras con un agujero físico en medio
 *   · el turno nocturno se VE cruzando el borde del día
 *   · el solape se VE como dos barras pisándose
 * Todo eso se VE. No hay que leerlo.
 */
const props = defineProps({
    person: { type: Object, required: true },
    blocks: { type: Array, required: true },
    axis: { type: Object, required: true },
    // null mientras el informe no ha llegado. NO significa "sin incidencias".
    violationsById: { type: Object, default: null },
});

const severityOf = (block) => (props.violationsById
    ? worst(props.violationsById[block.id] ?? [])
    : null);

const laneSeverity = computed(() => (props.violationsById
    ? worst(props.blocks.flatMap((b) => props.violationsById[b.id] ?? []))
    : null));

const summary = computed(() => props.blocks.map((b) => b.label).join('  ·  '));

/** Las líneas verticales de la pista: una cada 6 horas. Dan la escala sin ocupar sitio. */
const gridSize = computed(() => `${100 / ((props.axis.to - props.axis.from) / 6)}% 100%`);

const styleOf = (block) => {
    const severity = severityOf(block);

    return {
        position: 'absolute',
        left: `${block.left}%`,
        width: `${block.width}%`,
        top: 0,
        bottom: 0,
        // Un turno de media hora sigue siendo un turno: por estrecho que sea, se ve.
        minWidth: '3px',
        borderRadius: '3px',
        boxSizing: 'border-box',
        background: barFill(severity, props.person.color),
        border: severity === 'impossible' ? '1px solid #C81E1E' : 'none',
    };
};

/**
 * UNA JORNADA PARTIDA ES UN HUECO, NO UN SOLAPE.
 *
 * Dos turnos el mismo día solo son una partida si entre ellos hay AIRE. Si se pisan, no
 * es una partida: es el imposible que el motor denuncia, y llamarlo "jornada partida"
 * sería vestir un error de bandera de normalidad.
 *
 * Estaba mal, y se vio al mirar la parrilla: el solape de Tomás salía rotulado como
 * jornada partida, tan tranquilo.
 */
const esPartida = computed(() => {
    const orden = props.blocks.slice().sort((a, b) => a.startHour - b.startHour);

    for (let i = 1; i < orden.length; i++) {
        if (orden[i].startHour > orden[i - 1].endHour) {
            return true;
        }
    }

    return false;
});

/** Lo que hay que SABER de esta persona hoy, en una línea y con su color. */
const notes = computed(() => {
    const out = [];

    if (props.blocks.some((b) => b.crossesMidnight)) {
        out.push({ text: 'Cruza medianoche', color: '#534AB7' });
    } else if (esPartida.value) {
        out.push({ text: 'Jornada partida', color: '#534AB7' });
    }

    if (props.blocks.some((b) => b.forced)) {
        out.push({ text: 'Forzado, con constancia', color: '#E8590C' });
    }

    if (!props.violationsById) {
        return out;
    }

    // El mensaje del motor, tal cual: es el que sabe la verdad, y ya viene redactado
    // según quién mira.
    for (const block of props.blocks) {
        for (const v of props.violationsById[block.id] ?? []) {
            out.push({ text: v.message, color: severityColor(v.severity) });
        }
    }

    return out;
});
</script>

<template>
    <div :title="`${person.name} · ${summary}`">
        <div class="flex items-center gap-1.5">
            <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7.5px] font-semibold text-white"
                :style="{ background: person.color }"
            >{{ person.initials }}</span>

            <!-- Nombre entero: shrink-0, jamás truncado. -->
            <span class="shrink-0 whitespace-nowrap text-[12px] font-semibold text-ink">{{ person.name }}</span>

            <!-- Y la hora entera, en mono, para que las cifras queden en columna. -->
            <span class="tabular shrink-0 whitespace-nowrap text-[10px] text-[#8A8896]">{{ summary }}</span>

            <span class="flex-1" />

            <span
                v-if="laneSeverity"
                class="shrink-0 text-[11px] leading-none"
                :style="{ color: severityColor(laneSeverity) }"
            >●</span>
        </div>

        <div
            class="relative mt-1 h-2 overflow-hidden rounded"
            :style="{
                background: '#F1F0F6',
                backgroundImage: 'linear-gradient(90deg,#E4E3EC 1px,transparent 1px)',
                backgroundSize: gridSize,
            }"
        >
            <div v-for="block in blocks" :key="block.id" :style="styleOf(block)" />
        </div>

        <div
            v-for="(note, i) in notes"
            :key="i"
            class="mt-1 flex items-start gap-1.5 text-[9.5px] font-semibold leading-tight"
            :style="{ color: note.color }"
        >
            <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: note.color }" />
            {{ note.text }}
        </div>
    </div>
</template>
