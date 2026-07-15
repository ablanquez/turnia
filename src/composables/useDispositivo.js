import { ref, onMounted, onBeforeUnmount } from 'vue';

/*
 * LA CAPACIDAD DEL DISPOSITIVO — gestión (PC) vs consulta (móvil), desde el día 0.
 *
 * No es "encoger": son dos contratos distintos. GESTIÓN necesita pantalla ancha Y puntero fino
 * (para arrastrar un turno de pocos píxeles). CONSULTA es todo lo demás.
 *
 * ⚠️ El ancho NO se cablea aquí: se lee del token --umbral-gestion (tokens.css), un solo sitio.
 * Reactivo: si cambia el tamaño o el tipo de puntero, la vista cambia sola.
 */
export function useDispositivo() {
    const esGestion = ref(true);
    let mq = null;

    const evaluar = () => {
        if (mq) esGestion.value = mq.matches;
    };

    onMounted(() => {
        const umbral = getComputedStyle(document.documentElement)
            .getPropertyValue('--umbral-gestion')
            .trim() || '64rem';
        mq = window.matchMedia(`(min-width: ${umbral}) and (pointer: fine)`);
        evaluar();
        mq.addEventListener('change', evaluar);
    });

    onBeforeUnmount(() => {
        if (mq) mq.removeEventListener('change', evaluar);
    });

    return { esGestion };
}
