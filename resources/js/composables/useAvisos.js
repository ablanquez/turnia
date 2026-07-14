import { reactive } from 'vue';

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * DECIR LO QUE ACABA DE PASAR. Y NO ES CORTESÍA: ES LA MITAD DEL DATO.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Arrastras, sueltas, la parrilla se repinta — y nadie te dice qué has hecho. En una aplicación
 * que existe para NO MENTIR, **el silencio después de una acción es una forma de no contar**.
 *
 * ⚠️ Y HAY UNA RAZÓN QUE NO ES ESTÉTICA, Y ES LA QUE MANDA:
 *
 *     LA PARRILLA CAMBIA EN SITIOS QUE NO ESTABAS MIRANDO.
 *
 * Mueves a Iker del miércoles al jueves. El jueves lo estás mirando: ahí está la barra, en su
 * sitio. Pero el hueco rojo que acabas de abrir aparece en el MIÉRCOLES —la celda que dejó—, fuera
 * de tu foco visual, a media pantalla de distancia. Está medido: mover ese turno lleva la semana de
 * 4 a 5 tramos sin cubrir. Sin un aviso, **la consecuencia de tu acción ocurre donde no estás
 * mirando**, y eso es un silencio falso con las manos en la masa.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * ⚠️ QUÉ SE DICE AQUÍ, Y QUÉ NO
 * ───────────────────────────────────────────────────────────────────────────────────────
 *
 * Aquí se cuenta lo que **SÍ ha pasado**: se escribió, se movió, se quitó, se forzó.
 *
 * Lo que **NO ha pasado** —el candado dijo que no— NO se cuenta con un aviso de estos: se cuenta
 * con el DIÁLOGO, que es un modal, que se planta en el centro y que hay que cerrar a mano. Un
 * rechazo del candado es la información más importante que esta aplicación puede dar, y meterlo en
 * una tarjetita que se desvanece a los seis segundos sería DEGRADARLO. Un aviso que se va solo vale
 * para confirmar; no vale para negar.
 *
 * Y por eso hay un tercer estado —`persistente`— para lo que sí se cuenta aquí y NO se puede
 * perder: nunca se cierra solo.
 */

let siguiente = 0;

export function useAvisos() {
    const avisos = reactive([]);

    const cerrar = (id) => {
        const i = avisos.findIndex((a) => a.id === id);

        if (i !== -1) {
            clearTimeout(avisos[i].reloj);
            avisos.splice(i, 1);
        }
    };

    /**
     * ⚠️ EL TEMPORIZADOR SE REARMA, NO SE ACUMULA.
     *
     * El detalle del daño colateral llega ~700 ms DESPUÉS del aviso (el informe es diferido y caro).
     * Si el reloj no se reiniciara al añadirlo, la frase que más importa —«ojo, has abierto un hueco
     * en el miércoles»— aparecería con el aviso ya medio ido. Escribir algo que nadie llega a leer
     * es no escribirlo.
     */
    const armar = (aviso) => {
        clearTimeout(aviso.reloj);

        if (aviso.persistente) {
            return;
        }

        aviso.reloj = setTimeout(() => cerrar(aviso.id), aviso.vida);
    };

    /**
     * @param {object} o
     * @param {'ok'|'breach'|'info'} o.tono
     * @param {string} o.texto      Qué ha pasado. Con sujeto, puesto, día y hora: ley 8.
     * @param {Function} [o.deshacer]  Si se pasa, el aviso lleva botón. Y vive más: hay que decidir.
     */
    const avisar = ({ tono = 'ok', texto, deshacer = null, persistente = false }) => {
        const aviso = reactive({
            id: ++siguiente,
            tono,
            texto,
            deshacer,
            persistente,
            // Un aviso con botón vive el doble: leerlo es rápido, decidir no lo es.
            vida: deshacer ? 12000 : 6000,
            detalle: null,
            reloj: null,
        });

        avisos.push(aviso);
        armar(aviso);

        return aviso.id;
    };

    /** Lo que la escritura rompió EN OTRA PARTE. Llega tarde, porque el informe llega tarde. */
    const añadirDetalle = (id, detalle) => {
        const aviso = avisos.find((a) => a.id === id);

        if (! aviso || ! detalle) {
            return;
        }

        aviso.detalle = detalle;
        armar(aviso);
    };

    return { avisos, avisar, añadirDetalle, cerrar };
}

/**
 * ⚠️ EL COLATERAL SE MIDE COMPARANDO EL INFORME DE ANTES CON EL DE DESPUÉS. NO SE DEDUCE.
 *
 * La escritura NO calcula los daños que causa en otras celdas, y eso es a propósito: el informe
 * (719 ms, ~1.700 consultas) está FUERA del camino de la escritura, y ahí se queda. Lo que se hace
 * es más sencillo y más honesto: se guarda una foto de los huecos ANTES, se escribe, y cuando el
 * informe diferido vuelve a llegar se comparan las dos fotos.
 *
 * O sea que esto no predice nada: MIRA el estado real, después. Y por eso no puede mentir.
 *
 * Devuelve `null` cuando no hay nada que decir — o cuando NO SE PUEDE decir (el informe todavía no
 * había llegado cuando se escribió, así que no hay «antes» con el que comparar). Callarse porque no
 * se sabe es correcto; **inventarse un «sin novedad» sería un silencio falso**.
 */
export function huecosPorCelda(coverage) {
    if (! coverage?.segments) {
        return null;
    }

    const mapa = new Map();

    for (const s of coverage.segments) {
        if (s.state !== 'missing') {
            continue;
        }

        const clave = `${s.positionId}|${s.workDate}`;

        mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
    }

    return mapa;
}

/**
 * Las celdas donde AHORA falta gente y antes no faltaba (o faltaba menos).
 *
 * @returns {Array<{positionId: number, date: string, nuevos: number}>}
 */
export function huecosNuevos(antes, despues) {
    if (! antes || ! despues) {
        return [];
    }

    const nuevos = [];

    for (const [clave, cuantos] of despues) {
        const habia = antes.get(clave) ?? 0;

        if (cuantos > habia) {
            const [positionId, date] = clave.split('|');

            nuevos.push({ positionId: Number(positionId), date, nuevos: cuantos - habia });
        }
    }

    return nuevos;
}
