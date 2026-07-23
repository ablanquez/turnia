<script setup>
/*
 * EL EDITOR DE TURNO — modal centrado (Bloque 4 · tanda 2.b). Se abre por el lápiz de la ficha o tras
 * un arrastre. La barra grande (≈720px sobre 24 h → ~30 px/hora, 5,6× la semanal) da sitio a que los
 * DOS TIRADORES funcionen, cosa imposible en la parrilla (5,35 px/hora). Los tiradores mueven un
 * extremo con snap de media hora y TOPE de duración mínima; NUNCA tocan el color de la barra (mover el
 * borde + el número en vivo bastan). Aplicar gobierna solo lo de dentro; el arrastre ya se aplicó.
 */
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { DIAS, PUESTOS } from '../datos/semana.js';
import { marcasHoras, posicion, minutosEnX, formatoHora, minutos } from '../composables/useEje.js';
import { tintaSobre } from '../estilo/reglas.js';
import { useEditor } from '../composables/useEditor.js';

const { editor, moverInicio, moverFin, escribirInicio, escribirFin, aplicar, eliminar, pedirBorrado, cancelarBorrado, cerrarEditor } = useEditor();

// El teclado AFINA al minuto. type=time devuelve "" cuando el valor está a medias o vacío: ese caso se
// IGNORA (no se puede borrar un extremo → no hay estado imposible por esa vía). Un valor válido "HH:MM"
// entra al modelo por `minutos()` (la misma que ya traduce las horas de la fuente) y pasa por el muro.
const tecleaInicio = (v) => { if (v) escribirInicio(minutos(v)); };
const tecleaFin = (v) => { if (v) escribirFin(minutos(v)); };

const iniciales = computed(() => (editor.nombre || '').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase());
const marcas = computed(() => marcasHoras(editor.eje, 3)); // marcas cada 3 h: hay sitio para más
const pos = computed(() => posicion({ iniMin: editor.iniMin, finMin: editor.finMin }, editor.eje));
const durMin = computed(() => editor.finMin - editor.iniMin);
const durTexto = computed(() => {
    const h = Math.floor(durMin.value / 60), m = durMin.value % 60;
    return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ') || '0 min';
});

// ── Tiradores: puntero → minuto sobre la barra grande (misma inversa que el retimado, minutosEnX) ──
const barRef = ref(null);
let cual = null;
function cogerTirador(e, extremo) {
    e.stopPropagation();
    cual = extremo;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    window.addEventListener('pointermove', moverTirador);
    window.addEventListener('pointerup', soltarTirador);
}
function moverTirador(e) {
    if (!cual || !barRef.value) return;
    const r = barRef.value.getBoundingClientRect();
    const min = minutosEnX(editor.eje, e.clientX - r.left, r.width);
    if (cual === 'inicio') moverInicio(min); else moverFin(min);
}
function soltarTirador() {
    cual = null;
    window.removeEventListener('pointermove', moverTirador);
    window.removeEventListener('pointerup', soltarTirador);
}

function alTecla(e) { if (e.key === 'Escape') cerrarEditor(); }
onMounted(() => window.addEventListener('keydown', alTecla));
onUnmounted(() => { window.removeEventListener('keydown', alTecla); soltarTirador(); });
</script>

