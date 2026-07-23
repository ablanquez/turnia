/*
 * EL EJE TEMPORAL DE LA PARRILLA — una VENTANA FIJA de 24 h por día. No se ensancha (Bloque 4 · 2.d).
 *
 * ⚠️ DEROGA la ley del Bloque 3 «el eje se ensancha, nunca recorta». Aquella era un eje ÚNICO y
 * elástico que estiraba sus bordes para que cupiera todo (la panadería de las 04:00 lo ensanchaba por
 * la izquierda). El modelo nuevo lo invierte: cada día es una ventana FIJA `[E, E+1440]` con
 * `E = INICIO_JORNADA_MIN` (ajuste de negocio, ver negocio.js). Lo que se sale de una ventana NO la
 * ensancha: se dibuja en el día contiguo (`segmentar`). El dato sigue siendo UN turno; se parte el
 * DIBUJO, no el dato. Por qué el cambio: un negocio abre a una hora y su jornada dura 24 h; ensanchar
 * el eje era un parche que deformaba la escala de todos los días por un turno de madrugada.
 *
 * Las líneas de la rejilla las posiciona marcasHoras() como ELEMENTOS (ver FichaTurno): caen en horas
 * redondas (06/12/18/00). Con la ventana fija son idénticas en toda la rejilla. marcasHoras es la ÚNICA
 * que sabe de horas (nace de un fallo real que vivió en producción; ver bitácora).
 */
import { INICIO_JORNADA_MIN, MINUTOS_DIA } from '../datos/negocio.js';

/** El eje del día: la ventana fija de 24 h desde la hora de arranque del negocio. NO se ensancha. */
export const EJE_DIA = { desde: INICIO_JORNADA_MIN, hasta: INICIO_JORNADA_MIN + MINUTOS_DIA };

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

/*
 * SEGMENTAR — un turno, hasta DOS trozos dibujados (Bloque 4 · 2.d). Sustituye a calcularEje.
 *
 * Cada día `k` tiene su ventana `Wk = [k·1440 + E, k·1440 + E + 1440]`. Un turno del día `d` ocupa, en
 * una línea de tiempo global, `[S, S+dur]` con `S = d·1440 + iniMin` y `dur = finMin − iniMin` (finMin
 * ya trae el cruce de medianoche de normaliza). Se INTERSECTA con cada ventana; cada intersección no
 * vacía es un trozo. Como `dur ≤ 1440` y la ventana mide 1440, toca a lo sumo 2 ventanas consecutivas.
 *
 * La MISMA fórmula parte por los dos lados —no hay dos casos, hay uno con signo—: si iniMin < E, `S`
 * cae en la ventana anterior y el turno corta hacia `d−1` (la panadería de las 04:00 es la madrugada
 * de la jornada anterior); si se pasa del final, corta hacia `d+1`. Los `corte*` marcan qué borde es un
 * tajo (no el extremo real del turno); `offView` marca los trozos de un día fuera de la semana visible.
 */
export function segmentar(turnosNorm, dias, E = INICIO_JORNADA_MIN) {
    const indiceDe = new Map(dias.map((d, i) => [d.clave, i]));
    const n = dias.length;
    const segmentos = [];
    for (const t of turnosNorm) {
        const d = indiceDe.get(t.dia);
        if (d == null) continue; // turno de un día que no está en esta vista
        const S = d * MINUTOS_DIA + t.iniMin;
        const fin = d * MINUTOS_DIA + t.finMin; // finMin puede pasar de 1440 (cruce de medianoche)
        // El turno solo puede tocar la ventana de su día y las dos contiguas (dur ≤ 1 día).
        for (let k = d - 1; k <= d + 1; k++) {
            const wIni = k * MINUTOS_DIA + E;
            const wFin = wIni + MINUTOS_DIA;
            const a = Math.max(S, wIni);
            const b = Math.min(fin, wFin);
            if (b <= a) continue; // no intersecta esta ventana
            segmentos.push({
                turno: t,
                diaIndex: k,
                dia: k >= 0 && k < n ? dias[k].clave : null,
                offView: k < 0 || k >= n,
                iniLocal: a - k * MINUTOS_DIA, // en el frame local [E, E+1440]
                finLocal: b - k * MINUTOS_DIA,
                corteIni: a > S, // este borde es un tajo, no el inicio real del turno
                corteFin: b < fin, // este borde es un tajo, no el fin real
            });
        }
    }
    return segmentos;
}

/*
 * EL EJE DEL EDITOR — una ventana de 24 h que contiene al turno ENTERO para mostrarlo sin partir. El
 * editor no parte (edita un turno solo): si el turno cabe en la ventana del negocio, la usa (marcas en
 * 06/12/18/00); si se sale, ancla la ventana a su inicio (siempre cabe, porque dur ≤ 24 h). NO es la
 * ley vieja del ensanche: es el frame privado del editor, no el eje compartido de la parrilla.
 */
export function ejeEditor(iniMin, finMin, E = INICIO_JORNADA_MIN) {
    const cabe = iniMin >= E && finMin <= E + MINUTOS_DIA;
    const desde = cabe ? E : iniMin;
    return { desde, hasta: desde + MINUTOS_DIA };
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

/*
 * El snap del ARRASTRE (Bloque 4 · tanda 2, afinado a 15 en la 2.c). A 5,35 px/hora en la vista
 * semanal, el minuto exacto es inagarrable (0,09 px); el arrastre APROXIMA en saltos de 15 min. FUENTE
 * ÚNICA del grano y de los DOS caminos de arrastre (retimado en la parrilla, tiradores del editor): no
 * se parten, o un turno tecleado a las 10:15 se movería solo al retimarlo. El TECLADO no pasa por aquí:
 * afina al minuto exacto (ver escribirInicio/escribirFin en useEditor).
 *
 * ⚠️ Esto NO es la duración mínima. La mínima (el muro contra la duración cero de normaliza) vive
 * aparte en editarTurno.js con su propio número y su propia razón; ver bitácora «dos motivos».
 */
export const GRANULARIDAD_MIN = 15;

/** Minutos (posiblemente fuera de [0,1440) si cruzan medianoche) → cadena "HH:MM" del día (mod 24h).
 *  Fuente única del formateo de hora: lo usan retimarTurno (el fin recalculado) y el arrastre (la
 *  etiqueta en vivo), para no tener dos copias del mismo redondeo. */
export function formatoHora(min) {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

/** Ajusta un instante (min) al múltiplo de la granularidad más cercano (redondeo, no truncado). */
export function ajustaGranularidad(min, granularidad = GRANULARIDAD_MIN) {
    return Math.round(min / granularidad) * granularidad;
}

/** Inversa de `posicion`: dado un x en píxeles RELATIVO al borde izquierdo de la pista y el ancho de
 *  la pista, devuelve el instante (min) del eje en esa x. `posicion` mapea minutos→%; esta, px→minutos.
 *  Es el mapeo que el retimado necesita para saber a qué hora cae el puntero. */
export function minutosEnX(eje, xRel, anchoPista) {
    return eje.desde + (xRel / anchoPista) * (eje.hasta - eje.desde);
}
