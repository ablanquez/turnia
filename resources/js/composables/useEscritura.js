import { router } from '@inertiajs/vue3';

/**
 * HABLAR CON EL SERVIDOR PARA ESCRIBIR UN TURNO.
 *
 * ⚠️ Y LAS DOS FUNCIONES QUE HAY AQUÍ NO SON LA MISMA, AUNQUE SE PAREZCAN:
 *
 *     previsualizar()  →  /assignments/preview   NO ESCRIBE. Sirve para PINTAR mientras arrastras.
 *     colocar/mover()  →  /assignments           ABRE EL CANDADO y RE-VALIDA dentro. Esta MANDA.
 *
 * Van a rutas distintas, a controladores distintos, y **la respuesta de la primera NUNCA se le pasa
 * a la segunda**. Ni siquiera se guarda para eso.
 *
 * Lo que la previsualización dice es una foto del estado de hace un momento. Para cuando el usuario
 * suelte el ratón puede ser mentira —alguien pudo escribir en medio, y basta con que sea él mismo
 * en otra pestaña—. Y no pasa nada: porque no decide.
 *
 *     EL TOCTOU NO ES «DOS PERSONAS A LA VEZ».
 *     ES «EL ESTADO CAMBIÓ ENTRE QUE COMPROBÉ Y ESCRIBÍ».
 *
 * Ver app/Services/Scheduling/Writing/AssignmentWriter.php y docs/ESTRES-MOTOR.md §4.
 */

const csrf = () => document.querySelector('meta[name=csrf-token]')?.content ?? '';

async function pedir(url, method, cuerpo) {
    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrf(),
        },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });

    // 200 escrito · 422 imposible (o petición inválida) · 409 hace falta que decidas · 403 no puedes
    const datos = await res.json().catch(() => ({}));

    return { status: res.status, ...datos };
}

export function useEscritura(company, calendar) {
    const base = `/companies/${company.id}/calendars/${calendar.id}/assignments`;

    /**
     * ⚠️ ESTO NO DECIDE NADA. Se llama mientras se arrastra, y su respuesta solo sirve para PINTAR.
     *
     * Si el servidor dice «limpio» y el usuario suelta, NO se escribe por eso: se vuelve a
     * preguntar dentro del candado, y esa segunda respuesta es la que manda. Aunque contradiga a
     * esta. Aunque hayan pasado tres milisegundos.
     */
    const previsualizar = (draft, assignmentId = null) => pedir(
        assignmentId ? `${base}/${assignmentId}/preview` : `${base}/preview`,
        'POST',
        draft,
    );

    /** Las horas que propone el servidor para una celda vacía: el hueco de cobertura. */
    const hueco = async (positionId, date) => {
        const res = await fetch(`${base}/hueco?positionId=${positionId}&workDate=${date}`, {
            headers: { Accept: 'application/json' },
        });

        return res.json();
    };

    /* ── LAS QUE DECIDEN. Todas pasan por el candado. ─────────────────────────── */

    const colocar = (draft) => pedir(base, 'POST', draft);

    const mover = (assignmentId, draft) => pedir(`${base}/${assignmentId}`, 'PATCH', draft);

    const quitar = (assignmentId) => pedir(`${base}/${assignmentId}`, 'DELETE');

    /**
     * ⚠️ EL REPINTADO. Y NO LO HACE LA ESCRITURA: LO PIDE EL CLIENTE, DESPUÉS.
     *
     * `router.reload()` vuelve a pedir la página entera, y con ella las props DIFERIDAS
     * (`violations` y `coverage`). O sea que el informe —719 ms, ~1.700 consultas— NO está en el
     * camino de la escritura: la escritura contesta en milisegundos, la barra aparece en su sitio
     * nuevo, y los avisos llegan detrás. Exactamente igual que en la carga inicial, y con el mismo
     * fallback honesto: «comprobando el cuadrante…», nunca verde.
     *
     * ⚠️ Y ESTO ES LO QUE RESUELVE «MOVER UN TURNO PUEDE ROMPER OTRO».
     *
     * La escritura no calcula los daños colaterales. No le hace falta: el informe diferido se
     * recalcula sobre el estado REAL y para toda la semana, así que el turno de OTRA persona que
     * acaba de quedarse sin descanso se pinta en rojo solo. Sin que la escritura sepa que existe.
     */
    const repintar = () => router.reload({ preserveScroll: true });

    return { previsualizar, hueco, colocar, mover, quitar, repintar };
}
