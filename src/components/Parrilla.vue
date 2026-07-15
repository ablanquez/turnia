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
import { DIAS, PUESTOS, TURNOS } from '../datos/semana.js';
import { normaliza, calcularEje } from '../composables/useEje.js';
import Celda from './Celda.vue';
import Marca from '../estilo/marca/Marca.vue';

const norm = TURNOS.map(normaliza);
const eje = calcularEje(norm);

const turnosDe = (puestoId, diaClave) => norm.filter((t) => t.puesto === puestoId && t.dia === diaClave);
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
                    class="grid min-w-max"
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
                        />
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>
