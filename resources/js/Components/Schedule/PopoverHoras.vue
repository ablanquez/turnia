<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { severityColor, severityFill, shortText } from '../../composables/useSeverity.js';

/**
 * LAS HORAS DE UN TURNO. Y la previsualización EN VIVO mientras se escriben.
 *
 * ⚠️ EL MISMO POPOVER PARA LAS DOS COSAS, Y NO ES AHORRO DE CÓDIGO: ES QUE ES LA MISMA PREGUNTA.
 *
 *   COLOCAR (arrastrando a alguien del panel a una celda vacía) → ¿de qué hora a qué hora?
 *   EDITAR  (pulsando sobre un turno y soltando sin moverlo)     → ¿de qué hora a qué hora?
 *
 * Cambia de dónde salen las horas de partida, y cambia el verbo del botón. El flujo —previsualizar
 * en vivo, confirmar, CANDADO— es idéntico, porque la pregunta es idéntica.
 *
 * ⚠️ AL COLOCAR, LAS HORAS LAS PROPONE EL SERVIDOR, Y SALEN DEL HUECO DE COBERTURA.
 *
 * La celda ya sabe qué se pide ahí («faltan 1 de 12:00 a 20:00»), así que se prefijan esas horas:
 * colocar a alguien DONDE FALTA GENTE es lo que se quiere hacer nueve de cada diez veces. Si el
 * puesto no pide a nadie ese día, los campos salen VACÍOS — y eso no es un fallo: es la verdad. Un
 * «09:00–17:00 por defecto» sería fabricar un dato con aspecto de dato.
 *
 * ⚠️ Y LO QUE SE PINTA AQUÍ ES UNA PREVISUALIZACIÓN. NO DECIDE NADA.
 *
 * Al confirmar se valida OTRA VEZ, dentro del candado, y esa es la que manda — aunque contradiga a
 * esta. Ver useEscritura.js.
 */
const props = defineProps({
    abierto: { type: Boolean, default: false },
    modo: { type: String, default: 'colocar' },  // colocar | editar
    persona: { type: Object, default: null },
    celda: { type: Object, default: null },      // { positionId, date, positionName, dia }
    // Las horas de partida: el hueco de cobertura al colocar, las que ya tiene al editar.
    sugerido: { type: Object, default: null },   // { start, end, motivo }
    previsualizacion: { type: Object, default: null },
    ocupado: { type: Boolean, default: false },
});

const emit = defineEmits(['cerrar', 'confirmar', 'cambiar']);

const start = ref('');
const end = ref('');
const campo = ref(null);

const editando = computed(() => props.modo === 'editar');

watch(() => props.sugerido, (s) => {
    start.value = s?.start ?? '';
    end.value = s?.end ?? '';
});

watch(() => props.abierto, async (v) => {
    if (v) {
        await nextTick();
        campo.value?.focus();
        campo.value?.select();
    }
});

const HORA = /^(?:[01]\d|2[0-4]):[0-5]\d$/;

const validas = computed(() => HORA.test(start.value) && HORA.test(end.value));

/**
 * ⚠️ AL EDITAR, SI LAS HORAS NO HAN CAMBIADO NO HAY NADA QUE GUARDAR.
 *
 * Y no es una optimización: escribir un turno idéntico al que hay le pasaría por el candado, le
 * BORRARÍA EL OVERRIDE (la justificación caduca al mover, ver AssignmentWriter::move) y volvería a
 * preguntar si se fuerza — todo para dejarlo exactamente igual que estaba. Un botón que no cambia
 * nada pero destruye una firma es peor que un botón que no hace nada.
 */
const cambiadas = computed(() => start.value !== props.sugerido?.start || end.value !== props.sugerido?.end);

const severidad = computed(() => props.previsualizacion?.severidad ?? null);

const puedeConfirmar = computed(() => validas.value
    && severidad.value !== 'impossible'
    && ! props.ocupado
    && (! editando.value || cambiadas.value));

