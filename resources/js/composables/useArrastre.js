import { reactive, readonly } from 'vue';

/**
 * ARRASTRAR Y SOLTAR. Con Pointer Events, y sin una sola dependencia.
 *
 * ⚠️ POR QUÉ NO SE USA EL DRAG & DROP DE HTML5, QUE ES «EL NATIVO»:
 *
 *   · La imagen que se arrastra la pinta EL NAVEGADOR, y no se puede sustituir por la nuestra. Y
 *     lo que hay que enseñar mientras se arrastra no es una foto de la barra: es LA PREVISUALIZACIÓN
 *     —qué pasaría si sueltas aquí—, que es media tanda.
 *   · `dragover` no da coordenadas fiables en todos los navegadores, y se dispara con un ritmo que
 *     decide el navegador, no nosotros.
 *   · No funciona con el dedo.
 *
 * ⚠️ Y POR QUÉ NO UNA LIBRERÍA (SortableJS, vuedraggable):
 *
 *   Están hechas para LISTAS ORDENABLES. Aquí no hay una lista: hay una rejilla de dos dimensiones
 *   con un eje temporal dentro de cada celda. No encaja, y las dependencias de este proyecto son
 *   Vue e Inertia. Y ya.
 *
 * Pointer Events es la API de la plataforma (es lo que envuelven por dentro las librerías),
 * funciona con ratón y con dedo, y `setPointerCapture` garantiza que los eventos siguen llegando
 * aunque el puntero salga del elemento — que es justo lo que pasa cuando arrastras.
 */

/**
 * ⚠️ UN CLIC NO ES UN ARRASTRE, Y CONFUNDIRLOS HACE LA PARRILLA INUSABLE.
 *
 * Sin este umbral, cualquier clic con un temblor de 1 px se convierte en un arrastre: se soltaría
 * la barra donde ya estaba, se llamaría al servidor, y se escribiría un turno idéntico al que ya
 * había. Cuatro píxeles es lo que separa «quise pulsar» de «quise mover».
 */
const UMBRAL = 4;

export function useArrastre() {
    const estado = reactive({
        // Lo que se arrastra: { tipo: 'persona'|'barra', … }. null = no se arrastra nada.
        carga: null,
        // Dónde está el puntero AHORA, en coordenadas de la ventana.
        x: 0,
        y: 0,
        // La celda debajo del puntero: { positionId, date } o null.
        destino: null,
        // Lo que diría el servidor si soltara aquí. Ver useEscritura: ES UNA PREVISUALIZACIÓN.
        previsualizacion: null,
        // Encima de la papelera.
        sobreLaPapelera: false,

        /*
         * ⚠️ ESTO TIENE QUE SER REACTIVO, Y LO APRENDÍ ARRASTRANDO.
         *
         * Estaba como un `let` fuera del objeto, y el fantasma NO SE PINTABA NUNCA: al pulsar,
         * `carga` cambiaba (reactivo) y Vue repintaba, pero `arrancado` seguía en false; al pasar
         * de los 4 px se ponía en true y VUE NO SE ENTERABA — no era una dependencia de nada, así
         * que no había repintado. El arrastre funcionaba (el servidor recibía las peticiones) y no
         * se veía absolutamente nada.
         *
         * Un estado que gobierna lo que se pinta y vive fuera del sistema reactivo no es un
         * descuido de Vue: es un dato que la pantalla no puede ver.
         */
        arrancado: false,
    });

    let origen = { x: 0, y: 0 };
    let alSoltar = null;
    let alMover = null;

    const celdaBajo = (x, y) => {
        const el = document.elementFromPoint(x, y)?.closest('[data-celda-destino]');

        if (!el) {
            return null;
        }

        return {
            positionId: Number(el.dataset.positionId),
            date: el.dataset.date,
        };
    };

    const papeleraBajo = (x, y) => !! document.elementFromPoint(x, y)?.closest('[data-t=papelera]');

    const mover = (e) => {
        estado.x = e.clientX;
        estado.y = e.clientY;

        /*
         * ⚠️ EL ARRASTRE NO EMPIEZA AL PULSAR: EMPIEZA AL MOVERSE CUATRO PÍXELES.
         *
         * Hasta entonces esto podría ser un clic, y un clic no tiene que levantar una papelera ni
         * llamar al servidor. Se decide aquí, no en el `pointerdown`.
         */
        if (! estado.arrancado) {
            if (Math.hypot(e.clientX - origen.x, e.clientY - origen.y) < UMBRAL) {
                return;
            }

            estado.arrancado = true;
        }

        const antes = estado.destino;
        estado.destino = celdaBajo(e.clientX, e.clientY);
        estado.sobreLaPapelera = papeleraBajo(e.clientX, e.clientY);

        // ⚠️ La previsualización se pide SOLO cuando cambia la celda, no en cada píxel. Un
        // pointermove dispara ~60 veces por segundo: pedirla en cada uno sería inundar el servidor
        // con preguntas cuya respuesta no ha cambiado.
        const cambio = antes?.positionId !== estado.destino?.positionId || antes?.date !== estado.destino?.date;

        if (cambio) {
            estado.previsualizacion = null;
            alMover?.(estado.destino);
        }
    };

    const soltar = (e) => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', cancelar);

        const carga = estado.carga;
        const destino = estado.destino;
        const papelera = estado.sobreLaPapelera;
        const arrastro = estado.arrancado;

        limpiar();

        // Un clic que no llegó a ser arrastre no suelta nada. No es un no-op silencioso: es que
        // nunca fue un arrastre.
        if (! arrastro || ! carga) {
            return;
        }

        alSoltar?.({ carga, destino, papelera });
    };

    const cancelar = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', cancelar);

        limpiar();
    };

    const limpiar = () => {
        estado.carga = null;
        estado.destino = null;
        estado.previsualizacion = null;
        estado.sobreLaPapelera = false;
        estado.arrancado = false;
    };

    /**
     * Empieza a arrastrar. Se llama desde el `pointerdown` de lo que se coge.
     *
     * `setPointerCapture` es lo que hace que esto funcione: sin él, en cuanto el puntero sale de la
     * barra (o sea, inmediatamente) los eventos dejan de llegarle y el arrastre se queda colgado.
     */
    const empezar = (e, carga, { onDrop, onCell } = {}) => {
        // Solo el botón principal. Y el clic derecho no arrastra.
        if (e.button !== 0) {
            return;
        }

        e.preventDefault();

        estado.carga = carga;
        estado.x = e.clientX;
        estado.y = e.clientY;
        origen = { x: e.clientX, y: e.clientY };
        estado.arrancado = false;
        alSoltar = onDrop;
        alMover = onCell;

        e.currentTarget.setPointerCapture?.(e.pointerId);

        window.addEventListener('pointermove', mover);
        window.addEventListener('pointerup', soltar);
        window.addEventListener('pointercancel', cancelar);
    };

    /** Lo que el servidor contestó a «¿qué pasaría si suelto aquí?». Solo para pintar. */
    const previsualizar = (resultado) => {
        estado.previsualizacion = resultado;
    };

    return {
        estado: readonly(estado),
        empezar,
        previsualizar,
        // ⚠️ `arrastrando` es "hay algo cogido Y se ha movido de verdad", no "hay algo cogido".
        arrastrando: () => estado.carga !== null && estado.arrancado,
    };
}
