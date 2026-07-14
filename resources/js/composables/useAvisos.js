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
 * Mueves a Iker del lunes al domingo. El domingo lo estás mirando: ahí está la barra, en su sitio.
 * Pero el hueco rojo que acabas de abrir aparece en el LUNES —la celda que dejó—, al otro extremo de
 * la pantalla. Sin un aviso, **la consecuencia de tu acción ocurre donde no estás mirando**, y eso
 * es un silencio falso con las manos en la masa.
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
     * El colateral llega ~900 ms DESPUÉS del aviso (el informe es diferido y caro). Si el reloj no
     * se reiniciara al añadirlo, la frase que más importa —«ojo, has abierto un hueco en el lunes»—
     * aparecería con el aviso ya medio ido. Escribir algo que nadie llega a leer es no escribirlo.
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
     * @param {boolean} [o.comprueba]  Si hay un «antes» con el que comparar el colateral.
     */
    const avisar = ({ tono = 'ok', texto, deshacer = null, persistente = false, comprueba = false }) => {
        const aviso = reactive({
            id: ++siguiente,
            tono,
            texto,
            deshacer,
            persistente,
            // Un aviso con botón vive el doble: leerlo es rápido, decidir no lo es.
            vida: deshacer ? 12000 : 6000,
            /*
             * ⚠️ «COMPROBANDO» OCUPA EL SITIO QUE VA A OCUPAR EL COLATERAL. Y no es maquillaje.
             *
             * El colateral llega ~900 ms después, así que el aviso CRECÍA y DABA UN SALTO justo
             * cuando el ojo se había posado en él. Reservar el hueco con una línea vacía sería una
             * mentirijilla; llenarlo con lo que de verdad está pasando —«estoy mirando el resto del
             * cuadrante»— cuesta lo mismo y encima informa.
             *
             * Es el mismo criterio que el fallback de las props diferidas: «comprobando el
             * cuadrante…», NUNCA un verde prematuro (ley 21).
             */
            comprobando: comprueba,
            /*
             * ⚠️ ¿SE PUDO COMPARAR? Se guarda, y se expone en el DOM (`data-comparado`).
             *
             * Si el informe no había llegado cuando se escribió, NO HAY «antes» — y entonces el
             * silencio del colateral significa «no lo sé», no «no ha cambiado nada». Son dos cosas
             * distintas y desde fuera se veían IGUAL: un aviso sin líneas. Sin este dato no se pueden
             * distinguir, ni mirándolo ni midiéndolo — y esa confusión ya me costó dos pasadas de
             * instrumento, cantando «no avisa del hueco» sobre un aviso que se callaba con razón.
             */
            comparado: comprueba,
            // { malas: [], buenas: [], mas: 0 }  ·  null = todavía no se sabe, o no ha cambiado nada
            delta: null,
            reloj: null,
        });

        avisos.push(aviso);
        armar(aviso);

        return aviso.id;
    };

    /**
     * Lo que la escritura cambió EN OTRA PARTE. Llega tarde, porque el informe llega tarde.
     *
     * ⚠️ Y CUANDO NO HA CAMBIADO NADA, SE APAGA EL «COMPROBANDO» Y **NO SE DICE «SIN NOVEDAD»**.
     *
     * El aviso ya dice lo que has hecho. Añadirle un «no has roto nada» sería una afirmación más, y
     * las afirmaciones se ganan (ley 21). Además entrena a leer el bloque de detalle como
     * decorativo, que es justo lo contrario de lo que se busca.
     */
    const contarCambios = (id, delta) => {
        const aviso = avisos.find((a) => a.id === id);

        if (! aviso) {
            return;
        }

        aviso.comprobando = false;

        const hay = delta && (delta.malas.length || delta.buenas.length);

        aviso.delta = hay ? delta : null;

        // Solo se rearma el reloj si hay algo NUEVO que leer.
        if (hay) {
            armar(aviso);
        }
    };

    return { avisos, avisar, contarCambios, cerrar };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * EL COLATERAL. **TODO** LO QUE TU ACCIÓN HA CAMBIADO — NO SOLO LO QUE ESTABAS MIRANDO.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ SE MIDE COMPARANDO EL INFORME DE ANTES CON EL DE DESPUÉS. NO SE DEDUCE, NO SE PREDICE.
 *
 * La escritura NO calcula los daños que causa, y eso es a propósito: el informe (719 ms, ~1.700
 * consultas) está FUERA del camino de la escritura, y ahí se queda. Se guarda una FOTO del informe
 * antes de escribir, se escribe, y cuando el informe diferido vuelve se comparan las dos fotos.
 *
 * O sea que esto no adivina nada: MIRA el estado real, después. Y por eso no puede mentir.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * ⚠️ Y LA PRIMERA VERSIÓN SOLO MIRABA LOS HUECOS. QUE ES LA MITAD DE LA VERDAD.
 * ───────────────────────────────────────────────────────────────────────────────────────
 *
 * Mover a Iker del lunes al domingo hace DOS cosas: deja un HUECO en el lunes (avisaba) y crea un
 * EXCESO en el domingo (**no decía nada**). Y el exceso también lo has provocado tú, y **cuesta
 * dinero**. Igual que un turno que empuja a alguien por encima de su tope semanal, o que rompe el
 * descanso de OTRA persona, en OTRA celda, incluso en OTRA empresa.
 *
 *     EL USUARIO TIENE QUE ENTERARSE DE **TODO** LO QUE SU ACCIÓN HA CAMBIADO.
 *
 * ⚠️ Y AL REVÉS TAMBIÉN: si tu movimiento **ARREGLA** algo —cubre un hueco, quita un
 * incumplimiento—, eso también es consecuencia de tu acción, y también se dice. Un sistema que solo
 * cuenta las malas noticias enseña a temer los cambios.
 */

