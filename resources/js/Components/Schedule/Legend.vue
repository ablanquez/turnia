<script setup>
import { computed, ref } from 'vue';
import { TRAMA_TIRA, tramaDe } from '../../composables/useMatrizVisual.js';

/**
 * LA LEYENDA ENSEÑA EL SISTEMA, NO UNA LISTA DE COLORES.
 *
 * Antes enumeraba estados sueltos ("imposible", "aviso", "falta"…), y por eso no ayudaba a leer
 * una combinación: un turno forzado que además incumple no salía en ninguna muestra. Ahora
 * enseña los CANALES —qué pregunta contesta cada cosa— y de ahí el ojo deriva el resto.
 *
 * ⚠️ Y ESTABA ABIERTA ENTERA, LO QUE ERA EL MISMO ERROR QUE LOS CARTELES.
 *
 * Veinte muestras en dos líneas, ocupando el 15 % de la pantalla, SIEMPRE. Era correcta y
 * completa, y por eso mismo nadie la iba a leer: un encargado que abre la parrilla no necesita
 * el manual entero delante todo el rato. Y una leyenda que se ignora es tan inútil como un aviso
 * que se ignora — es la ley 14 otra vez, aplicada a la propia ayuda.
 *
 * Así que se parte en dos:
 *
 *   · LO QUE PIDE UNA DECISIÓN, siempre visible. Es lo único que dice QUÉ HACER, y por eso se
 *     gana el sitio: un cartel rojo sin saber que significa "quítalo o cámbialo" es un adorno.
 *   · EL RESTO —cuenta, gravedad, marcas, cobertura— a un clic. No se quita: se esconde.
 *
 * Ver docs/MATRIZ-VISUAL.md.
 */
const props = defineProps({
    axis: { type: Object, required: true },
});

const abierta = ref(false);

const reloj = (h) => String(Math.floor(((h % 24) + 24) % 24)).padStart(2, '0') + ':00';

const rango = computed(() => `${reloj(props.axis.from)} → ${reloj(props.axis.to)}`);

/**
 * ⚠️ LA LEYENDA TENÍA SU PROPIA COPIA DE LA TRAMA. Y ESO ES LA LEY 13, ROTA EN EL PEOR SITIO.
 *
 * `const TRAMA = 'repeating-linear-gradient(45deg, rgba(44,38,67,.30) 0 3px…')` vivía aquí, calcada
 * de useMatrizVisual. El día que la parrilla cambiara de trama —y cambió— la leyenda seguiría
 * enseñando la vieja: el manual contando una cosa y la página pintando otra. Una leyenda que miente
 * es peor que no tener leyenda, porque enseña a leer mal.
 *
 * Ahora se importa. Una sola definición, y la muestra se pinta con la MISMA función que la barra.
 *
 * `MUESTRA` es un color de la paleta de verdad —el primero—, no un índigo de marca inventado: la
 * trama es la SOMBRA DE SU COLOR, así que enseñarla sobre un color que no es de nadie enseñaría una
 * sombra que no es de nadie.
 */
const MUESTRA = '#70D0CC';
const TRAMA = tramaDe(MUESTRA);
</script>

