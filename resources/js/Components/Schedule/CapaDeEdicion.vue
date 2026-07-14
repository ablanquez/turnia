<script setup>
import { inject } from 'vue';
import Avisos from './Avisos.vue';
import DialogoDecision from './DialogoDecision.vue';
import PopoverHoras from './PopoverHoras.vue';

/**
 * TODO LO QUE FLOTA POR ENCIMA DE LA PARRILLA MIENTRAS SE EDITA.
 *
 * El fantasma (lo que llevas en la mano), la papelera, el popover de horas, el diálogo de decisión y
 * los avisos de lo que acaba de pasar. Vive en la página y no dentro de la rejilla porque nada de
 * esto pertenece a una celda: pertenece al GESTO, y el gesto empieza en el panel y acaba en la
 * rejilla.
 *
 * Si el que mira no puede gestionar, `edicion` es `null` y aquí no se pinta absolutamente nada.
 */
const edicion = inject('edicion', null);
</script>

<template>
    <template v-if="edicion">
        <!--
            ⚠️ LA PAPELERA APARECE AL ARRASTRAR UNA BARRA, Y NO ANTES.

            Un cubo de basura permanente en la pantalla es una invitación a un accidente. Uno que
            sale justo cuando llevas algo en la mano es una respuesta a lo que estás haciendo.

            Y NO aparece al arrastrar una PERSONA desde el panel: una persona que todavía no está
            colocada no se puede quitar. Un destino que no hace nada es ruido.
        -->
        <div
            v-if="edicion.arrastre.arrastrando() && edicion.arrastre.estado.carga?.tipo === 'barra'"
            data-t="papelera"
            class="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-center justify-center gap-2 text-[13px] font-bold transition-colors"
            :style="edicion.arrastre.estado.sobreLaPapelera
                ? { background: 'rgb(200 30 30 / 96%)', color: '#FFFFFF' }
                : { background: 'rgb(200 30 30 / 12%)', color: '#B01414' }"
        >
            <span class="text-[17px]">🗑</span>
            {{ edicion.arrastre.estado.sobreLaPapelera ? 'Suelta para quitar el turno' : 'Arrastra aquí para quitar el turno' }}
        </div>

        <!--
            EL FANTASMA: lo que llevas en la mano.

            Va con el COLOR DE LA PERSONA —el mismo canal de identidad que la barra— y NO lleva la
            gravedad. La gravedad se pinta en la CELDA DE DESTINO, que es donde se está contestando
            «¿qué pasaría si sueltas AQUÍ?». Un canal, una pregunta: la ley 0 también manda aquí.
        -->
        <div
            v-if="edicion.arrastre.arrastrando()"
            data-t="fantasma"
            class="pointer-events-none fixed z-50 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold text-white shadow-[0_6px_20px_-4px_rgb(30_26_60/45%)]"
            :style="{
                left: `${edicion.arrastre.estado.x + 14}px`,
                top: `${edicion.arrastre.estado.y + 14}px`,
                background: edicion.arrastre.estado.carga?.persona?.color ?? '#534AB7',
            }"
        >
            {{ edicion.arrastre.estado.carga?.persona?.name }}
            <span v-if="edicion.arrastre.estado.carga?.assignment" class="tabular opacity-80">
                {{ edicion.arrastre.estado.carga.assignment.label }}
            </span>
        </div>

        <PopoverHoras
            :abierto="!! edicion.colocando.value"
            :modo="edicion.colocando.value?.modo ?? 'colocar'"
            :persona="edicion.colocando.value?.persona"
            :celda="edicion.colocando.value?.celda"
            :sugerido="edicion.sugerido.value"
            :previsualizacion="edicion.previaPopover.value"
            :ocupado="edicion.ocupado.value"
            @cerrar="edicion.cerrarPopover"
            @cambiar="edicion.previsualizarPopover"
            @confirmar="edicion.confirmarPopover"
        />

        <DialogoDecision
            :decision="edicion.decision.value"
            :persona="edicion.decision.value?.persona ?? ''"
            :cuando="edicion.decision.value?.cuando ?? ''"
            @cerrar="edicion.cerrarDecision"
            @forzar="edicion.forzar"
        />

        <!--
            LO QUE ACABA DE PASAR. Y con él, lo que la acción ROMPIÓ EN OTRA CELDA.

            Va el último para quedar por encima de la papelera, y por debajo de los dos diálogos
            (z-40 contra z-50): un aviso nunca puede tapar una decisión.
        -->
        <Avisos
            :avisos="edicion.avisos"
            @cerrar="edicion.cerrarAviso"
            @deshacer="(a) => { edicion.cerrarAviso(a.id); a.deshacer(); }"
        />
    </template>
</template>
