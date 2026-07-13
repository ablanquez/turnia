<script setup>
import { computed } from 'vue';

const props = defineProps({
    axis: { type: Object, required: true },
});

const reloj = (h) => String(Math.floor(((h % 24) + 24) % 24)).padStart(2, '0') + ':00';

const rango = computed(() => `${reloj(props.axis.from)} → ${reloj(props.axis.to)}`);
</script>

<template>
    <div
        class="flex flex-wrap items-center gap-5 border-b border-line bg-[#F7F7FB] px-6 py-2.5 text-[11.5px]"
    >
        <div class="flex flex-wrap items-center gap-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Estado</span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span
                    class="h-3.5 w-3.5 rounded-sm border-[1.5px] border-impossible"
                    style="background: repeating-linear-gradient(45deg, rgba(200,30,30,.28) 0 4px, rgba(200,30,30,.1) 4px 8px)"
                />
                Imposible
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-3.5 rounded-sm border-[1.5px] border-breach bg-[rgba(232,89,12,.1)]" />
                Incumplimiento
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-3.5 rounded-sm border-[1.5px] border-notice bg-[rgba(217,164,0,.16)]" />
                Aviso
            </span>
        </div>

        <div class="h-4 w-px bg-line" />

        <div class="flex flex-wrap items-center gap-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Cobertura</span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-3.5 rounded-sm border-t-[3px] border-ok bg-[rgba(21,128,61,.2)]" />
                Correcto
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-3.5 rounded-sm border-t-[3px] border-missing bg-[rgba(220,38,38,.24)]" />
                Falta
            </span>

            <!-- El exceso NO es un error, y por eso NO es rojo: es índigo. Sobra gente,
                 que a veces es lo que quieres un sábado. -->
            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-3.5 rounded-sm border-t-[3px] border-brand-300 bg-[rgba(127,119,221,.24)]" />
                Exceso
            </span>

            <!--
                SIN CANDIDATO = UN HUECO (rojo) + RAYAS. Las rayas no sustituyen al rojo: se
                le ponen encima. Que nadie de la plantilla pueda cubrirlo no hace que falte
                menos gente — solo cambia dónde está el problema (en el catálogo, no en el
                cuadrante).
            -->
            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span
                    class="h-3.5 w-3.5 rounded-sm border-t-[3px] border-missing"
                    style="background: repeating-linear-gradient(45deg, rgba(60,56,84,.20) 0 4px, transparent 4px 9px), rgba(220,38,38,.24)"
                />
                Falta · sin candidato
            </span>
        </div>

        <div class="flex-1" />

        <!--
            El rango del eje se dice AQUÍ, y por eso la semana no lleva regla horaria: así se
            validó el diseño y así se lee bien. El eje ARRANCA en 06:00, pero se ensancha si
            algún turno cae fuera (una panadería que entra a las 04:00): recortarlo sería
            dibujar una mentira.
        -->
        <span class="tabular text-[10px] text-[#A9A7B6]">
            cada columna = 1 día · {{ rango }} · pasa el ratón sobre una barra estrecha
        </span>
    </div>
</template>
