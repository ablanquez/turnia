/*
 * EL EDITOR DE TURNO — estado del modal y lógica de los tiradores (Bloque 4 · tanda 2.b).
 *
 * El borrador vive en MINUTOS ABSOLUTOS (iniMin/finMin sobre el eje; finMin > iniMin SIEMPRE, puede
 * pasar de 1440 al cruzar medianoche). Los tiradores mueven un extremo con snap y TOPE: la duración
 * queda en [DURACION_MINIMA, DURACION_MAXIMA] por construcción, así que la duración cero es
 * inalcanzable (ver editarTurno / bitácora). El eje del editor se fija al abrir (no re-escala en vivo).
 *
 * Se abre por el LÁPIZ de la ficha o AUTOMÁTICAMENTE tras un arrastre que cambió algo (reubicar o
 * retimar). ARRASTRAR MUEVE, EL EDITOR AFINA: el arrastre ya se aplicó al soltar; el editor gobierna
 * solo lo que se toca dentro (horas, día, puesto) y solo al Aplicar. Cerrar sin aplicar NO deshace el
 * arrastre.
 */
import { reactive } from 'vue';
import { editar, borrar, norm } from './useCuadrante.js';
import { PERSONAS_POR_ID } from '../datos/semana.js';
import { ajustaGranularidad, calcularEje } from './useEje.js';
import { acotaInicio, acotaFin, horaAAbsoluto } from './editarTurno.js';

const estado = reactive({
    abierto: false,
    turnoId: null,
    persona: null, nombre: null, color: null,
    iniMin: 0, finMin: 0, // borrador, minutos absolutos (finMin > iniMin)
    dia: '', puesto: '',
    eje: { desde: 360, hasta: 1800 }, // eje del editor, fijo mientras está abierto
    confirmandoBorrado: false,
    topado: null, // 'inicio' | 'fin' | null — para la señal de tope (lo lee el modal)
});

/** Abre el editor sobre el turno `id` (lee su estado actual del cuadrante). */
export function abrirEditor(id) {
    const t = norm.value.find((x) => x.id === id);
    if (!t) return;
    const p = PERSONAS_POR_ID[t.persona];
    estado.turnoId = t.id;
    estado.persona = t.persona; estado.nombre = p.nombre; estado.color = p.color;
    estado.iniMin = t.iniMin; estado.finMin = t.finMin;
    estado.dia = t.dia; estado.puesto = t.puesto;
    estado.eje = calcularEje([t]); // 06→06 ensanchado para este turno
    estado.confirmandoBorrado = false;
    estado.topado = null;
    estado.abierto = true;
}

export function cerrarEditor() {
    estado.abierto = false;
    estado.confirmandoBorrado = false;
    estado.topado = null;
}

/*
 * DOS MANDOS, UN SOLO DATO, UN SOLO MURO. Tiradores y teclado escriben el MISMO borrador
 * (iniMin/finMin) pasando por el MISMO clamp puro (acotaInicio/acotaFin en editarTurno). La única
 * diferencia: el ARRASTRE aproxima (snap de 15), el TECLADO afina (minuto exacto, sin snap). Como los
 * dos cruzan el muro, la duración cero es inalcanzable por cualquier camino (ver 3.d / bitácora).
 */

// ── Tiradores (arrastre): snap de 15 y luego el muro ──
export function moverInicio(minCrudo) {
    const { iniMin, topado } = acotaInicio(ajustaGranularidad(minCrudo), estado);
    estado.iniMin = iniMin; estado.topado = topado;
}
export function moverFin(minCrudo) {
    const { finMin, topado } = acotaFin(ajustaGranularidad(minCrudo), estado);
    estado.finMin = finMin; estado.topado = topado;
}

// ── Teclado (type=time): hora de reloj → minuto absoluto (cruce de medianoche solo) → el mismo muro,
//    SIN snap. El campo vacío no llega aquí (lo filtra el .vue): no se puede "borrar" un extremo. ──
export function escribirInicio(clock) {
    const { iniMin, topado } = acotaInicio(horaAAbsoluto(clock, 'inicio', estado), estado);
    estado.iniMin = iniMin; estado.topado = topado;
}
export function escribirFin(clock) {
    const { finMin, topado } = acotaFin(horaAAbsoluto(clock, 'fin', estado), estado);
    estado.finMin = finMin; estado.topado = topado;
}

export function pedirBorrado() { estado.confirmandoBorrado = true; }
export function cancelarBorrado() { estado.confirmandoBorrado = false; }

export function aplicar() {
    editar(estado.turnoId, { iniMin: estado.iniMin, finMin: estado.finMin, dia: estado.dia, puesto: estado.puesto });
    cerrarEditor();
}

export function eliminar() {
    borrar(estado.turnoId);
    cerrarEditor();
}

export function useEditor() {
    return { editor: estado, moverInicio, moverFin, escribirInicio, escribirFin, aplicar, eliminar, pedirBorrado, cancelarBorrado, cerrarEditor };
}
