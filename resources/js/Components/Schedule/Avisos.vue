<script setup>
import { severityColor, severityFill, OK_FILL, OK_TEXT } from '../../composables/useSeverity.js';

/**
 * LO QUE ACABA DE PASAR, ABAJO A LA IZQUIERDA.
 *
 * ⚠️ ABAJO A LA IZQUIERDA, Y NO A LA DERECHA: a la derecha vive el panel de plantilla, que es de
 * donde se arrastra. Un aviso que aparece justo encima de la lista de la que estás cogiendo gente
 * te tapa lo siguiente que ibas a coger.
 *
 * ⚠️ Y NO TAPA LA PAPELERA: la papelera es una franja pegada al borde de abajo que sale al
 * arrastrar. Los avisos se levantan por encima de ella (`bottom-[84px]`) para que nunca se
 * estorben — un aviso que impide soltar convierte una confirmación en un obstáculo.
 *
 * LEY 6: NINGÚN COLOR VA SOLO. Cada aviso lleva su palabra («Colocado», «Forzado»…) además de su
 * color, y el forzado lleva su ⚠. Un aviso verde que solo es verde no le dice nada a quien no
 * distingue el verde del naranja.
 */
defineProps({
    avisos: { type: Array, required: true },
});

const emit = defineEmits(['cerrar', 'deshacer']);

const TONO = {
    ok: { fill: OK_FILL, text: OK_TEXT, palabra: 'Hecho' },
    breach: { fill: severityFill('breach'), text: severityColor('breach'), palabra: 'Forzado' },
    info: { fill: '#534AB7', text: '#3B3486', palabra: 'Aviso' },
};

const tonoDe = (t) => TONO[t] ?? TONO.ok;
</script>

<template>
    <div
        v-if="avisos.length"
        data-t="avisos"
        class="pointer-events-none fixed bottom-[84px] left-4 z-40 flex w-[320px] flex-col gap-2"
        aria-live="polite"
    >
        <div
            v-for="a in avisos"
            :key="a.id"
            data-t="aviso"
            :data-tono="a.tono"
            class="pointer-events-auto overflow-hidden rounded-xl bg-card shadow-[0_10px_36px_-8px_rgb(30_26_60/40%)]"
            :style="{ borderLeft: `4px solid ${tonoDe(a.tono).fill}` }"
        >
            <div class="flex items-start gap-2 px-3.5 py-2.5">
                <div class="min-w-0 flex-1">
                    <div
                        class="text-[9.5px] font-bold uppercase tracking-wider"
                        :style="{ color: tonoDe(a.tono).text }"
                    >{{ tonoDe(a.tono).palabra }}</div>

                    <!-- ⚠️ NO SE TRUNCA. Ley 10: si no cabe, ENVUELVE. -->
                    <div
                        data-t="aviso-texto"
                        class="mt-0.5 break-words text-[11.5px] font-semibold leading-snug text-ink"
                    >{{ a.texto }}</div>

                    <!--
                        ⚠️ EL DAÑO COLATERAL. Llega DESPUÉS, porque el informe llega después.

                        No es una gravedad del turno que acabas de escribir: es un HECHO de otra
                        celda. Por eso va en ámbar de aviso —«mira ahí»— y no en el rojo del
                        imposible ni en el naranja del incumplimiento. Reusar esos dos aquí sería
                        decir que este turno incumple algo, y no incumple nada.
                    -->
                    <!--
                        ⚠️ EL HUECO SE RESERVA, Y SE RESERVA DICIENDO LA VERDAD.

                        El colateral tarda ~900 ms (el informe es diferido). Sin esto, la tarjeta
                        crecía y PEGABA UN SALTO justo cuando ibas a leerla. Y el relleno no es una
                        línea en blanco: es lo que de verdad está pasando.
                    -->
                    <div
                        v-if="a.comprobando"
                        data-t="aviso-comprobando"
                        class="mt-1.5 break-words text-[10.5px] font-semibold leading-snug text-ink-faint"
                    >⋯ comprobando si esto ha roto algo en otra celda</div>

                    <div
                        v-else-if="a.detalle"
                        data-t="aviso-colateral"
                        class="mt-1.5 break-words text-[10.5px] font-semibold leading-snug"
                        :style="{ color: severityColor('notice') }"
                    >↗ {{ a.detalle }}</div>

                    <button
                        v-if="a.deshacer"
                        data-t="deshacer"
                        class="mt-2 rounded-lg border border-line bg-page px-2.5 py-1 text-[11px] font-bold text-ink-soft transition hover:bg-brand-50 hover:text-ink"
                        @click="emit('deshacer', a)"
                    >↺ Deshacer</button>
                </div>

                <button
                    data-t="cerrar-aviso"
                    class="-mr-1 -mt-0.5 shrink-0 rounded p-1 text-[12px] leading-none text-ink-faint hover:text-ink"
                    aria-label="Cerrar el aviso"
                    @click="emit('cerrar', a.id)"
                >✕</button>
            </div>
        </div>
    </div>
</template>
