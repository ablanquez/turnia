import { ref, watch } from 'vue';

const CLAVE = 'turnia.panel-plantilla';

/**
 * EL PANEL DE PLANTILLA ARRANCA RECOGIDO, Y NO ES UN CAPRICHO.
 *
 * Es una herramienta de CONSULTA —"¿a quién puedo poner aquí?"— no algo que haya que estar
 * mirando todo el rato. Desplegado se come 264 px del ancho, y el ancho es lo que le falta
 * a la parrilla. Con él recogido, la semana respira.
 *
 * La preferencia se recuerda: si lo dejas abierto, sigue abierto la próxima vez. Lo que no
 * se recuerda es la primera vez de nadie, y esa arranca recogida.
 */
const guardado = typeof localStorage !== 'undefined' ? localStorage.getItem(CLAVE) : null;

export const panelAbierto = ref(guardado === 'abierto');

watch(panelAbierto, (abierto) => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CLAVE, abierto ? 'abierto' : 'recogido');
    }
});

export function alternarPanel() {
    panelAbierto.value = !panelAbierto.value;
}
