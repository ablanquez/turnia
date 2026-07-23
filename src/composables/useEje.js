/*
 * EL EJE TEMPORAL DE LA PARRILLA — 06:00 → 06:00, y se ensancha, no recorta.
 *
 * Reescrito limpio con el aprendizaje del viejo (useAxis): el eje mide un DÍA de trabajo de 06:00 a
 * 06:00 del día siguiente (360 → 1800 min). Si un turno cae fuera —la panadería que entra a las
 * 04:00— el eje SE ENSANCHA hacia ese extremo. Ningún turno se recorta jamás.
 *
 * Y las líneas de la rejilla las posiciona marcasHoras() como ELEMENTOS (ver FichaTurno): caen en
 * horas redondas (06/12/18/00) aunque el eje se ensanche. Antes eran una trama CSS de fondo que
 * arrancaba en el borde = eje.desde, y con el eje ensanchado caían en 04:00 en vez de 06:00 — un
 * fallo que vivió pintado en producción (ver bitácora). marcasHoras es la ÚNICA que sabe de horas.
 */

const DEFECTO_DESDE = 6 * 60; // 06:00
const DEFECTO_HASTA = 30 * 60; // 06:00 del día siguiente

export function minutos(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

/*
 * Normaliza un turno a minutos. Si cruza medianoche (fin ≤ inicio), fin va al día siguiente.
 *
 * ⚠️ Los minutos van en claves PROPIAS (iniMin/finMin), NO en `ini`/`fin`: si se llamaran `fin`
 * pisarían la cadena "16:00" del turno, y el rótulo acabaría diciendo "15:00–960". Una mentira
 * pintada en el rótulo. Los campos originales (inicio/fin en HH:MM) se conservan intactos.
 */
export function normaliza(turno) {
    const iniMin = minutos(turno.inicio);
    let finMin = minutos(turno.fin);
    if (finMin <= iniMin) finMin += 24 * 60;
    return { ...turno, iniMin, finMin };
}

/** El eje que abarca TODOS los turnos: por defecto 06→06, ensanchado si algo cae fuera. */
export function calcularEje(turnosNorm) {
    let desde = DEFECTO_DESDE;
    let hasta = DEFECTO_HASTA;
    for (const t of turnosNorm) {
        if (t.iniMin < desde) desde = t.iniMin;
        if (t.finMin > hasta) hasta = t.finMin;
    }
    return { desde, hasta };
}

/** left% y width% de una barra dentro del eje. Nunca recorta: si sale, es que el eje no abarca. */
export function posicion(turnoNorm, eje) {
    const total = eje.hasta - eje.desde;
    return {
        left: ((turnoNorm.iniMin - eje.desde) / total) * 100,
        width: ((turnoNorm.finMin - turnoNorm.iniMin) / total) * 100,
    };
}

/** Las marcas de hora en horas redondas dentro del eje: cada una con su left% y su etiqueta. Es la
 *  ÚNICA fuente de dónde van las líneas de la rejilla (FichaTurno las pinta como elementos). */
export function marcasHoras(eje, horas = 6) {
    const total = eje.hasta - eje.desde;
    const marcas = [];
    const primera = Math.ceil(eje.desde / (horas * 60)) * horas * 60;
    for (let m = primera; m < eje.hasta; m += horas * 60) {
        marcas.push({ left: ((m - eje.desde) / total) * 100, etiqueta: `${String((m / 60) % 24).padStart(2, '0')}:00` });
    }
    return marcas;
}
