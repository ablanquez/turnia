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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ EL TOKEN SALE DE LA **COOKIE**, NO DEL `<meta>`. Y ESTO ERA UN BUG QUE MATABA LA APP.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * El `<meta name="csrf-token">` se renderiza UNA VEZ, en la carga inicial del documento. Y esto es
 * una SPA de Inertia: **el documento no se vuelve a cargar nunca**. Se navega entre semanas, se
 * escribe, pasan horas — y ese meta sigue diciendo el token de entonces.
 *
 * El día que la sesión se renueva (`SESSION_LIFETIME`, un despliegue, o —en desarrollo— un
 * `migrate:fresh` que vacía la tabla `sessions`), **el token del meta deja de valer y TODAS las
 * peticiones empiezan a dar 419**. La página sigue pintada, el arrastre sigue funcionando, y no se
 * puede escribir absolutamente nada.
 *
 * La cookie `XSRF-TOKEN`, en cambio, **Laravel la reescribe en CADA respuesta**. Siempre está
 * fresca. Es exactamente lo que hace Axios —el cliente que trae Laravel de fábrica— y por eso a
 * nadie le pasa esto usando Axios: **el bug lo introduje yo al usar `fetch` a pelo y copiar el
 * patrón del meta, que es el de un formulario, no el de una SPA.**
 *
 * (El meta se conserva como último recurso: si la cookie no estuviera, algo peor pasa.)
 */
const csrf = () => {
    const cookie = document.cookie
        .split('; ')
        .find((c) => c.startsWith('XSRF-TOKEN='));

    if (cookie) {
        return decodeURIComponent(cookie.slice('XSRF-TOKEN='.length));
    }

    return document.querySelector('meta[name=csrf-token]')?.content ?? '';
};

/**
 * ⚠️ TODA RESPUESTA QUE NO ESPERÁBAMOS ES UN FALLO, Y UN FALLO **SE DICE**.
 *
 * Esto devolvía `{ status: 419 }` y quien lo llamaba solo miraba 200/409/422/403. El 419 no caía en
 * ninguna rama: **`return` implícito, silencio absoluto**. El usuario arrastraba, soltaba, y no
 * pasaba nada. Ni se movía, ni salía un error. Nada.
 *
 * Y una petición que falla en silencio es lo mismo que una regla que no se comprueba: la aplicación
 * parece que funciona y no está haciendo su trabajo.
 *
 * Ahora sale con `fallo`, y con un motivo que se le puede enseñar a un humano.
 */
async function pedir(url, method, cuerpo) {
    let res;

    try {
        res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': csrf(),
            },
            body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        });
    } catch (e) {
        // La red se cayó, o el servidor no está. `fetch` LANZA aquí, no devuelve un status.
        return { status: 0, fallo: 'red', mensaje: 'No se ha podido hablar con el servidor. Comprueba la conexión.' };
    }

    // 200 escrito · 422 imposible · 409 hace falta que decidas · 403 no puedes
    if ([200, 403, 409, 422].includes(res.status)) {
        const datos = await res.json().catch(() => ({}));

        return { status: res.status, ...datos };
    }

    return { status: res.status, fallo: motivoDe(res.status), mensaje: mensajeDe(res.status) };
}

const motivoDe = (status) => {
    if (status === 419) return 'sesion';
    if (status === 401 || status === 302) return 'sesion';
    if (status >= 500) return 'servidor';

    return 'inesperado';
};

const mensajeDe = (status) => {
    if (status === 419 || status === 401 || status === 302) {
        return 'Tu sesión ha caducado. Recarga la página para seguir: no se ha escrito nada.';
    }

    if (status >= 500) {
        return 'El servidor ha fallado y no se ha escrito nada. Vuelve a intentarlo.';
    }

    return `El servidor ha contestado ${status} y no se ha escrito nada.`;
};

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
