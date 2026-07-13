<script setup>
import { Deferred, Link, router } from '@inertiajs/vue3';
import { computed } from 'vue';
import { severityChip } from '../../composables/useSeverity.js';
import ZoomTabs from './ZoomTabs.vue';

const props = defineProps({
    company: { type: Object, required: true },
    calendar: { type: Object, required: true },
    window: { type: Object, required: true },
    granularity: { type: String, required: true },
    violations: { type: Object, default: undefined },
    coverage: { type: Object, default: undefined },
});

const base = computed(() => `/companies/${props.company.id}/calendars/${props.calendar.id}/schedule`);

const here = computed(() => (props.granularity === 'day'
    ? `${base.value}/day?day=`
    : `${base.value}?week=`));

const weekUrl = computed(() => `${base.value}?week=${props.window.weekOf}`);
const dayUrl = computed(() => `${base.value}/day?day=${props.window.from}`);

/**
 * EL INDICADOR CUENTA TODO LO QUE VA MAL. Y UN CUADRANTE VACÍO VA MAL.
 *
 * ⚠️ ESTE CARTEL DECÍA "SIN INCIDENCIAS", EN VERDE, SOBRE UNA SEMANA SIN UN SOLO TURNO.
 *
 * Contaba únicamente turnos que incumplen. En una semana vacía no incumple nadie —no hay a
 * quién— así que el peor cuadrante posible salía anunciado como el mejor. Un cuadrante
 * perfecto y un cuadrante inexistente daban exactamente el mismo número: cero.
 *
 * Ahora cuenta las TRES cosas que pueden ir mal, que son de naturaleza distinta y se
 * arreglan en sitios distintos:
 *
 *   · TURNOS con incumplimientos → se arregla moviendo turnos
 *   · HUECOS de cobertura        → se arregla colocando gente
 *   · AVISOS de catálogo         → no se arregla en la parrilla, sino en la configuración
 *
 * Y el verde solo aparece cuando las tres están a cero. Si hay huecos, no hay verde.
 */
const turnos = computed(() => (props.violations
    ? Object.keys(props.violations.assignments).length
        + Object.keys(props.violations.conceptEntries).length
        + Object.keys(props.violations.absences).length
    : 0));

const huecos = computed(() => props.coverage?.totals?.gaps ?? 0);
const catalogo = computed(() => props.coverage?.conflicts?.length ?? 0);

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const partes = computed(() => [
    turnos.value ? plural(turnos.value, 'turno con incidencias', 'turnos con incidencias') : null,
    huecos.value ? plural(huecos.value, 'tramo sin cubrir', 'tramos sin cubrir') : null,
    catalogo.value ? plural(catalogo.value, 'aviso de catálogo', 'avisos de catálogo') : null,
].filter(Boolean));

/**
 * EL HUECO MANDA: un puesto descubierto es más grave que un aviso de configuración, y en un
 * cuadrante vacío es LO ÚNICO que pasa. Sin él, el cartel se pintaría de gris.
 *
 * ⚠️ Y ESTOS TRES COLORES ESTABAN CABLEADOS AQUÍ, CON SU PROPIA TABLA. Es la ley 13 rota en el sitio
 * más caro de la pantalla — y no era solo duplicación: era un FALLO DE LECTURA.
 *
 * La tabla de aquí escribía el texto con el color de RELLENO (#E8590C), y useSeverity.js dice en
 * mayúsculas que el relleno es ILEGIBLE como texto. Medido sobre el fondo real del chip:
 *
 *     "5 turnos con incidencias"  #E8590C  → contraste 3,16   ❌   (el mínimo es 4,5)
 *     "1 aviso de catálogo"       #B07908  → contraste 3,34   ❌
 *     "Sin incidencias"           #15803D  → contraste 4,27   ❌
 *
 * O sea: EL DATO MÁS IMPORTANTE DE LA PANTALLA —el que dice si el cuadrante tiene problemas— se
 * pintaba en un color que cuesta leer. Y la tinta buena ya existía, a un import de distancia
 * (5,42 · 5,82 · 6,05). Nadie la usó porque había una copia a mano.
 */
const tono = computed(() => {
    if (huecos.value) {
        return severityChip('impossible');
    }

    if (turnos.value) {
        return severityChip('breach');
    }

    return severityChip('notice');
});

const logout = () => router.post('/logout');
</script>

<template>
    <div class="flex items-center gap-2">
        <Link
            :href="`${here}${window.previous}`"
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-brand-50"
        >‹</Link>

        <div class="min-w-[170px] text-center">
            <div class="text-[13.5px] font-bold text-ink">{{ window.label }}</div>
            <div class="tabular text-[10px] text-ink-faint">
                semana {{ window.isoWeek }} · {{ company.name }}
            </div>
        </div>

        <Link
            :href="`${here}${window.next}`"
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-brand-50"
        >›</Link>
    </div>

    <div class="flex-1" />

    <ZoomTabs :current="granularity" :week-url="weekUrl" :day-url="dayUrl" />

    <!--
        COMPROBANDO ≠ TODO CORRECTO.

        Mientras el informe no ha llegado, la parrilla no está diciendo que todo esté bien:
        está diciendo que TODAVÍA NO LO SABE. Pintar verde aquí sería fabricar un silencio
        falso, que es exactamente el fallo del que este proyecto se defiende. Por eso el
        indicador es explícito, y por eso NO es verde.
    -->
    <Deferred :data="['violations', 'coverage']">
        <template #fallback>
            <span class="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-[11px] font-semibold text-brand-800">
                <span class="h-2 w-2 animate-pulse rounded-full bg-brand-300" />
                Comprobando el cuadrante…
            </span>
        </template>

        <!--
            ⚠️ SIN `whitespace-nowrap`, Y ES LA LEY 10.

            Con él, el indicador —"5 turnos con incidencias · 4 tramos sin cubrir · 1 aviso de
            catálogo"— mide 460 px y no rompe NUNCA. A 960 px de ventana se salía por la derecha y
            la cabecera, que lleva overflow-hidden, LO CORTABA EN SECO: se leía "…1 aviso de".

            Un dato cortado no es medio dato: es un error con aspecto de dato. Y este es el dato
            más importante de la pantalla — el que dice si el cuadrante tiene problemas.

            Ahora envuelve. Ocupa dos líneas cuando hace falta, y se lee entero.
        -->
        <span
            v-if="partes.length"
            data-t="indicador"
            class="tabular rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            :style="tono"
            :title="partes.join('\n')"
        >{{ partes.join(' · ') }}</span>

        <!-- Verde SOLO con las tres a cero: ni turnos que incumplen, ni huecos, ni catálogo. -->
        <span
            v-else
            data-t="indicador"
            class="tabular rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            :style="severityChip('ok')"
        >Sin incidencias</span>
    </Deferred>

    <button
        class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-brand-50"
        @click="logout"
    >
        Salir
    </button>
</template>
