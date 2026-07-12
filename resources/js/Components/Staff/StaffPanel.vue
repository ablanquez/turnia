<script setup>
/**
 * EL PANEL DE PLANTILLA. Solo lo ve quien gestiona.
 *
 * Lleva contadores de horas, y "Sara lleva 41 de 40" es una conversación entre Sara
 * y su encargado. Si la app se la cuenta a toda la plantilla, la app se convierte en
 * un problema laboral.
 */
defineProps({
    staff: { type: Array, required: true },
});

const horas = (minutos) => (minutos / 60).toFixed(1).replace('.0', '');

/**
 * SIN TOPE NO ES CERO.
 *
 * Un contrato sin límite semanal no está "al 0 %": es que no tiene tope. Pintarlo
 * como una barra llena o vacía sería inventarse un dato que nadie ha dado.
 */
const anchoBarra = (persona) => {
    if (persona.limitMinutes === null) {
        return 0;
    }

    return Math.min(100, (persona.workedMinutes / persona.limitMinutes) * 100);
};
</script>

<template>
    <aside
        class="flex w-[248px] shrink-0 flex-col gap-3 self-stretch border-l border-line bg-[#FBFBFD] px-3.5 pb-4 pt-3.5"
    >
        <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-ink">Plantilla</span>
            <span class="tabular text-[10px] text-ink-faint">{{ staff.length }} contratos</span>
        </div>

        <!--
            LA VENTANA DEL CONTADOR SE DICE EN ALTO, y no es decorativo.

            El tope del perfil es SEMANAL. Si el panel enseñara las horas del día contra el
            tope de la semana, "7 de 40" leería como "va holgada" cuando en realidad lleva
            42 y está incumpliendo. Aquí siempre es la semana, mires el zoom que mires, y
            se dice para que nadie tenga que suponerlo.
        -->
        <div class="-mt-1 text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">
            Horas de esta semana
        </div>

        <div
            v-for="persona in staff"
            :key="persona.employmentId"
            class="flex flex-col gap-1.5 rounded-lg border border-[#E9E8F1] bg-white px-2.5 py-2.5"
        >
            <div class="flex items-center gap-2">
                <span
                    class="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    :style="{ background: persona.color }"
                >
                    {{ persona.initials }}
                    <!-- Trabaja hoy en otra empresa. El punto ámbar es un AVISO, no un error. -->
                    <span
                        v-if="persona.sharedElsewhere"
                        class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-[1.5px] border-white bg-notice"
                    />
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
                v-if="!persona.hasProfile"
                class="rounded px-1.5 py-1 text-[9.5px] font-semibold"
                style="background: rgba(217,164,0,.14); color: #C2870A"
            >
                Contrato sin condiciones definidas
            </div>

            <div
                v-if="persona.sharedElsewhere"
                class="rounded px-1.5 py-1 text-[9.5px] font-semibold"
                style="background: rgba(217,164,0,.14); color: #C2870A"
            >
                Esta semana también trabaja en otra empresa
            </div>
        </div>
    </aside>
</template>
