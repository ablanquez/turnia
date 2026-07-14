import { computed, ref } from 'vue';
import { useArrastre } from './useArrastre.js';
import { useEscritura } from './useEscritura.js';

/**
 * LA CAPA QUE EDITA. Une el arrastre (useArrastre) con la escritura (useEscritura) y no hace más.
 *
 * ⚠️ AQUÍ ES DONDE UNA APLICACIÓN NORMAL SE PEGA EL TIRO EN EL PIE, ASÍ QUE VA ESCRITO GRANDE:
 *
 *     LO QUE SE PINTA MIENTRAS SE ARRASTRA ES UNA **PREVISUALIZACIÓN**.
 *     AL SOLTAR SE VUELVE A PREGUNTAR, DENTRO DEL CANDADO, Y ESA RESPUESTA ES LA QUE MANDA.
 *
 * `estado.previsualizacion` NO se usa NUNCA para decidir si se escribe. Ni para decidir si se
 * ofrece forzar. Se usa para PINTAR, y punto. Cuando el usuario suelta, se llama a `colocar()` o a
 * `mover()` — que van al candado— y se obedece a lo que contesten, aunque contradiga lo que se
 * estaba pintando medio segundo antes.
 *
 * Si esto se «optimizara» reutilizando la previsualización, la aplicación volvería a tener el
 * agujero: entre la comprobación y la escritura cabe otra escritura. Y basta con que sea el mismo
 * usuario, en otra pestaña.
 */
