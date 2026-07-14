import { computed, ref, watch } from 'vue';
import { useArrastre } from './useArrastre.js';
import { useEscritura } from './useEscritura.js';
import { huecosNuevos, huecosPorCelda, useAvisos } from './useAvisos.js';

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
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * LOS TRES GESTOS SOBRE UNA BARRA, Y LOS TRES SALEN DEL MISMO `pointerdown`:
 * ───────────────────────────────────────────────────────────────────────────────────────
 *
 *   ARRASTRAR a otra celda   → mover     (se conservan las horas: solo cambian día y puesto)
 *   ARRASTRAR a la papelera  → quitar
 *   PULSAR Y SOLTAR SIN MOVER → editar las horas  ← el umbral de 4 px es lo que los separa
 *
 * Los tres acaban en el MISMO sitio: previsualización en vivo → confirmar → CANDADO. No hay un
 * cuarto mecanismo escondido en ninguno.
 */
export function useEdicion(company, calendar, { ventana, puestos, coverage }) {
    const arrastre = useArrastre();
    const api = useEscritura(company, calendar);
    const { avisos, avisar, añadirDetalle, cerrar: cerrarAviso } = useAvisos();

    // El diálogo de «no puedo» / «¿fuerzas?». null = no hay nada que decidir.
    const decision = ref(null);
    // El popover de horas: al colocar a alguien nuevo, y al editar las horas de un turno que ya está.
    const colocando = ref(null);
    const sugerido = ref(null);
    const previaPopover = ref(null);
    const ocupado = ref(false);

    // Lo que se estaba intentando hacer cuando saltó el diálogo: hace falta para reintentarlo
    // forzando. NO guarda ninguna validación: solo el QUÉ, nunca el resultado.
    let pendiente = null;

    const diaDe = (date) => ventana().days.find((d) => d.date === date);
    const puestoDe = (id) => puestos().find((p) => p.id === id);

    const nombreDelDia = (date) => {
        const d = diaDe(date);

        return d ? `${d.weekday} ${d.label}` : date;
    };

    const donde = (positionId, date) => `${puestoDe(positionId)?.name ?? 'el puesto'} · ${nombreDelDia(date)}`;

    /* ── EL DAÑO COLATERAL: SE MIDE, NO SE PREDICE ─────────────────────────────── */

    /*
     * ⚠️ MOVER UN TURNO PUEDE ROMPER OTRO, Y EN UNA CELDA QUE NO ESTÁS MIRANDO.
     *
     * Aquí se guarda la foto de los huecos de ANTES y el aviso al que hay que colgarle la noticia.
     * El informe es diferido (719 ms), así que la comparación no puede hacerse en el momento de
     * escribir: se hace cuando el informe vuelve. Ver el `watch` de abajo.
     */
    let colateral = null;

    watch(coverage, (nueva) => {
        // La prop diferida pasa por `undefined` mientras se recarga. Eso no es «no hay huecos».
        if (! colateral || ! nueva) {
            return;
        }

        const { avisoId, antes } = colateral;

        colateral = null;

        const rotos = huecosNuevos(antes, huecosPorCelda(nueva));

        if (! rotos.length) {
            return;
        }

        // Nada se resume en «hay 3 celdas afectadas»: se dicen las celdas. Un número sin sujeto no
        // se puede ir a mirar.
        const celdas = rotos.map((r) => donde(r.positionId, r.date));

        añadirDetalle(
            avisoId,
            celdas.length === 1
                ? `Ojo: ahora queda un hueco sin cubrir en ${celdas[0]}.`
                : `Ojo: ahora quedan huecos sin cubrir en ${celdas.join(', y en ')}.`,
        );
    });

    /** La foto de los huecos justo antes de escribir. `null` si el informe aún no había llegado. */
    const fotoDeHuecos = () => huecosPorCelda(coverage());

    /* ── LO QUE SE ARRASTRA ────────────────────────────────────────────────────── */

    const cogerPersona = (e, persona) => arrastre.empezar(e, { tipo: 'persona', persona }, {
        onCell: () => {},   // una persona sin horas todavía no se puede previsualizar
        onDrop: ({ carga, destino }) => {
            if (! destino) {
                return;
            }

            abrirColocar(carga.persona, destino);
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

        // PULSAR Y SOLTAR SIN MOVER: las horas. Ver `abrirEditar`.
        onClick: ({ assignment: a, person: p }) => abrirEditar(a, p),

        onDrop: async ({ carga, destino, papelera }) => {
            if (papelera) {
                await quitar(carga.assignment, carga.person);

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

            const cuerpo = cuerpoDe(carga.assignment, destino);
            const desde = donde(carga.assignment.positionId, carga.assignment.workDate);

            await escribir(() => api.mover(carga.assignment.id, cuerpo), {
                accion: (f) => api.mover(carga.assignment.id, { ...cuerpo, force: f }),
                persona: carga.person.name,
                cuando: donde(destino.positionId, destino.date),
                // «Movido DE dónde A dónde» — el origen es la mitad del dato, y es justo la celda
                // que el usuario ha dejado de mirar.
                hecho: `${carga.person.name} movido de ${desde} a ${donde(destino.positionId, destino.date)} · ${cuerpo.start}–${cuerpo.end}`,
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

    /* ── COLOCAR: el popover de horas de un turno NUEVO ────────────────────────── */

    const abrirColocar = async (persona, destino) => {
        colocando.value = {
            modo: 'colocar',
            persona,
            celda: {
                ...destino,
                positionName: puestoDe(destino.positionId)?.name ?? '',
                dia: nombreDelDia(destino.date),
            },
        };

        previaPopover.value = null;
        sugerido.value = null;

        // Las horas las propone EL SERVIDOR: la cobertura llega diferida, y el cliente puede no
        // tenerla todavía. Una respuesta que depende de si un dato asíncrono ya llegó no es una
        // respuesta.
        sugerido.value = await api.hueco(destino.positionId, destino.date);
    };

    /* ── EDITAR LAS HORAS DE UN TURNO QUE YA ESTÁ ──────────────────────────────── */

    /**
     * ⚠️ ES EL MISMO POPOVER, Y ESO NO ES AHORRO DE CÓDIGO: ES QUE ES LA MISMA PREGUNTA.
     *
     * «¿De qué hora a qué hora?», con previsualización en vivo y confirmación por el candado. Da
     * exactamente igual que el turno sea nuevo o lleve tres semanas puesto.
     *
     * ⚠️ Y NO SE ESTIRA LA BARRA ARRASTRANDO EL BORDE. Decisión, no pereza:
     *
     * La columna de un día mide ~150 px para 24 horas → **6 PÍXELES POR HORA**. Cambiar las 20:00
     * por las 21:00 exigiría mover el ratón exactamente 6 px, y —lo que es mucho peor— SE ACERTARÍA
     * POR ERROR: un temblor de 6 px cambiaría un turno sin que nadie lo pidiera. En una aplicación
     * cuyo valor entero es la precisión, **escribir «21:00» es inequívoco y arrastrar 6 px es una
     * lotería**. El teclado gana al ratón.
     *
     * (En el zoom Día son 42 px/hora y sí sería viable. Está anotado en PENDIENTES.)
     */
    const abrirEditar = async (assignment, persona) => {
        const [start, end] = assignment.label.split('–');

        colocando.value = {
            modo: 'editar',
            assignment,
            persona,
            celda: {
                positionId: assignment.positionId,
                date: assignment.workDate,
                positionName: puestoDe(assignment.positionId)?.name ?? '',
                dia: nombreDelDia(assignment.workDate),
            },
        };

        previaPopover.value = null;

        // Las horas que ya tiene. No es una sugerencia: es lo que hay, y se dice de dónde sale.
        sugerido.value = { start, end, motivo: 'Las horas que tiene ahora.' };
    };

    /* ── EL POPOVER, PARA LOS DOS MODOS ────────────────────────────────────────── */

    const previsualizarPopover = async ({ start, end }) => {
        const c = colocando.value;

        if (! c) {
            return;
        }

        const editando = c.modo === 'editar';

        previaPopover.value = null;
        previaPopover.value = await api.previsualizar(
            {
                employmentId: editando ? undefined : c.persona.employmentId,
                positionId: c.celda.positionId,
                workDate: c.celda.date,
                start,
                end,
            },
            // ⚠️ AL EDITAR, EL TURNO NO SE COMPARA CONSIGO MISMO. Sin este id, cambiarle un minuto
            // daría SIEMPRE un solape imposible contra su propia versión vieja — un aviso falso, y
            // de los que hacen creer que la aplicación está rota.
            editando ? c.assignment.id : null,
        );
    };

    const confirmarPopover = async ({ start, end }) => {
        const c = colocando.value;

        if (c.modo === 'editar') {
            const cuerpo = {
                positionId: c.celda.positionId,
                workDate: c.celda.date,
                start,
                end,
            };

            await escribir(() => api.mover(c.assignment.id, cuerpo), {
                accion: (f) => api.mover(c.assignment.id, { ...cuerpo, force: f }),
                persona: c.persona.name,
                cuando: donde(c.celda.positionId, c.celda.date),
                hecho: `${c.persona.name}: ${c.assignment.label} → ${start}–${end} · ${donde(c.celda.positionId, c.celda.date)}`,
            });

            return;
        }

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
            cuando: donde(c.celda.positionId, c.celda.date),
            hecho: `${c.persona.name} añadido a ${donde(c.celda.positionId, c.celda.date)} · ${start}–${end}`,
        });
    };

    /* ── QUITAR ────────────────────────────────────────────────────────────────── */

    /**
     * ⚠️ QUITAR ERA EL ÚNICO GESTO MUDO DE LOS TRES, Y ADEMÁS ES EL DESTRUCTIVO.
     *
     * Antes: si el servidor contestaba algo que no fuera 200 —un 403, un turno que otro ya había
     * borrado—, aquí **no pasaba absolutamente nada**. El turno seguía en pantalla, el usuario creía
     * haberlo quitado, y nadie decía nada. Un silencio falso de manual, en la operación que menos se
     * puede permitir uno.
     */
    const quitar = async (assignment, persona) => {
        const antes = fotoDeHuecos();

        ocupado.value = true;

        const r = await api.quitar(assignment.id);

        ocupado.value = false;

        if (r.status !== 200) {
            decision.value = {
                resultado: 'imposible',
                violations: r.violations?.length ? r.violations : [{
                    code: 'no_se_pudo',
                    severity: 'impossible',
                    message: r.status === 403
                        ? 'No tienes permiso para escribir en este cuadrante.'
                        : 'No se ha podido quitar el turno. Puede que ya no exista: recarga la página.',
                }],
                persona: persona?.name ?? '',
                cuando: donde(assignment.positionId, assignment.workDate),
            };

            return;
        }

        /*
         * DESHACER. Y no restaura la fila: LA VUELVE A COLOCAR, por el candado, como cualquier otra
         * escritura.
         *
         * Es más lento y es más honesto. Un `restore()` de la fila borrada se saltaría la validación
         * —y en los segundos que el turno estuvo fuera, otro pudo colocar a esa persona en otro sitio
         * a la misma hora—. Deshacer devolvería entonces un solape que NADIE validó, que es
         * exactamente el agujero que esta tanda cerró. Si al deshacer ya no cabe, se dice.
         *
         * ⚠️ Y SI EL TURNO ESTABA FORZADO, LA JUSTIFICACIÓN NO VUELVE: el turno es nuevo, y si sigue
         * incumpliendo se vuelve a preguntar y se vuelve a firmar. Es la misma ley que en `move()`
         * (una firma vale para el turno que se firmó, no para su reencarnación) y se AVISA de ello.
         */
        const rehacer = {
            employmentId: assignment.employmentId,
            positionId: assignment.positionId,
            workDate: assignment.workDate,
            start: assignment.label.split('–')[0],
            end: assignment.label.split('–')[1],
        };

        const avisoId = avisar({
            tono: 'ok',
            texto: `${persona?.name ?? 'El turno'} quitado de ${donde(assignment.positionId, assignment.workDate)} · ${assignment.label}`
                + (assignment.forced ? '. Estaba forzado: si lo devuelves, habrá que justificarlo otra vez.' : ''),
            deshacer: () => devolver(rehacer, persona),
        });

        colateral = { avisoId, antes };

        api.repintar();
    };

    const devolver = async (cuerpo, persona) => {
        await escribir(() => api.colocar(cuerpo), {
            accion: (f) => api.colocar({ ...cuerpo, force: f }),
            persona: persona?.name ?? '',
            cuando: donde(cuerpo.positionId, cuerpo.workDate),
            hecho: `${persona?.name ?? 'El turno'} devuelto a ${donde(cuerpo.positionId, cuerpo.workDate)} · ${cuerpo.start}–${cuerpo.end}`,
        });
    };

    /* ── ESCRIBIR, Y OBEDECER AL CANDADO ───────────────────────────────────────── */

    /**
     * ⚠️ TRES DESENLACES, Y NINGUNO SE ADIVINA DE LA PREVISUALIZACIÓN.
     *
     *   200  escrito       → se repinta la parrilla (y con ella, el informe diferido) Y SE DICE
     *   422  imposible     → NO se ha escrito. Se explica y la barra vuelve.
     *   409  hace falta que decidas → NO se ha escrito. Se pregunta si se fuerza.
     *
     * ⚠️ Y EL RECHAZO DEL CANDADO NO SE CUENTA CON UN AVISO QUE SE DESVANECE: SE CUENTA CON EL
     * DIÁLOGO. Un modal, en el centro, que hay que cerrar a mano. Meter «no se ha podido escribir»
     * en una tarjetita de seis segundos sería degradar la información más importante que esta
     * aplicación da. Un aviso que se va solo sirve para confirmar; no sirve para negar.
     */
    const escribir = async (llamada, { accion, persona, cuando, hecho }) => {
        const antes = fotoDeHuecos();

        ocupado.value = true;

        const r = await llamada();

        ocupado.value = false;

        if (r.status === 200) {
            pendiente = null;
            cerrarPopover();

            const avisoId = avisar({
                tono: r.forzado ? 'breach' : 'ok',
                texto: r.forzado
                    ? `${hecho}. Forzado: queda registrado con tu nombre.`
                    : hecho,
            });

            colateral = { avisoId, antes };

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
                    persona,
                    cuando,
                };
            }

            api.repintar();

            return;
        }

        if (r.status === 409 || r.status === 422) {
            /*
             * ⚠️ EL POPOVER SE CIERRA AL ABRIRSE EL DIÁLOGO. Se apilaban, y uno de los dos sobraba.
             *
             * El aviso del popover («Se puede forzar, y habrá que justificarlo») es una
             * PREVISUALIZACIÓN: su trabajo era avisar de lo que venía, y ya lo ha hecho. Lo que se
             * abre encima es LA DECISIÓN, que la toma el candado y que puede decir algo DISTINTO.
             * Dejar los dos abiertos, uno detrás de otro, deja en pantalla dos respuestas a la misma
             * pregunta — y la de atrás es la que ya no vale.
             */
            cerrarPopover();

            // Se guarda QUÉ se quería hacer, para poder reintentarlo forzando. Nunca el resultado
            // de validar: eso caduca, y reutilizarlo es el agujero.
            pendiente = { accion, persona, cuando, hecho };

            decision.value = { ...r, persona, cuando };

            return;
        }

        if (r.status === 403) {
            cerrarPopover();

            decision.value = {
                resultado: 'imposible',
                violations: [{ code: 'forbidden', severity: 'impossible', message: 'No tienes permiso para escribir en este cuadrante.' }],
                persona,
                cuando,
            };
        }
    };

    /** El usuario decidió forzar. Se vuelve a llamar — y el candado VUELVE A VALIDAR. */
    const forzar = async (justificacion) => {
        if (! pendiente) {
            return;
        }

        const { accion, persona, cuando, hecho } = pendiente;

        decision.value = null;

        await escribir(() => accion(justificacion), { accion, persona, cuando, hecho });
    };

    const cerrarDecision = () => {
        decision.value = null;
        pendiente = null;
    };

    const cerrarPopover = () => {
        colocando.value = null;
        previaPopover.value = null;
        sugerido.value = null;
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
        confirmarPopover,
        cerrarPopover,

        avisos,
        cerrarAviso,

        ocupado,
        destinoActual,
        previa,
    };
}
