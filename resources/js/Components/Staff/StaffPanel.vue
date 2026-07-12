<script setup>
import { computed, ref } from 'vue';
import { shortText } from '../../composables/useSeverity.js';

/**
 * EL PANEL DE PLANTILLA. Solo lo ve quien gestiona.
 *
 * ⚠️ ES DONDE EL ENCARGADO ELIGE A QUIÉN COLOCAR, y por eso lleva BANDERAS.
 *
 * Un panel que solo diga el nombre y las horas calla justo en el momento de decidir: no
 * avisa de que esa persona está de baja, ni de que ya está comprometida en otro bar, ni de
 * que arrastra un descanso corto. Las banderas son la mitad del valor de este panel.
 *
 * Y lleva contadores de horas, que son dato laboral: "Sara lleva 42 de 40" es una
 * conversación entre Sara y su encargado, no un anuncio.
 */
const props = defineProps({
    staff: { type: Array, required: true },
    // Hacen falta para saber QUÉ turno es de QUIÉN al cruzar las violaciones.
    assignments: { type: Array, required: true },
    // Diferidas: hasta que llegan, las banderas de REGLA (descanso corto, tope pasado) no
    // se pueden afirmar. Afirmarlas antes sería inventárselas.
    violations: { type: Object, default: null },
});

const busqueda = ref('');

const horas = (minutos) => (minutos / 60).toFixed(1).replace('.0', '');

/**
 * SIN TOPE NO ES CERO.
 *
 * Un contrato sin límite semanal no está "al 0 %": es que no tiene tope. Pintarlo como una
 * barra llena o vacía sería inventarse un dato que nadie ha dado.
 */
const anchoBarra = (p) => (p.limitMinutes === null
    ? 0
    : Math.min(100, (p.workedMinutes / p.limitMinutes) * 100));

const ESTILO = {
    neutral: { bg: '#F0F0F4', color: '#5A5A66', dot: '#B4B2C0' },
    notice: { bg: 'rgba(217,164,0,.14)', color: '#C2870A', dot: '#C2870A' },
    breach: { bg: 'rgba(232,89,12,.12)', color: '#E8590C', dot: '#E8590C' },
    impossible: { bg: 'rgba(200,30,30,.12)', color: '#C81E1E', dot: '#C81E1E' },
};

/**
 * Las banderas que dependen de las REGLAS se derivan del informe, y solo cuando llega.
 *
 * "Descanso corto entre turnos" no se ve en los datos: se ve al VALIDARLOS. Mientras el
 * informe no ha llegado, el panel no lo sabe — y por tanto no lo dice. Afirmarlo antes
 * sería inventárselo; negarlo antes sería un silencio falso. Se calla.
 *
 * El aviso de doble empresa NO se saca de aquí: ya viene del servidor, y viene REDACTADO
 * según quién mira.
 */
const flagsDeReglas = (persona) => {
    if (!props.violations) {
        return [];
    }

    const susTurnos = props.assignments
        .filter((a) => a.personId === persona.personId)
        .map((a) => a.id);

    const suyas = susTurnos.flatMap((id) => props.violations.assignments[id] ?? []);

    const vistas = new Set();
    const out = [];

    for (const v of suyas) {
        // El aviso de otra empresa ya llega como bandera del servidor: no se dobla.
        if (v.code === 'shared_workday') {
            continue;
        }

        const text = shortText(v).replace(/^[●⚠↗·]\s*/, '');

        if (!vistas.has(text)) {
            vistas.add(text);
            out.push({ kind: v.severity, text });
        }
    }

    return out;
};

const visibles = computed(() => {
    const q = busqueda.value.trim().toLowerCase();

    const lista = q
        ? props.staff.filter((p) => p.name.toLowerCase().includes(q))
        : props.staff;

    return lista.map((p) => ({
        ...p,
        todasLasBanderas: [...flagsDeReglas(p), ...p.flags],
    }));
});
</script>

<template>
    <aside
        class="flex w-[248px] shrink-0 flex-col gap-3 self-stretch border-l border-line bg-[#FBFBFD] px-3.5 pb-[18px] pt-3.5"
    >
        <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-ink">Plantilla disponible</span>
            <span class="tabular text-[10px] text-ink-faint">{{ staff.length }} activos</span>
        </div>

        <input
            v-model="busqueda"
            type="text"
            placeholder="Buscar persona…"
            class="w-full rounded-[7px] border border-line bg-white px-2.5 py-[7px] text-[11.5px] text-ink-soft outline-none focus:border-brand-300"
        >

        <!--
            La ventana del contador se dice EN ALTO, y no es decorativo: el tope del perfil
            es SEMANAL, y si el panel enseñara las horas del día contra ese tope, "7 de 40"
            leería como "va holgada" cuando en realidad lleva 42 y está incumpliendo.
        -->
        <div class="-mt-1 text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">
            Horas de esta semana
        </div>

        <div
            v-for="persona in visibles"
            :key="persona.employmentId"
            class="flex flex-col gap-[7px] rounded-[9px] border border-[#E9E8F1] bg-white px-2.5 py-[9px]"
        >
            <div class="flex items-center gap-[9px]">
                <span class="relative flex shrink-0">
                    <span
                        class="tabular flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        :style="{ background: persona.color }"
                    >{{ persona.initials }}</span>
                </span>

                <div class="min-w-0 flex-1">
                    <div class="truncate text-xs font-semibold text-ink">{{ persona.name }}</div>
                    <div class="truncate text-[9.5px] text-ink-faint">
                        {{ persona.profile ?? 'Sin perfil definido' }}
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap gap-1">
                <span
                    v-for="puesto in persona.positions"
                    :key="puesto"
                    class="rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold text-brand-600"
                >{{ puesto }}</span>
            </div>

            <div class="flex items-center gap-2">
                <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEEDF4]">
                    <div
                        class="h-full rounded-full"
                        :style="{
                            width: `${anchoBarra(persona)}%`,
                            background: persona.overLimit ? '#DC2626' : '#7F77DD',
                        }"
                    />
                </div>

                <span
                    class="tabular shrink-0 text-[10px] font-semibold"
                    :style="{ color: persona.overLimit ? '#DC2626' : '#41404E' }"
                >
                    <template v-if="persona.limitMinutes !== null">
                        {{ horas(persona.workedMinutes) }} / {{ horas(persona.limitMinutes) }} h
                    </template>
                    <template v-else>
                        {{ horas(persona.workedMinutes) }} h · sin tope
                    </template>
                </span>
            </div>

            <div
                v-for="(flag, i) in persona.todasLasBanderas"
                :key="i"
                class="flex items-center gap-1.5 rounded-[5px] px-[7px] py-1 text-[9.5px] font-semibold leading-tight"
                :style="{ background: ESTILO[flag.kind].bg, color: ESTILO[flag.kind].color }"
            >
                <span
                    class="h-1.5 w-1.5 shrink-0 rounded-full"
                    :style="{ background: ESTILO[flag.kind].dot }"
                />
                {{ flag.text }}
            </div>
        </div>
    </aside>
</template>