/** Lo que el informe sabe, en un formato comparable. `null` si el informe no ha llegado. */
export function fotoDelInforme(coverage, violations, assignments) {
    /*
     * ⚠️ SI EL INFORME NO HA LLEGADO, NO HAY FOTO. Y sin un «antes» no se puede decir qué cambió.
     * Callarse porque no se sabe es correcto; inventarse un «sin novedad» sería un silencio falso.
     */
    if (! coverage?.segments || ! violations) {
        return null;
    }

    const celdas = new Map();

    for (const s of coverage.segments) {
        if (s.state !== 'missing' && s.state !== 'excess') {
            continue;
        }

        const clave = `${s.positionId}|${s.workDate}`;
        const y = celdas.get(clave) ?? { falta: 0, sobra: 0 };

        if (s.state === 'missing') {
            y.falta += 1;
        } else {
            y.sobra += 1;
        }

        celdas.set(clave, y);
    }

    const vios = new Map();

    for (const [id, lista] of Object.entries(violations.assignments ?? {})) {
        vios.set(Number(id), lista);
    }

    /*
     * El índice de turnos SE GUARDA CON LA FOTO. Hace falta para poder NOMBRAR un turno que en el
     * «después» ya no existe —lo acabas de quitar— o que ha cambiado de sitio. Sin él, la violación
     * que se resuelve al borrar un turno no tendría a quién atribuirse, y una nota sin sujeto es un
     * muro (ley 8).
     */
    const turnos = new Map((assignments ?? []).map((a) => [a.id, a]));

    return { celdas, vios, turnos };
}

/**
 * Qué ha cambiado entre las dos fotos.
 *
 * @param {object} ctx  { nombreDe(personId), donde(positionId, date), corto(violacion), excluir }
 * @returns {{malas: string[], buenas: string[], mas: number} | null}
 */
