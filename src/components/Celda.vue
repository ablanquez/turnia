<script setup>
/*
 * UNA CELDA — puesto × día. Apila las FICHAS de sus turnos (una por turno, en orden), y al fondo
 * reserva el HUECO de la tira de cobertura.
 *
 * Una persona con dos turnos en el día son DOS fichas apiladas (cada una con su barra), no dos
 * barras en la misma pista: así cada turno tiene su propio alto y se lee sin amontonar.
 *
 * ⚠️ EL HUECO DE COBERTURA ES SITIO RESERVADO, NO UN ESTADO. La tira funcional del viejo
 * (verde/rojo/ámbar + conteos -3/-2/+1) es capa SEMÁNTICA y necesita el motor, que aún no existe. Se
 * reserva ya su alto real (15 px + 9 de separación, medidos en el viejo) para que al llegar sea
 * encajar y no rehacer el alto de la celda —igual que el stub de la vista móvil—. Y NO se pinta con
 * el gris `sunken` del viejo: allí ese gris significaba a la vez «cubierto» y «no se pide nada» (dos
 * cosas opuestas, un color), y mordió. Aquí es un borde punteado neutro: «pendiente», no un estado.
 */
import { computed } from 'vue';
import { PERSONAS_POR_ID } from '../datos/semana.js';
import { useArrastre } from '../composables/useArrastre.js';
import { marcasHoras, posicion } from '../composables/useEje.js';
import FichaTurno from './FichaTurno.vue';

const props = defineProps({
    // SEGMENTOS de esta celda (2.d): cada turno aporta 1 ó 2 trozos; aquí llegan los de este (día, puesto).
    segmentos: { type: Array, required: true },
    eje: { type: Object, required: true },
    dia: { type: String, required: true }, // clave del día (para ser destino del arrastre)
    puesto: { type: String, required: true }, // id del puesto
});

const { arrastre } = useArrastre();

const ordenados = computed(() => [...props.segmentos].sort((a, b) => a.iniLocal - b.iniLocal));

// ¿Es esta la celda bajo el puntero durante un arrastre? → se resalta. El resalte va en la CELDA
// (anillo interior de marca), NUNCA en la barra: la restricción del color se respeta al pie.
const esDestino = computed(() =>
    arrastre.activo && arrastre.destino
    && arrastre.destino.dia === props.dia && arrastre.destino.puesto === props.puesto);

// La REGLA temporal: mientras se arrastra sobre esta celda, se pintan las marcas de hora a lo ancho
// de una pista —tenga fichas o no—, para no soltar a ciegas (resuelve las celdas sin rejilla). El
// [data-regla] es además lo que el arrastre mide para mapear píxeles → minutos.
const marcas = computed(() => marcasHoras(props.eje, 6));

// El CONTORNO-preview: solo al retimar en ESTA celda, dónde caería el TROZO agarrado con su nuevo
// horario (arrastre.retSeg, ya re-segmentado: correcto también en un partido cerca del borde). Contorno
// neutro (marca), sin relleno: no toca el color de identidad.
const preview = computed(() => {
    if (arrastre.modo !== 'retimar' || !esDestino.value || !arrastre.retSeg) return null;
    return posicion(arrastre.retSeg, props.eje);
});
</script>

<template>
    <div
        class="flex min-h-16 flex-col p-2"
        :class="{ 'ring-2 ring-inset ring-brand-300': esDestino }"
        data-celda
        :data-dia="dia"
        :data-puesto="puesto"
    >
        <div class="flex flex-col gap-3">
            <!-- Un trozo por segmento. Key = id del turno + índice de día: los dos trozos del mismo
                 turno NO comparten key (el mordisco del duplicado exacto no se repite), pero comparten
                 identidad por turno.id → lápiz/arrastre/borrado actúan sobre el turno entero. -->
            <FichaTurno
                v-for="s in ordenados"
                :key="s.turno.id + '::' + s.diaIndex"
                :turno="s.turno"
                :eje="eje"
                :color="PERSONAS_POR_ID[s.turno.persona].color"
                :nombre="PERSONAS_POR_ID[s.turno.persona].nombre"
                :dia="dia"
                :ini-local="s.iniLocal"
                :fin-local="s.finLocal"
                :corte-ini="s.corteIni"
                :corte-fin="s.corteFin"
                :nota-fuera="s.notaFuera"
            />
        </div>

        <!-- La regla temporal (solo mientras se arrastra sobre esta celda). Misma geometría que la
             pista de una ficha (ml/pl [9px], h-4), para que las marcas y el preview caigan donde caería
             una barra de verdad. El contorno-preview marca el horario resultante al retimar. -->
        <div v-if="esDestino" class="ml-[9px] mt-2 border-l-2 border-transparent pl-[9px]">
            <div data-regla class="relative h-4 overflow-hidden rounded bg-sunken">
                <span
                    v-for="m in marcas"
                    :key="m.etiqueta"
                    class="absolute inset-y-0 w-px bg-line-soft"
                    :style="{ left: m.left + '%' }"
                />
                <div
                    v-if="preview"
                    class="absolute inset-y-0 rounded-[3px] border-2 border-brand-600"
                    :style="{ left: preview.left + '%', width: preview.width + '%' }"
                    aria-hidden="true"
                />
            </div>
        </div>

        <!--
            Hueco de cobertura RESERVADO (Bloque 3): vacío, al fondo de la celda (el flex-1 lo empuja,
            como en el viejo), alineado bajo las pistas. Alto de la tira real (15 px) + su separación
            (9 px). Borde punteado neutro = «pendiente», nunca el gris-estado del viejo.
        -->
        <template v-if="ordenados.length">
            <div class="flex-1" />
            <div class="ml-5 mt-[9px] h-[15px] rounded-sm border border-dashed border-line" aria-hidden="true" />
        </template>
    </div>
</template>
