import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * EL ANCHO MÍNIMO DE LA SEMANA, Y DE DÓNDE SALE ESE NÚMERO.
 *
 * No es un gusto: es una SUMA, y se puede seguir con el dedo.
 *
 *   32   el aire de la página (p-4 a cada lado)
 *    4   el borde de la tarjeta
 *  112   el raíl de los puestos ("Sumiller" en negrita, con su aire)
 * 1050   los siete días, a 150 px de mínimo cada uno
 *   40   el panel de plantilla RECOGIDO
 *  ────
 * 1238   → se redondea a 1240
 *
 * Por debajo de esto, los siete días NO CABEN a la vez. La parrilla sigue funcionando —se
 * desplaza, y no esconde ni recorta nada— pero se pierde lo único que una vista de SEMANA sabe
 * hacer: verla entera de un vistazo.
 *
 * ⚠️ Y ESO SE DICE. El silencio no significa "todo bien" tampoco aquí: si alguien abre Turnia en
 * una ventana a media pantalla y ve tres días y medio, tiene que saber que le faltan cuatro, y no
 * deducirlo de que la barra de scroll está ahí.
 */
export const MIN_SEMANA = 1240;

/**
 * El ancho de la ventana, reactivo. Se lee del navegador, no se declara: `window.innerWidth`
 * después de `resize`, que es el único que dice la verdad.
 */
export function useAncho() {
    const ancho = ref(typeof window === 'undefined' ? MIN_SEMANA : window.innerWidth);

    const medir = () => { ancho.value = window.innerWidth; };

    onMounted(() => {
        medir();
        window.addEventListener('resize', medir, { passive: true });
    });

    onBeforeUnmount(() => window.removeEventListener('resize', medir));

    return { ancho };
}