export function useEdicion(company, calendar, { window: ventana, positions }) {
    const arrastre = useArrastre();
    const api = useEscritura(company, calendar);

    // El diálogo de «no puedo» / «¿fuerzas?». null = no hay nada que decidir.
    const decision = ref(null);
    // El popover de horas al colocar a alguien nuevo.
    const colocando = ref(null);
    const sugerido = ref(null);
    const previaPopover = ref(null);
    const ocupado = ref(false);

    // Lo que se estaba intentando hacer cuando saltó el diálogo: hace falta para reintentarlo
    // forzando. NO guarda ninguna validación: solo el QUÉ, nunca el resultado.
    let pendiente = null;

    const diaDe = (date) => ventana.days.find((d) => d.date === date);
    const puestoDe = (id) => positions.find((p) => p.id === id);

    /* ── LO QUE SE ARRASTRA ────────────────────────────────────────────────────── */

    const cogerPersona = (e, persona) => arrastre.empezar(e, { tipo: 'persona', persona }, {
        onCell: () => {},   // una persona sin horas todavía no se puede previsualizar
        onDrop: ({ carga, destino }) => {
            if (! destino) {
                return;
            }

            abrirPopover(carga.persona, destino);
        },
    });

    const cogerBarra = (e, { assignment, person }) => arrastre.empezar(e, { tipo: 'barra', assignment, person }, {
        // ⚠️ Cada vez que la barra sobrevuela OTRA celda, se pregunta «¿qué pasaría si suelto aquí?».
        // Solo al cambiar de celda: un pointermove dispara 60 veces por segundo, y la respuesta no
        // cambia entre dos píxeles de la misma celda.
        onCell: async (destino) => {
            if (! destino) {
                return;
            }

            const r = await api.previsualizar(cuerpoDe(assignment, destino), assignment.id);

            // Puede haber cambiado de celda mientras el servidor contestaba. Si la respuesta ya no
            // es de donde estamos, se tira: pintar una previsualización de otra celda sería mentir.
            if (arrastre.estado.destino?.positionId === destino.positionId
                && arrastre.estado.destino?.date === destino.date) {
                arrastre.previsualizar(r);
            }
        },

        onDrop: async ({ carga, destino, papelera }) => {
            if (papelera) {
                await quitar(carga.assignment);

                return;
            }

            if (! destino) {
                return;
            }

            // Soltar donde ya estaba: NO se escribe. No es pereza, es honestidad — escribir un
            // turno idéntico al que hay generaría una versión nueva de nada.
            if (destino.positionId === carga.assignment.positionId && destino.date === carga.assignment.workDate) {
                return;
            }

            await escribir(() => api.mover(carga.assignment.id, cuerpoDe(carga.assignment, destino)), {
                accion: (f) => api.mover(carga.assignment.id, { ...cuerpoDe(carga.assignment, destino), force: f }),
                persona: carga.person.name,
                cuando: `${puestoDe(destino.positionId)?.name} · ${diaDe(destino.date)?.label}`,
            });
        },
    });

    /** Las horas de una barra que se mueve SE CONSERVAN. Solo cambian el día y el puesto. */
    const cuerpoDe = (assignment, destino) => ({
        positionId: destino.positionId,
        workDate: destino.date,
        start: assignment.label.split('–')[0],
        end: assignment.label.split('–')[1],
    });

    /* ── COLOCAR ───────────────────────────────────────────────────────────────── */

    const abrirPopover = async (persona, destino) => {
        colocando.value = {
            persona,
            celda: {
                ...destino,
                positionName: puestoDe(destino.positionId)?.name ?? '',
                dia: diaDe(destino.date)?.label ?? destino.date,
            },
        };

        previaPopover.value = null;
        sugerido.value = null;

        // Las horas las propone EL SERVIDOR: la cobertura llega diferida, y el cliente puede no
        // tenerla todavía. Una respuesta que depende de si un dato asíncrono ya llegó no es una
        // respuesta.
        sugerido.value = await api.hueco(destino.positionId, destino.date);
    };

    const previsualizarPopover = async ({ start, end }) => {
        const c = colocando.value;

        if (! c) {
            return;
        }

        previaPopover.value = null;
        previaPopover.value = await api.previsualizar({
            employmentId: c.persona.employmentId,
            positionId: c.celda.positionId,
            workDate: c.celda.date,
            start,
            end,
        });
    };

    const confirmarColocar = async ({ start, end }) => {
        const c = colocando.value;

        const cuerpo = {
            employmentId: c.persona.employmentId,
            positionId: c.celda.positionId,
            workDate: c.celda.date,
            start,
            end,
        };

        await escribir(() => api.colocar(cuerpo), {
            accion: (f) => api.colocar({ ...cuerpo, force: f }),
            persona: c.persona.name,
            cuando: `${c.celda.positionName} · ${c.celda.dia}`,
            alEscribir: () => { colocando.value = null; },
        });
    };

    /* ── QUITAR ────────────────────────────────────────────────────────────────── */

    const quitar = async (assignment) => {
        ocupado.value = true;

        const r = await api.quitar(assignment.id);

        ocupado.value = false;

        if (r.status === 200) {
            api.repintar();
        }
    };

    /* ── ESCRIBIR, Y OBEDECER AL CANDADO ───────────────────────────────────────── */

    /**
     * ⚠️ TRES DESENLACES, Y NINGUNO SE ADIVINA DE LA PREVISUALIZACIÓN.
     *
     *   200  escrito       → se repinta la parrilla (y con ella, el informe diferido)
     *   422  imposible     → NO se ha escrito. Se explica y la barra vuelve.
     *   409  hace falta que decidas → NO se ha escrito. Se pregunta si se fuerza.
     */
    const escribir = async (llamada, { accion, persona, cuando, alEscribir }) => {
        ocupado.value = true;

        const r = await llamada();

        ocupado.value = false;

        if (r.status === 200) {
            pendiente = null;
            alEscribir?.();

            /*
             * ⚠️ «IBAS A FORZAR Y, PARA CUANDO LLEGASTE, YA NO HACÍA FALTA.» Se dice.
             *
             * Alguien arregló el problema entre que se le preguntó y que contestó. Se escribió
             * LIMPIO y NO se guardó ninguna firma. Callarlo dejaría al usuario creyendo que hay un
             * override en el expediente de esa persona, y no lo hay.
             */
            if (r.cambioElEstado) {
                decision.value = {
                    resultado: 'imposible',   // se usa el diálogo de «solo informa», sin botón de forzar
                    violations: [{
                        code: 'ya_no_incumplia',
                        severity: 'notice',
                        message: 'Ya no incumplía nada cuando se escribió: alguien lo arregló mientras decidías. Se ha colocado limpio, y NO se ha guardado ninguna justificación.',
                    }],
                    cambioElEstado: false,
                };
            }

            api.repintar();

            return;
        }

        if (r.status === 409 || r.status === 422) {
            // Se guarda QUÉ se quería hacer, para poder reintentarlo forzando. Nunca el resultado
            // de validar: eso caduca, y reutilizarlo es el agujero.
            pendiente = { accion, persona, cuando };

            decision.value = { ...r, persona, cuando };

            return;
        }

        if (r.status === 403) {
            decision.value = {
                resultado: 'imposible',
                violations: [{ code: 'forbidden', severity: 'impossible', message: 'No tienes permiso para escribir en este cuadrante.' }],
            };
        }
    };

    /** El usuario decidió forzar. Se vuelve a llamar — y el candado VUELVE A VALIDAR. */
    const forzar = async (justificacion) => {
        if (! pendiente) {
            return;
        }

        const { accion, persona, cuando, } = pendiente;

        decision.value = null;

        await escribir(() => accion(justificacion), { accion, persona, cuando });
    };

    const cerrarDecision = () => {
        decision.value = null;
        pendiente = null;
    };

    const cerrarPopover = () => {
        colocando.value = null;
        previaPopover.value = null;
    };

    /* ── LO QUE LA REJILLA NECESITA PARA PINTAR ────────────────────────────────── */

    const destinoActual = computed(() => arrastre.estado.destino);
    const previa = computed(() => arrastre.estado.previsualizacion);

    return {
        arrastre,
        cogerPersona,
        cogerBarra,
        quitar,

        decision,
        cerrarDecision,
        forzar,

        colocando,
        sugerido,
        previaPopover,
        previsualizarPopover,
        confirmarColocar,
        cerrarPopover,

        ocupado,
        destinoActual,
        previa,
    };
}