export function delta(antes, despues, ctx) {
    if (! antes || ! despues) {
        return null;
    }

    const malas = [];
    const buenas = [];

    /* ── LA COBERTURA: falta gente, sobra gente. Y las dos son consecuencia tuya. ────── */

    for (const clave of new Set([...antes.celdas.keys(), ...despues.celdas.keys()])) {
        const [positionId, date] = clave.split('|');
        const sitio = ctx.donde(Number(positionId), date);
        const a = antes.celdas.get(clave) ?? { falta: 0, sobra: 0 };
        const d = despues.celdas.get(clave) ?? { falta: 0, sobra: 0 };

        /*
         * ⚠️ «FALTA» Y «SOBRA» SE DICEN CON PALABRAS DISTINTAS, no solo con colores distintos.
         *
         * Falta gente → el bar NO PUEDE OPERAR. Sobra gente → opera, y PAGAS DE MÁS. Son dos
         * gravedades distintas, y quien lea el aviso sin fijarse en el color tiene que notarlo igual.
         */
        if (d.falta > a.falta) {
            malas.push(`Ahora falta gente en ${sitio}`);
        }

        if (a.falta > d.falta && d.falta === 0) {
            buenas.push(`Ya no falta gente en ${sitio}`);
        }

        if (d.sobra > a.sobra) {
            malas.push(`Ahora sobra gente en ${sitio}`);
        }

        if (a.sobra > d.sobra && d.sobra === 0) {
            buenas.push(`Ya no sobra gente en ${sitio}`);
        }
    }

    /* ── LAS VIOLACIONES, EN LAS DOS DIRECCIONES ────────────────────────────────────── */

    /*
     * ⚠️ SE AGRUPA POR (PERSONA, REGLA), Y ESO NO ES COSMÉTICA.
     *
     * El tope semanal es una regla de la PERSONA, no del turno: cuando salta, salta en TODOS sus
     * turnos a la vez. Sin agrupar, un solo movimiento escupiría CINCO LÍNEAS IDÉNTICAS —«se pasa
     * del tope de horas», cinco veces— y el ruido enseña a no leer, que es la ley 9. Es la misma
     * ley 17 de las notas: se agrupa lo IDÉNTICO, nunca lo parecido.
     *
     * Y el dato no se pierde: se dice EN CUÁNTOS TURNOS.
     */
    const nuevas = new Map();
    const idas = new Map();

    for (const id of new Set([...antes.vios.keys(), ...despues.vios.keys()])) {
        /*
         * ⚠️ EL TURNO QUE ACABAS DE TOCAR NO ES UN COLATERAL.
         *
         * Lo que le pasa a ÉL ya te lo dijo el candado, a la cara, antes de escribir — y si
         * incumplía, has tenido que firmarlo. Colateral es lo que le pasa a LOS DEMÁS.
         */
        if (id === ctx.excluir) {
            continue;
        }

        const turno = despues.turnos.get(id) ?? antes.turnos.get(id);
        const antesCodes = new Set((antes.vios.get(id) ?? []).map((v) => v.code));
        const ahora = despues.vios.get(id) ?? [];
        const ahoraCodes = new Set(ahora.map((v) => v.code));

        for (const v of ahora) {
            if (! antesCodes.has(v.code)) {
                apuntar(nuevas, turno, v);
            }
        }

        for (const v of antes.vios.get(id) ?? []) {
            if (! ahoraCodes.has(v.code)) {
                apuntar(idas, turno, v);
            }
        }
    }

    for (const g of nuevas.values()) {
        malas.push(frase(g, false, ctx));
    }

    for (const g of idas.values()) {
        buenas.push(frase(g, true, ctx));
    }

    /*
     * ⚠️ HAY UN TOPE, Y SE DICE CUÁNTAS SE QUEDAN FUERA. Nunca un recorte silencioso.
     *
     * Un movimiento puede cambiar diez cosas, y diez líneas en una tarjeta flotante no se leen: la
     * tarjeta crece hasta media pantalla y tapa justo la parrilla que hay que mirar. Se enseñan las
     * primeras y **se dice cuántas faltan** («y 4 más»). Un aviso que se calla lo que no cabe estaría
     * mintiendo por omisión — que es exactamente lo que este aviso vino a evitar.
     *
     * Y las MALAS van primero: si algo tiene que quedarse fuera, que sea una buena noticia.
     */
    const TOPE = 5;
    const total = malas.length + buenas.length;

    return {
        malas: malas.slice(0, TOPE),
        buenas: buenas.slice(0, Math.max(0, TOPE - malas.length)),
        mas: Math.max(0, total - TOPE),
    };
}

function apuntar(mapa, turno, v) {
    /*
     * Un turno que no está en NINGUNA de las dos fotos no se puede nombrar. Y una violación sin
     * sujeto es un muro (ley 8): no se inventa, se calla. (Pasa con los conceptos horarios y las
     * ausencias, que tienen sus propias reglas y no son turnos.)
     */
    if (! turno) {
        return;
    }

    const clave = `${turno.personId}|${v.code}`;
    const g = mapa.get(clave) ?? { personId: turno.personId, v, turnos: [] };

    g.turnos.push(turno);
    mapa.set(clave, g);
}

function frase(g, buena, ctx) {
    const quien = ctx.nombreDe(g.personId);
    const que = ctx.corto(g.v).replace(/^[^\p{L}]+/u, '').toLowerCase();

    /*
     * Con UN turno se dice DÓNDE (se puede ir a mirar). Con VARIOS, CUÁNTOS: cuando salta el tope
     * semanal, la regla es de la PERSONA y no de un turno concreto — «en 4 turnos» es el dato que de
     * verdad importa, y una lista de cuatro celdas no diría nada más.
     */
    const donde = g.turnos.length === 1
        ? ` · ${ctx.donde(g.turnos[0].positionId, g.turnos[0].workDate)}`
        : ` — en ${g.turnos.length} turnos`;

    /*
     * ⚠️ «ARREGLADO —», Y NO «YA NO …». Y no es estilo: es que la otra forma NO ERA GRAMATICAL.
     *
     * El texto corto de una regla es una FRASE, no un sustantivo: «Solape imposible», «Se pasa del
     * tope de horas», «No cualificado para Barra». Meterlo detrás de «ya no» produce cosas como
     *
     *     «Tomás Vega ya no solape imposible»           ← sin verbo
     *     «Marco Ruiz ya no se pasa del tope de horas»  ← esta sí, por casualidad
     *
     * Y una regla que solo funciona con la mitad de sus casos no es una regla: es una coincidencia.
     * Un prefijo delante encaja con TODAS, y además dice de un vistazo que es una buena noticia
     * incluso para quien no distinga el verde (ley 6: ningún color va solo).
     */
    return buena
        ? `Arreglado — ${quien}: ${que}${donde}`
        : `${quien}: ${que}${donde}`;
}
