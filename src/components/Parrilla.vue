<script setup>
/*
 * LA PARRILLA — la rejilla días × puestos, con la ficha de cada turno dentro de su celda.
 *
 * Es la vista de GESTIÓN (PC): la columna de puestos y la cabecera de días quedan fijas al desplazar,
 * y si los siete días no caben, se desplaza en horizontal (no se encoge).
 *
 * Cuatro decisiones de composición, todas con tokens (cero #hex suelto):
 *   · CAJETÍN: toda la rejilla va en un panel-tarjeta redondeado sobre el fondo gris de página.
 *   · FILAS ALTERNAS por puesto (card / band) para que el ojo no se pierda al cruzar los 7 días.
 *   · MARCO de cada celda con la línea de día (line) y la de sección (edge) en los bordes fijos.
 *   · El eje se calcula UNA vez sobre todos los turnos: todas las pistas comparten escala y alinean.
 */
import { computed } from 'vue';
import { DIAS, PUESTOS } from '../datos/semana.js';
import { normaliza, calcularEje } from '../composables/useEje.js';
import { useCuadrante } from '../composables/useCuadrante.js';
import { useArrastre } from '../composables/useArrastre.js';
import { useEditor } from '../composables/useEditor.js';
import Celda from './Celda.vue';
import FichaTurno from './FichaTurno.vue';
import EditorTurno from './EditorTurno.vue';
import Marca from '../estilo/marca/Marca.vue';

const { turnos } = useCuadrante();
const { arrastre } = useArrastre();
const { editor } = useEditor();

// El eje y la normalización se rehacen solos al mover (aunque mover NO cambia el eje: mismas horas
// reubicadas → misma escala, sujeto por moverTurno.test). Con el estado reactivo, computed basta.
const norm = computed(() => turnos.value.map(normaliza));
const eje = computed(() => calcularEje(norm.value));

const turnosDe = (puestoId, diaClave) => norm.value.filter((t) => t.puesto === puestoId && t.dia === diaClave);
</script>

<template>
    <div class="flex h-screen flex-col bg-page">
        <header class="flex items-center gap-3 px-4 py-3">
            <Marca :tamano="24" />
            <span class="text-sm text-ink-soft">Cuadrante · semana del 13 al 19 jul</span>
        </header>

        <div class="min-h-0 flex-1 px-4 pb-4">
            <!--
                El cajetín se mide por su CONTENIDO (la rejilla), no por la ventana: altura automática
                (sin h-full), así cierra a ras de la última fila sin pozo blanco. `max-h-full` es solo un
                tope: si un día la rejilla crece más que el hueco disponible, hace scroll dentro; nunca
                se estira de más. El aire bajo la última fila lo da el padding interno de cada celda.
            -->
            <div class="max-h-full overflow-auto rounded-xl border border-edge bg-card">
                <div
                    class="grid min-w-full"
                    :style="{ gridTemplateColumns: `9rem repeat(${DIAS.length}, minmax(11rem, 1fr))` }"
                >
                    <!-- esquina -->
                    <div class="sticky left-0 top-0 z-30 border-b-2 border-r-2 border-edge bg-rail" />

                    <!-- cabecera de días -->
                    <div
                        v-for="d in DIAS"
                        :key="d.clave"
                        class="sticky top-0 z-20 border-b-2 border-r border-edge border-r-line bg-rail px-3 py-2 text-sm font-semibold text-ink"
                    >
                        {{ d.etiqueta }} <span class="font-normal text-ink-faint">{{ d.numero }}</span>
                    </div>

                    <!-- filas de puestos (alternan card / band) -->
                    <template v-for="(p, i) in PUESTOS" :key="p.id">
                        <div
                            class="sticky left-0 z-10 flex items-center border-b border-r-2 border-line border-r-edge px-3 text-sm font-medium text-ink"
                            :class="i % 2 ? 'bg-band' : 'bg-card'"
                        >
                            {{ p.nombre }}
                        </div>
                        <Celda
                            v-for="d in DIAS"
                            :key="p.id + d.clave"
                            class="border-b border-r border-line"
                            :class="i % 2 ? 'bg-band' : 'bg-card'"
                            :turnos="turnosDe(p.id, d.clave)"
                            :eje="eje"
                            :dia="d.clave"
                            :puesto="p.id"
                        />
                    </template>
                </div>
            </div>
        </div>

        <!--
            EL PROXY del arrastre: la ficha cogida, a COLOR PLENO, siguiendo al puntero. Fixed, sobre
            todo (z-50), y `pointer-events-none` para no taparse a sí misma en el hit-testing
            (elementFromPoint debe ver la celda de debajo). Señal de «levantado» = BORDE exterior, sin
            sombra (decisión de Antonio): no se toca el color de la barra. Posición = puntero − desfase
            de agarre, así no salta al cogerla.
        -->
        <div
            v-if="arrastre.activo && arrastre.turno"
            data-proxy
            class="pointer-events-none fixed z-50 rounded-lg border border-edge bg-card p-2"
            :style="{ left: (arrastre.x - arrastre.offX) + 'px', top: (arrastre.y - arrastre.offY) + 'px', width: arrastre.ancho + 'px' }"
        >
            <FichaTurno :turno="arrastre.turno" :eje="eje" :color="arrastre.color" :nombre="arrastre.nombre" es-proxy />
            <!-- Al RETIMAR: la hora resultante (ya snapped) en vivo. Texto, nunca sobre la barra. -->
            <div
                v-if="arrastre.modo === 'retimar'"
                class="mt-1 rounded bg-ink px-1.5 py-0.5 text-center font-mono text-[11px] leading-none text-card"
            >
                {{ arrastre.horaIni }}–{{ arrastre.horaFin }}
            </div>
        </div>

        <!-- El editor de turno (modal), a nivel raíz de la gestión. Se abre por el lápiz o tras un arrastre. -->
        <EditorTurno v-if="editor.abierto" />
    </div>
</template>
