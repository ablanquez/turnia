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
 *
 * `notaFuera` (solo en trozos visibles): el otro trozo del turno cae FUERA de la semana. La geometría
 * no puede explicar lo que no está en pantalla, así que ahí —y SOLO ahí— hace falta texto (ver
 * bitácora: el chevron descartado). Ocurre únicamente en los BORDES de la vista: un tajo por el inicio
 * en el primer día (viene de antes), o por el fin en el último (va después). En un partido interior
 * (los dos trozos visibles) es null: ya lo estás viendo.
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
            const corteIni = a > S; // este borde es un tajo, no el inicio real del turno
            const corteFin = b < fin; // este borde es un tajo, no el fin real
            const enVista = k >= 0 && k < n;
            // La nota solo cuando el trozo contiguo (donde sigue el turno) está fuera de la vista, y eso
            // solo pasa en los bordes: corte por el inicio en el día 0, o por el fin en el último.
            let notaFuera = null;
            if (enVista && corteIni && k === 0) notaFuera = { dir: 'antes', dia: dias[n - 1].etiqueta };
            else if (enVista && corteFin && k === n - 1) notaFuera = { dir: 'despues', dia: dias[0].etiqueta };
            segmentos.push({
                turno: t,
                diaIndex: k,
                dia: enVista ? dias[k].clave : null,
                offView: !enVista,
                iniLocal: a - k * MINUTOS_DIA, // en el frame local [E, E+1440]
                finLocal: b - k * MINUTOS_DIA,
                corteIni,
                corteFin,
                notaFuera,
            });
        }
    }
    return segmentos;
}

/*
 * EL EJE DEL EDITOR — una ventana de 24 h (o algo más) que contiene al turno ENTERO para mostrarlo sin
 * partir. El editor no parte (edita un turno solo), y su razón de existir es ver el turno de un vistazo;
 * recortarle la cola sería una barra recortada, o sea una mentira dibujada.
 *
 * `desde = min(iniMin, E)`: ancla en el arranque del negocio (06:00) cuando el turno empieza dentro de
 * la jornada, y en el propio inicio cuando empieza ANTES (la panadería de las 04:00). `hasta` mide 24 h
 * salvo que el turno se SALGA por el final (cruza las 06:00 por la cola, como Iker 22:00→07:00): ahí la
 * ventana se ALARGA lo justo para contenerlo, y así las 22:00 caen cerca del final del eje en vez de al
 * 0 % (2.d · PC2.b: antes anclaba al inicio y plantaba el arranque a la izquierda). Degrada EXACTO al
 * comportamiento anterior en los dos casos que ya iban bien (cabe / empieza antes de E): solo cambia el
 * que estaba roto. NO es la ley vieja del ensanche: es el frame privado del editor, no el eje de la
 * parrilla (que sí parte lo que se sale, para eso está el modelo de 2.d).
 */
export function ejeEditor(iniMin, finMin, E = INICIO_JORNADA_MIN) {
    const desde = Math.min(iniMin, E);
    return { desde, hasta: Math.max(desde + MINUTOS_DIA, finMin) };
}

/*
 * EL ACARREO DEL DÍA (Bloque 4 · 2.d · PC2.b) — FUENTE ÚNICA. Un turno guarda su arranque como el par
 * `(dia, inicio)`, donde `dia` es la fecha de calendario en la que cae el reloj `inicio`. Cuando una
 * operación mueve el arranque a través de la medianoche, el reloj vuelve a empezar por 00:00 pero el
 * DÍA tiene que sumar ±1: si no, `(dia, inicio)` nombra un instante un día entero por detrás (o por
 * delante). Ese acarreo se tragaban los TRES caminos que empujan el inicio (arrastre, tirador, teclado)
 * porque los tres hacían `inicio = formatoHora(min)` y dejaban `dia` quieto (ver bitácora). Aquí vive
 * una sola vez; retimarTurno y editarTurno pasan por aquí.
 *
 * `sumarDias` usa Date.UTC (no la local) para que el ± n días no lo desvíe ningún cambio de horario.
 */
export function sumarDias(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Un inicio en minutos desde la medianoche de `dia` (posiblemente <0 o ≥1440 si cruza) → el par
 *  {dia, inicio} correcto, con el acarreo del día ya trasladado a la fecha. `fin` NO se toca aquí:
 *  sigue siendo reloj y lo re-deriva `normaliza`. */
export function anclarInicio(dia, min) {
    return { dia: sumarDias(dia, Math.floor(min / MINUTOS_DIA)), inicio: formatoHora(min) };
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
