<script setup>
import { computed } from 'vue';

/**
 * LA LEYENDA ENSEÑA EL SISTEMA, NO UNA LISTA DE COLORES.
 *
 * Antes enumeraba estados sueltos ("imposible", "aviso", "falta"…), y por eso no ayudaba a leer
 * una combinación: un turno forzado que además incumple no salía en ninguna muestra. Ahora
 * enseña los CANALES —qué pregunta contesta cada cosa— y de ahí el ojo deriva el resto.
 *
 * Ver docs/MATRIZ-VISUAL.md.
 */
const props = defineProps({
    axis: { type: Object, required: true },
});

const reloj = (h) => String(Math.floor(((h % 24) + 24) % 24)).padStart(2, '0') + ':00';

const rango = computed(() => `${reloj(props.axis.from)} → ${reloj(props.axis.to)}`);

const TRAMA = 'repeating-linear-gradient(45deg, rgba(44,38,67,.30) 0 3px, transparent 3px 7px)';
const P = '#7F77DD';
</script>

<template>
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-[#F7F7FB] px-6 py-2.5 text-[11.5px]">
        <!-- EL RELLENO: ¿cuánto cuenta este bloque? Una escala, no tres colores sueltos. -->
        <div class="flex flex-wrap items-center gap-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Cuenta</span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-5 rounded-sm" :style="{ background: P }" />
                Cubre el puesto
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-5 rounded-sm" :style="{ background: `${TRAMA}, ${P}` }" />
                No cubre, pero cuenta horas
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-5 rounded-sm border-[1.5px] border-dashed" :style="{ borderColor: P }" />
                Ni cubre ni cuenta
            </span>
        </div>

        <div class="h-4 w-px bg-line" />

        <!--
            EL ANILLO: la gravedad. Y va POR FUERA de la barra, no dentro.

            Como borde, 2 px arriba y 2 abajo se comían el 40 % de una barra de 10 px y el ojo
            veía UNA MEZCLA: el teal de Iker con un aviso ámbar daba un verde a ΔE 10 del verde
            de "cobertura correcta". El relleno dice de quién es; el anillo, qué pasa. Dos
            preguntas, dos espacios.
        -->
        <div class="flex flex-wrap items-center gap-4">
            <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Gravedad</span>

            <span class="flex items-center gap-2 text-[#41404E]">
                <span class="h-3.5 w-5 rounded-sm outline outline-[3px] outline-impossible" :style="{ background: `${TRAMA}, ${P}` }" />
                Imposible
            </span>

            <span class="flex items-center gap-2 text-[#41404E]">
                <span class="h-3.5 w-5 rounded-sm outline outline-2 outline-breach" :style="{ background: P }" />
                Incumple
            </span>

            <span class="flex items-center gap-2 text-[#41404E]">
                <span class="h-3.5 w-5 rounded-sm outline outline-[1.5px] outline-notice" :style="{ background: P }" />
                Aviso
            </span>
        </div>

        <div class="h-4 w-px bg-line" />

        <!--
            EL CARTEL ES PARA LO QUE PIDE UNA DECISIÓN. NO PARA LO QUE SIMPLEMENTE OCURRE.

            Una hora médica, una baja o un "trabaja en otra empresa" NO llevan cartel: el bloque
            y la banda ya se ven, y no piden nada. Si cada uno levantara una alarma, el encargado
            aprendería a no mirarlas — y un aviso que se ignora no existe.
        -->
        <div class="flex flex-wrap items-center gap-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Pide decisión</span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="rounded bg-impossible px-1.5 py-px text-[8px] font-bold text-white">IMPOSIBLE</span>
                Quitarlo o cambiarlo
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="rounded bg-breach px-1.5 py-px text-[8px] font-bold text-white">INCUMPLIMIENTO</span>
                Forzarlo o arreglarlo
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="rounded bg-[#5A5A66] px-1.5 py-px text-[8px] font-bold text-white">SIN CANDIDATO</span>
                Cualificar a alguien
            </span>
        </div>

        <div class="h-4 w-px bg-line" />

        <!--
            LAS DOS MARCAS. Y son marcas, y no colores, a propósito.

            El forzado compartía el naranja con el incumplimiento, y son cosas OPUESTAS: uno es
            una decisión tomada con constancia, el otro un aviso que nadie ha atendido. El
            nocturno le robaba el color a la persona, y encima ese índigo se confundía con los de
            la propia paleta. Con canal propio, un turno puede ser las tres cosas a la vez y
            enseñarlas las tres.
        -->
        <div class="flex flex-wrap items-center gap-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Marcas</span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="relative h-3.5 w-5 rounded-sm" :style="{ background: P }">
                    <span class="absolute left-0 top-0 h-0 w-0 border-l-[6px] border-t-[6px] border-l-white border-t-transparent" />
                </span>
                Forzado
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="relative h-3.5 w-5 rounded-sm" :style="{ background: P }">
                    <span class="absolute right-0 top-0 h-full w-[3px] rounded-r-sm bg-ink" />
                </span>
                Cruza medianoche
            </span>
        </div>

        <div class="h-4 w-px bg-line" />

        <div class="flex flex-wrap items-center gap-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Cobertura</span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-5 rounded-sm border-t-[3px] border-ok bg-[var(--color-ok-fill)]" />
                Correcto
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-5 rounded-sm border-t-[3px] border-missing bg-[var(--color-missing-fill)]" />
                Falta
            </span>

            <!--
                SIN CANDIDATO = UN HUECO (rojo) + RAYAS. Las rayas no sustituyen al rojo: se le
                ponen encima. Que nadie de la plantilla pueda cubrirlo no hace que falte menos
                gente — solo cambia dónde está el problema (en el catálogo, no en el cuadrante).
            -->
            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span
                    class="h-3.5 w-5 rounded-sm border-t-[3px] border-missing"
                    style="background: repeating-linear-gradient(45deg, rgba(60,56,84,.20) 0 4px, transparent 4px 9px), var(--color-missing-fill)"
                />
                Falta · sin candidato
            </span>

            <!-- El exceso NO es un error, y por eso NO es rojo: sobra gente, que a veces es lo
                 que quieres un sábado. -->
            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-5 rounded-sm border-t-[3px] border-brand-300 bg-[var(--color-excess-fill)]" />
                Exceso
            </span>

            <!--
                ⚠️ EL CUARTO ESTADO, Y EXISTE PORQUE EL TERCERO MENTÍA.

                Donde no se pide a nadie NO SOBRA NADIE. Un turno de 10 a 18 contra una demanda
                de 12 a 16 pintaba "+1" en los bordes, igual que un exceso real. No es que sobre
                uno: es que ahí no se pide ninguno.
            -->
            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-5 rounded-sm border-t-[3px] border-[#C9C6D6] bg-[#EFEEF4]" />
                No se pide nadie
            </span>
        </div>

        <div class="flex-1" />

        <!--
            ⚠️ EL EJE SE ANUNCIA. NO SE SUSURRA.

            Sin saber que el día va de 06:00 a 06:00 nadie entiende por qué el nocturno de Diego
            (22:00→06:00) cabe ENTERO dentro del viernes en vez de partirse en dos. El propio
            usuario se confundió con eso. Si se confunde quien sabe cómo funciona, quien no lo
            sabe se confunde seguro.
        -->
        <span
            data-t="eje"
            class="tabular flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800"
            title="Cada columna es un día de negocio completo, de 24 horas. Un turno de noche que acaba de madrugada cabe entero dentro de su día, sin partirse en dos."
        >
            <span class="text-[9px] font-bold uppercase tracking-wider text-brand-600">El día va de</span>
            {{ rango }}
        </span>
    </div>
</template>