// Cada vez que las horas cambian y son válidas, se vuelve a preguntar «¿qué pasaría?». El motor
// valida en 4-6 ms: da de sobra para contestar mientras se teclea.
watch([start, end], () => {
    if (validas.value) {
        emit('cambiar', { start: start.value, end: end.value });
    }
});
</script>

<template>
    <div
        v-if="abierto"
        data-t="popover-colocar"
        :data-modo="modo"
        class="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(30_26_60/45%)] p-4"
        @click.self="emit('cerrar')"
        @keydown.esc="emit('cerrar')"
    >
        <div class="w-full max-w-[380px] overflow-hidden rounded-2xl bg-card shadow-[0_20px_60px_-12px_rgb(30_26_60/45%)]">
            <div class="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
                <span
                    class="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    :style="{ background: persona?.color }"
                >{{ persona?.initials }}</span>
                <div class="min-w-0">
                    <div class="truncate text-[13px] font-bold text-ink">{{ persona?.name }}</div>
                    <div class="tabular text-[10.5px] text-ink-faint">
                        {{ celda?.positionName }} · {{ celda?.dia }}
                    </div>
                </div>
            </div>

            <div class="px-5 py-4">
                <div class="flex items-end gap-3">
                    <label class="flex-1">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Entra</span>
                        <input
                            ref="campo"
                            v-model="start"
                            data-t="start"
                            placeholder="12:00"
                            class="tabular mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-[14px] font-bold text-ink outline-none focus:border-brand-300"
                            @keydown.enter="puedeConfirmar && emit('confirmar', { start, end })"
                        >
                    </label>

                    <label class="flex-1">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Sale</span>
                        <input
                            v-model="end"
                            data-t="end"
                            placeholder="20:00"
                            class="tabular mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-[14px] font-bold text-ink outline-none focus:border-brand-300"
                            @keydown.enter="puedeConfirmar && emit('confirmar', { start, end })"
                        >
                    </label>
                </div>

                <!-- DE DÓNDE SALEN LAS HORAS. Se dice: un valor prefijado sin explicación es magia. -->
                <p v-if="sugerido?.motivo" data-t="de-donde" class="mt-1.5 text-[10.5px] leading-snug text-ink-faint">
                    ↳ {{ sugerido.motivo }}
                </p>

                <!--
                    LA PREVISUALIZACIÓN. Con la MISMA escala de gravedad que la parrilla, y por la
                    misma razón: si aquí el naranja significara otra cosa, habría que aprender dos
                    idiomas para leer la misma aplicación.
                -->
                <div
                    v-if="validas"
                    data-t="previsualizacion"
                    :data-severidad="severidad ?? 'limpio'"
                    class="mt-3.5 rounded-lg px-3 py-2 text-[11.5px] font-semibold leading-snug"
                    :style="severidad
                        ? { background: `${severityFill(severidad)}1A`, color: severityColor(severidad) }
                        : { background: 'rgb(21 128 61 / 12%)', color: '#0F5C2C' }"
                >
                    <template v-if="! previsualizacion">Comprobando…</template>

                    <template v-else-if="! severidad">✅ Sin incidencias</template>

                    <template v-else>
                        <div v-for="(v, i) in previsualizacion.violations" :key="i">
                            {{ shortText(v) }}
                        </div>
                        <div v-if="severidad === 'impossible'" class="mt-1 font-bold">
                            No se puede colocar aquí.
                        </div>
                        <div v-else-if="severidad === 'breach'" class="mt-1 font-bold">
                            Se puede forzar, y habrá que justificarlo.
                        </div>
                    </template>
                </div>
            </div>

            <div class="flex items-center justify-end gap-2 border-t border-line bg-[#F7F7FB] px-5 py-3">
                <button
                    data-t="cancelar"
                    class="rounded-lg border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-soft hover:bg-brand-50"
                    @click="emit('cerrar')"
                >Cancelar</button>

                <button
                    data-t="colocar"
                    :disabled="! puedeConfirmar"
                    class="rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
                    @click="emit('confirmar', { start, end })"
                >{{ editando ? 'Guardar horas' : 'Colocar' }}</button>
            </div>
        </div>
    </div>
</template>
