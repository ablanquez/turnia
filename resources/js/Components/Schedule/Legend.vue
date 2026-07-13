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
            ⚠️ EL EJE SE ANUNCIA. NO SE SUSURRA.

            Esto estaba en gris clarísimo, arriba a la derecha, y es INFORMACIÓN CRÍTICA: sin
            saber que el día va de 06:00 a 06:00 nadie entiende por qué el nocturno de Diego
            (22:00→06:00) cabe ENTERO dentro del viernes en vez de partirse en dos.

            El propio usuario se confundió con eso y creyó que la barra estaba mal pintada. Si
            se confunde quien sabe cómo funciona, quien no lo sabe se confunde seguro.

            (Y el rango no siempre es 06:00→06:00: se ensancha si algún turno cae fuera —una
            panadería que entra a las 04:00—, así que se lee del eje, no de una constante.)
        -->
        <span
            data-t="eje"
            class="tabular flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800"
            title="Cada columna es un día de negocio completo, de 24 horas. Un turno de noche que acaba de madrugada cabe entero dentro de su día, sin partirse en dos."
        >
            <span class="text-[9px] font-bold uppercase tracking-wider text-brand-600">El día va de</span>
            {{ rango }}
        </span>

        <span class="tabular text-[10px] text-ink-faint">
            1 columna = 1 día · pasa el ratón por una barra estrecha
        </span>
    </div>
</template>
