/*
 * EL NEGOCIO — sus ajustes de operativa (Bloque 4 · tanda 2.d).
 *
 * ⚠️ INICIO_JORNADA_MIN es un AJUSTE DEL NEGOCIO, no una constante del programa. Cada negocio declara a
 * qué hora arranca su jornada de 24 h: una cafetería 06:00→06:00, una oficina 00:00→24:00, una
 * discoteca 03:00→03:00. El eje de la parrilla es SIEMPRE una ventana fija de 24 h desde esta hora; lo
 * que se sale por un extremo se dibuja en el día contiguo (ver `segmentar` en useEje). No se ensancha.
 *
 * FUENTE ÚNICA de la hora de arranque: ventanas, marcas y segmentación derivan de este valor. Cambiarlo
 * aquí recoloca toda la rejilla. Hoy es una constante (no hay pantalla de ajustes); cuando llegue el
 * multi-negocio se mudará al registro de cada negocio, pero seguirá siendo UN sitio.
 */
export const INICIO_JORNADA_MIN = 6 * 60; // 06:00 → 06:00 del día siguiente

/** La ventana de 24 h del día, en minutos del frame local. Fija por definición: no se ensancha. */
export const MINUTOS_DIA = 24 * 60;
