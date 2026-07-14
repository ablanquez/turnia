<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { severityFill, severityColor, shortText } from '../../composables/useSeverity.js';

/**
 * LO QUE PASA AL SOLTAR, CUANDO NO SE PUEDE SOLTAR SIN MÁS.
 *
 * Dos casos, y son distintos de raíz — es la ley 14 otra vez, ahora en la escritura:
 *
 *   IMPOSIBLE (rojo)        → NO se escribe. Se explica por qué, y la barra vuelve a su sitio.
 *   INCUMPLIMIENTO (naranja) → Se puede forzar. Se avisa, se explica, Y SE PIDE UNA JUSTIFICACIÓN.
 *
 * ⚠️ Y EL DROP NO SE RECHAZA EN SILENCIO. Decisión tomada: se DEJA soltar, se valida, y entonces se
 * dice que no y por qué. Un drop que simplemente «no engancha» es frustrante y no enseña nada: el
 * usuario prueba tres veces y se va pensando que la app está rota.
 */
const props = defineProps({
    // { resultado: 'imposible'|'necesita_decision', violations: [], cambioElEstado: bool } | null
    decision: { type: Object, default: null },
    persona: { type: String, default: '' },
    cuando: { type: String, default: '' },
});

const emit = defineEmits(['cerrar', 'forzar']);

const motivo = ref('');
const campo = ref(null);

const esImposible = computed(() => props.decision?.resultado === 'imposible');
const severidad = computed(() => (esImposible.value ? 'impossible' : 'breach'));

const codigos = computed(() => [...new Set((props.decision?.violations ?? []).map((v) => v.code))]);

// ⚠️ El motivo es OBLIGATORIO. Si se pudiera saltar, en tres semanas todas las justificaciones
// estarían vacías y el registro no valdría nada: una firma sin contrato.
const puedeForzar = computed(() => motivo.value.trim().length >= 3);

watch(() => props.decision, async (d) => {
    motivo.value = '';

    if (d?.resultado === 'necesita_decision') {
        await nextTick();
        campo.value?.focus();
    }
});
</script>

<template>
    <div
        v-if="decision"
        data-t="dialogo"
        :data-resultado="decision.resultado"
        class="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(30_26_60/45%)] p-4"
        @click.self="emit('cerrar')"
        @keydown.esc="emit('cerrar')"
    >
        <div class="w-full max-w-[440px] overflow-hidden rounded-2xl bg-card shadow-[0_20px_60px_-12px_rgb(30_26_60/45%)]">
            <!-- LA CABECERA LLEVA LA GRAVEDAD, Y CON EL MISMO COLOR QUE LA BARRA. Se emparejan. -->
            <div class="px-5 py-3.5 text-white" :style="{ background: severityFill(severidad) }">
                <div class="text-[10px] font-bold uppercase tracking-wider opacity-90">
                    {{ esImposible ? 'No se puede colocar' : 'Esto incumple el convenio' }}
                </div>
                <div class="mt-0.5 text-[14px] font-bold">
                    {{ persona }}<span v-if="cuando" class="tabular font-semibold opacity-90"> · {{ cuando }}</span>
                </div>
            </div>

            <div class="px-5 py-4">
                <!--
                    ⚠️ EL ESTADO CAMBIÓ ENTRE QUE SE LE PREGUNTÓ Y QUE CONTESTÓ. Y se le dice.

                    Justificó forzar una cosa y, para cuando el candado se abrió, incumplía OTRA.
                    Escribirlo igual sería estamparle una firma sobre un contrato que no leyó.
                -->
                <div
                    v-if="decision.cambioElEstado"
                    data-t="cambio-de-estado"
                    class="mb-3 rounded-lg border border-[#E8590C] bg-[rgb(232_89_12/8%)] px-3 py-2 text-[11.5px] font-semibold leading-snug"
                    :style="{ color: severityColor('breach') }"
                >
                    ⚠ El cuadrante ha cambiado mientras decidías. Lo que incumple ahora <b>no es lo que
                    se te enseñó</b>, así que tu justificación no vale para esto. Mira los motivos nuevos.
                </div>

                <!-- LOS MOTIVOS. Uno por línea, con su hora y su sujeto: un aviso sin motivo es un muro. -->
                <ul data-t="motivos" class="flex flex-col gap-1.5">
                    <li
                        v-for="(v, i) in decision.violations"
                        :key="i"
                        class="flex items-start gap-2 text-[12px] leading-snug"
                        :style="{ color: severityColor(v.severity) }"
                    >
                        <span class="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: severityFill(v.severity) }" />
                        <span class="min-w-0">
                            <b>{{ shortText(v).replace(/^[●⚠↗·]\s*/, '') }}</b>
                            <span class="block text-ink-soft">{{ v.message }}</span>
                        </span>
                    </li>
                </ul>

                <!-- EL IMPOSIBLE NO OFRECE SALIDA, PORQUE NO LA HAY. Se cierra y se arregla. -->
                <p v-if="esImposible" class="mt-3 text-[12px] leading-snug text-ink-soft">
                    No se ha escrito nada. La barra vuelve a su sitio: para colocarla aquí hay que
                    <b>quitar o cambiar</b> lo que la impide.
                </p>

                <!--
                    EL INCUMPLIMIENTO SÍ. Y la justificación es OBLIGATORIA: es el único dato de toda
                    la aplicación que no se deriva de nada. El incumplimiento se DERIVA (re-validando);
                    quién decidió saltárselo y POR QUÉ, no se deduce de ninguna fila.
                -->
                <div v-else class="mt-4">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                        ¿Por qué lo fuerzas?
                    </label>
                    <textarea
                        ref="campo"
                        v-model="motivo"
                        data-t="motivo"
                        rows="3"
                        class="mt-1.5 w-full resize-none rounded-lg border border-line bg-page px-3 py-2 text-[12.5px] leading-snug text-ink outline-none focus:border-brand-300"
                        placeholder="Cubre el cierre de la noche anterior. Se compensa el jueves."
                    />
                    <p class="mt-1 text-[10.5px] leading-snug text-ink-faint">
                        Queda registrado con tu nombre y la fecha. Es lo único que esta aplicación
                        <b>no puede deducir sola</b>.
                    </p>
                </div>
            </div>

            <div class="flex items-center justify-end gap-2 border-t border-line bg-[#F7F7FB] px-5 py-3">
                <button
                    data-t="cancelar"
                    class="rounded-lg border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-soft hover:bg-brand-50"
                    @click="emit('cerrar')"
                >
                    {{ esImposible ? 'Entendido' : 'Cancelar' }}
                </button>

                <button
                    v-if="! esImposible"
                    data-t="forzar"
                    :disabled="! puedeForzar"
                    class="rounded-lg px-3 py-1.5 text-[12px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                    :style="{ background: severityFill('breach') }"
                    @click="emit('forzar', { reason: motivo.trim(), codes: codigos })"
                >
                    Forzar de todos modos
                </button>
            </div>
        </div>
    </div>
</template>