<template>
    <div class="border-b border-line bg-[#F7F7FB] px-6 py-2.5 text-[11.5px]">
        <!-- LA LÍNEA QUE SIEMPRE SE VE: lo que pide una decisión, y qué hacer con ello. -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
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

            <!--
                EL BOTÓN. Dice cuántas cosas hay debajo, porque "?" a secas no promete nada y una
                ayuda que no se sabe que existe no existe.
            -->
            <button
                type="button"
                data-t="leyenda-toggle"
                :aria-expanded="abierta"
                class="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2 py-1 text-[10.5px] font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-600"
                @click="abierta = ! abierta"
            >
                <span class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-50 text-[9px] font-bold text-brand-600">?</span>
                {{ abierta ? 'Ocultar la leyenda' : 'Cómo se lee la parrilla' }}
            </button>

            <div class="flex-1" />

            <!--
                ⚠️ EL EJE SE ANUNCIA. NO SE SUSURRA. Y SE QUEDA FUERA DEL PLEGADO.

                Sin saber que el día va de 06:00 a 06:00 nadie entiende por qué el nocturno de
                Diego (22:00→06:00) cabe ENTERO dentro del viernes en vez de partirse en dos. El
                propio usuario se confundió con eso. Si se confunde quien sabe cómo funciona, quien
                no lo sabe se confunde seguro — así que esto no se esconde detrás de un clic.
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

        <!-- EL RESTO: el sistema entero, a un clic. No se quita, se esconde. -->
        <div
            v-if="abierta"
            data-t="leyenda-detalle"
            class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3"
        >
            <!-- EL RELLENO: ¿cuánto cuenta este bloque? Una escala, no tres colores sueltos. -->
            <div class="flex flex-wrap items-center gap-3">
                <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Cuenta</span>

                <span class="flex items-center gap-1.5 text-[#41404E]">
                    <span class="h-3.5 w-5 rounded-sm" :style="{ background: MUESTRA }" />
                    Cubre el puesto
                </span>

                <span class="flex items-center gap-1.5 text-[#41404E]">
                    <span class="h-3.5 w-5 rounded-sm" :style="{ background: `${TRAMA}, ${MUESTRA}` }" />
                    No cubre, pero cuenta horas
                </span>

                <span class="flex items-center gap-1.5 text-[#41404E]">
                    <span class="h-3.5 w-5 rounded-sm border-[1.5px] border-dashed" :style="{ borderColor: MUESTRA }" />
                    Ni cubre ni cuenta
                </span>
            </div>

            <div class="h-4 w-px bg-line" />

            <!--
                EL ANILLO: la gravedad. Y va POR FUERA de la barra, no dentro.

                Como borde, se comía el 40 % de la barra y el ojo veía UNA MEZCLA: el teal de Iker
                con un aviso ámbar daba un verde a ΔE 10 del verde de "cobertura correcta". El
                relleno dice de quién es; el anillo, qué pasa. Dos preguntas, dos espacios.
            -->
            <div class="flex flex-wrap items-center gap-4">
                <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Gravedad</span>

                <span class="flex items-center gap-2 text-[#41404E]">
                    <span class="h-3.5 w-5 rounded-sm shadow-[0_-4px_0_0_var(--color-impossible),0_4px_0_0_var(--color-impossible)]" :style="{ background: `${TRAMA}, ${MUESTRA}` }" />
                    Imposible
                </span>

                <span class="flex items-center gap-2 text-[#41404E]">
                    <span class="h-3.5 w-5 rounded-sm shadow-[0_-3px_0_0_var(--color-breach),0_3px_0_0_var(--color-breach)]" :style="{ background: MUESTRA }" />
                    Incumple
                </span>

                <span class="flex items-center gap-2 text-[#41404E]">
                    <span class="h-3.5 w-5 rounded-sm shadow-[0_-2px_0_0_var(--color-notice),0_2px_0_0_var(--color-notice)]" :style="{ background: MUESTRA }" />
                    Aviso
                </span>
            </div>

            <div class="h-4 w-px bg-line" />

            <!--
                LAS DOS MARCAS. Y son marcas, y no colores, a propósito.

                El forzado compartía el naranja con el incumplimiento, y son cosas OPUESTAS: uno es
                una decisión tomada con constancia, el otro un aviso que nadie ha atendido. El
                nocturno le robaba el color a la persona. Con canal propio, un turno puede ser las
                tres cosas a la vez y enseñarlas las tres.
            -->
            <div class="flex flex-wrap items-center gap-3">
                <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Marcas</span>

                <span class="flex items-center gap-1.5 text-[#41404E]">
                    <span class="relative h-3.5 w-5 rounded-sm" :style="{ background: MUESTRA }">
                        <span class="absolute left-0 top-0 h-0 w-0 border-l-[6px] border-t-[6px] border-l-white border-t-transparent" />
                    </span>
                    Forzado
                </span>

                <span class="flex items-center gap-1.5 text-[#41404E]">
                    <span class="relative h-3.5 w-5 rounded-sm" :style="{ background: MUESTRA }">
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
                        :style="{ background: `${TRAMA_TIRA}, var(--color-missing-fill)` }"
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
        </div>
    </div>
</template>