<template>
    <!-- Scrim (composición, no toca ninguna barra) + clic fuera para cerrar sin aplicar. -->
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 p-4" @pointerdown.self="cerrarEditor">
        <div class="w-full max-w-3xl rounded-xl border border-edge bg-card p-6 shadow-xl" role="dialog" aria-modal="true">
            <!-- Cabecera: identidad + cerrar -->
            <div class="flex items-start gap-3">
                <span
                    class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    :style="{ background: editor.color, color: tintaSobre(editor.color) }"
                >{{ iniciales }}</span>
                <div class="min-w-0 flex-1">
                    <div class="text-base font-semibold text-ink">{{ editor.nombre }}</div>
                    <div class="font-mono text-sm text-ink-soft">{{ formatoHora(editor.iniMin) }}–{{ formatoHora(editor.finMin) }} · {{ durTexto }}</div>
                </div>
                <button class="rounded p-1 text-ink-faint hover:text-ink" aria-label="Cerrar" @click="cerrarEditor">✕</button>
            </div>

            <!-- La barra grande, con marcas, y los dos tiradores -->
            <div class="mt-6">
                <div ref="barRef" class="relative h-10 rounded-md bg-sunken">
                    <span v-for="m in marcas" :key="m.etiqueta" class="absolute inset-y-0 w-px bg-line-soft" :style="{ left: m.left + '%' }" />
                    <!-- la barra de identidad, color pleno -->
                    <div data-t="barra-editor" class="absolute inset-y-1 rounded" :style="{ left: pos.left + '%', width: pos.width + '%', background: editor.color }" />
                    <!-- tirador de inicio -->
                    <div
                        class="absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded bg-ink-soft"
                        :class="{ 'bg-ink ring-2 ring-ink': editor.topado === 'inicio' }"
                        :style="{ left: pos.left + '%' }"
                        data-tirador="inicio"
                        @pointerdown="cogerTirador($event, 'inicio')"
                    />
                    <!-- tirador de fin -->
                    <div
                        class="absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded bg-ink-soft"
                        :class="{ 'bg-ink ring-2 ring-ink': editor.topado === 'fin' }"
                        :style="{ left: (pos.left + pos.width) + '%' }"
                        data-tirador="fin"
                        @pointerdown="cogerTirador($event, 'fin')"
                    />
                </div>
                <!-- etiquetas de hora bajo las marcas -->
                <div class="relative mt-1 h-4">
                    <span v-for="m in marcas" :key="m.etiqueta" class="absolute -translate-x-1/2 font-mono text-[10px] text-ink-faint" :style="{ left: m.left + '%' }">{{ m.etiqueta }}</span>
                </div>
            </div>

            <!-- Inicio y fin al minuto exacto (type=time). El ARRASTRE aproxima en saltos de 15; el
                 TECLADO afina. Son la MISMA vista del borrador que la barra: mueves el tirador y el
                 campo se actualiza (:value ligado a formatoHora); tecleas y la barra/tirador se mueven.
                 type=time hace imposible teclear basura ("25:99", "abc") sin un parser a mano. -->
            <div class="mt-4 flex flex-wrap gap-4">
                <label class="flex flex-col gap-1 text-sm text-ink-soft">Inicio
                    <input
                        type="time" data-hora="inicio"
                        class="rounded border border-line bg-card px-2 py-1 font-mono text-ink"
                        :value="formatoHora(editor.iniMin)"
                        @input="tecleaInicio($event.target.value)"
                    />
                </label>
                <label class="flex flex-col gap-1 text-sm text-ink-soft">Fin
                    <input
                        type="time" data-hora="fin"
                        class="rounded border border-line bg-card px-2 py-1 font-mono text-ink"
                        :value="formatoHora(editor.finMin)"
                        @input="tecleaFin($event.target.value)"
                    />
                </label>
            </div>

            <!-- Día y puesto -->
            <div class="mt-6 flex flex-wrap gap-4">
                <label class="flex flex-col gap-1 text-sm text-ink-soft">Día
                    <select v-model="editor.dia" class="rounded border border-line bg-card px-2 py-1 text-ink">
                        <option v-for="d in DIAS" :key="d.clave" :value="d.clave">{{ d.etiqueta }} {{ d.numero }}</option>
                    </select>
                </label>
                <label class="flex flex-col gap-1 text-sm text-ink-soft">Puesto
                    <select v-model="editor.puesto" class="rounded border border-line bg-card px-2 py-1 text-ink">
                        <option v-for="pu in PUESTOS" :key="pu.id" :value="pu.id">{{ pu.nombre }}</option>
                    </select>
                </label>
            </div>

            <!-- Pie: eliminar (confirmación inline) · cancelar · aplicar -->
            <div class="mt-8 flex items-center justify-between">
                <div>
                    <!-- Eliminar NO usa rojo: el rojo es semántica-imposible DEL CUADRANTE; darlo a un
                         botón mezclaría familias (color = información, no decoración). La seguridad la da
                         la CONFIRMACIÓN inline, no el color. El "Sí, eliminar" va en ink fuerte (neutro). -->
                    <button v-if="!editor.confirmandoBorrado" class="rounded px-3 py-1.5 text-sm text-ink-soft hover:bg-band hover:text-ink" @click="pedirBorrado">Eliminar turno</button>
                    <span v-else class="inline-flex items-center gap-2 text-sm text-ink">
                        ¿Eliminar turno?
                        <button class="rounded bg-ink px-2 py-1 text-xs font-semibold text-card" @click="eliminar">Sí, eliminar</button>
                        <button class="rounded px-2 py-1 text-xs text-ink-soft hover:bg-band" @click="cancelarBorrado">No</button>
                    </span>
                </div>
                <div class="flex gap-2">
                    <button class="rounded px-3 py-1.5 text-sm text-ink-soft hover:bg-band" @click="cerrarEditor">Cancelar</button>
                    <button class="rounded bg-brand-600 px-3 py-1.5 text-sm font-semibold text-card hover:bg-brand-800" @click="aplicar">Aplicar cambios</button>
                </div>
            </div>
        </div>
    </div>
</template>
