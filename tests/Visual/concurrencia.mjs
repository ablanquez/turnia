/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * DOS NAVEGADORES PELEÁNDOSE DE VERDAD CONTRA InnoDB.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Esto NO es un test de concurrencia simulada. Son DOS contextos de Chromium, con DOS sesiones,
 * disparando DOS peticiones HTTP a la vez → DOS procesos de PHP → DOS transacciones peleándose por
 * la misma fila de InnoDB. Es lo único que contesta la pregunta que ESTRES-MOTOR.md dejó abierta:
 *
 *     «El candado es el correcto en teoría y funciona en un proceso. Con dos encargados de verdad,
 *      en dos navegadores, contra InnoDB, AÚN NO LO SABEMOS. Es el riesgo número uno que queda vivo.»
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * ⚠️ Y AQUÍ HAY UNA TRAMPA QUE SE COME LA PRUEBA ENTERA, ASÍ QUE VA PRIMERO:
 * ───────────────────────────────────────────────────────────────────────────────────────
 *
 * Si el servidor SERIALIZA las dos peticiones (un PHP de un solo proceso, o un lock de sesión de
 * Laravel), la segunda corre DESPUÉS de la primera y ve su escritura — así que la caza IGUAL, y el
 * test pasa. Pasa por el motivo equivocado: no ha habido carrera. **Un verde sobre una carrera que
 * nunca ocurrió no dice nada del candado.**
 *
 * Así que la prueba se hace DOS VECES:
 *
 *   1. CON el candado     → uno gana, otro pierde.   (lo que queremos)
 *   2. SIN el candado     → LOS DOS GANAN.           (⚠️ ESTO es lo que demuestra que la carrera
 *                                                       es REAL y que el candado es lo que la cierra)
 *
 * Si al quitar el candado los dos SIGUEN sin poder ganar, es que el servidor los serializó y esta
 * prueba no ha probado nada. Y se dice.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * EL CASO PEOR, Y ES EL QUE SE PRUEBA:
 *
 *   NO es el duplicado evidente —ese se ve—. Son DOS TURNOS DISTINTOS, EN DÍAS DISTINTOS, que
 *   INDIVIDUALMENTE cumplen el descanso y JUNTOS lo rompen. Los dos navegadores PREVISUALIZAN antes
 *   y los dos reciben «limpio»: la previsualización MIENTE, por construcción, y no pasa nada —
 *   porque no decide.
 *
 *   node tests/Visual/concurrencia.mjs
 */
import { chromium } from 'playwright';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { entrar, lunesDe } from './pixel.mjs';

const BASE = 'http://turnia.test';
const CANDADO = 'app/Services/Scheduling/Writing/AssignmentWriter.php';

let salida = '';
const di = (s = '') => { salida += s + String.fromCharCode(10); console.log(s); };

const fallos = [];
const ok = (nombre, cierto, detalle = '') => {
    di(`  ${cierto ? '✅' : '❌'} ${nombre}${detalle ? `  → ${detalle}` : ''}`);

    if (! cierto) {
        fallos.push(`${nombre}${detalle ? ` → ${detalle}` : ''}`);
    }
};

/* ── El mundo: se siembra de cero antes de cada ronda ──────────────────────────── */

/**
 * ⚠️ ASÍNCRONO, Y NO `execSync`. Y NO ES ESTILO: `execSync` MATABA ESTE INSTRUMENTO.
 *
 * `execSync` bloquea el bucle de eventos de Node, y Playwright tiene handles abiertos ahí. En
 * Windows, libuv revienta con `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` — y revienta
 * DESPUÉS de imprimir los resultados: el informe salía entero y en verde, y el proceso terminaba
 * con código 127.
 *
 * O sea: el instrumento decía «✅ todo bien» y devolvía un fallo. Es la mentira número 5 otra vez
 * («un TimeoutError da el mismo código que un hallazgo»), ahora del revés. Un instrumento cuyo
 * VEREDICTO y cuyo CÓDIGO DE SALIDA no coinciden no sirve para nada: no se puede automatizar, y a
 * mano se acaba creyendo al que mejor pinta.
 */
const correr = promisify(execFile);

const PHP = 'C:\\laragon\\bin\\php\\php-8.3.30-Win32-vs16-x64\\php.exe';

const sembrar = () => correr(PHP, ['artisan', 'migrate:fresh', '--seed', '--quiet']);

/**
 * DOS PESTAÑAS, DOS SESIONES. Y las dos con el token de sesión que les toca.
 *
 * (Sirve igual con dos usuarios distintos: lo que se serializa es la PERSONA, no el usuario.)
 */
const abrirDos = async (browser) => {
    const contextos = await Promise.all([browser.newContext(), browser.newContext()]);

    return Promise.all(contextos.map(async (ctx) => {
        const page = await ctx.newPage();

        await entrar(page, BASE);
        await page.goto(`${BASE}/companies/1/calendars/1/schedule?week=${lunesDe(0)}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-t=indicador]');

        return page;
    }));
};

/** Lanza una petición DESDE EL NAVEGADOR: con su sesión, su cookie y su token. Como una de verdad. */
const escribir = (page, cuerpo) => page.evaluate(async ([body]) => {
    const res = await fetch('/companies/1/calendars/1/assignments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]').content,
        },
        body: JSON.stringify(body),
    });

    return { status: res.status, ...(await res.json().catch(() => ({}))) };
}, [cuerpo]);

const previsualizar = (page, cuerpo) => page.evaluate(async ([body]) => {
    const res = await fetch('/companies/1/calendars/1/assignments/preview', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]').content,
        },
        body: JSON.stringify(body),
    });

    return res.json();
}, [cuerpo]);

/**
 * ⚠️ SE CUENTA LO QUE SE VE, NO LO QUE DICE LA BASE. Y es lo correcto, no un atajo.
 *
 * Los dos turnos de esta prueba caen dentro de la semana visible, así que la parrilla los enseña.
 * Y contar sobre la PÁGINA prueba una cosa más que contar en MySQL: que lo escrito LLEGÓ A LA
 * PANTALLA. Un turno que existe en la base y no se pinta sería otro silencio falso.
 */
const cuantosTurnos = async (page) => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-t=indicador]');
    await page.waitForTimeout(800);

    return page.$$eval('[data-t=barra][data-assignment-id]', (e) => e.length);
};

const lunes = lunesDe(0);
const dia = (n) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + n);

    return d.toISOString().slice(0, 10);
};

/**
 * ⚠️ EL CASO PEOR. Dos turnos DISTINTOS, en DÍAS DISTINTOS, que juntos rompen el descanso.
 *
 * Y elegirlo bien cuesta, porque el escenario tiene que cumplir TRES cosas a la vez o no prueba lo
 * que dice probar. (El primer intento las fallaba, y los dos navegadores ya recibían «incumple» EN
 * LA PREVISUALIZACIÓN: estaba midiendo un turno que ya estaba roto de antes, no una carrera.)
 *
 *   1. Cada uno, POR SEPARADO, tiene que estar LIMPIO.
 *   2. Los DOS JUNTOS tienen que romper una regla.
 *   3. Y la regla NO puede ser el tope de horas, o saltaría en TODOS los turnos de esa semana y la
 *      fila entera se pondría naranja — ruido, no señal.
 *
 * Tomás (parcial 20 h, descanso mínimo 12 h) trabaja el martes y el domingo. Jueves y viernes están
 * libres. Se le colocan dos refuerzos de caja:
 *
 *   A → JUEVES,  20:00–22:00     limpio por su cuenta (el turno más cercano es el del martes)
 *   B → VIERNES, 06:00–08:00     limpio por su cuenta (el más cercano, el del domingo)
 *
 * Juntos: entre las 22:00 del jueves y las 06:00 del viernes hay OCHO HORAS de descanso, y su perfil
 * exige DOCE.
 *
 * ⚠️ Y NINGUNA PREVISUALIZACIÓN PUEDE VERLO. Ninguna de las dos sabe que la otra existe. Esa es la
 * definición exacta del agujero, y es el motivo por el que la validación que DECIDE tiene que correr
 * DENTRO del candado y no antes.
 */
const TOMAS = 10;   // employment_id (personas por orden: ana, iker, marco, nuria, sara, diego, lucía, bea, leo, tomás)
const CAJA = 4;

const A = { employmentId: TOMAS, positionId: CAJA, workDate: dia(3), start: '20:00', end: '22:00' };
const B = { employmentId: TOMAS, positionId: CAJA, workDate: dia(4), start: '06:00', end: '08:00' };

/* ══════════════════════════════════════════════════════════════════════════════ */

mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });

di();
di('DOS NAVEGADORES CONTRA InnoDB — el riesgo número uno que quedaba vivo');
di('═'.repeat(100));

/** El candado, tal como está en producción. Se restaura SIEMPRE al terminar. */
const antes = readFileSync(CANDADO, 'utf8');

/**
 * ⚠️ LA VENTANA DE LA CARRERA SE ENSANCHA. Y NO ES HACER TRAMPA: ES HACERLA VISIBLE.
 *
 * Entre `validate()` y el `INSERT` hay unos pocos milisegundos. Dos peticiones tienen que caer las
 * dos DENTRO de esa rendija para que la carrera ocurra, y eso pasa… a veces. La primera versión de
 * este instrumento era FLAKY: unas veces reproducía el agujero y otras no, y cuando no lo reproducía
 * se declaraba a sí mismo inválido («el servidor SERIALIZÓ las peticiones»). Correcto, y no sirve.
 *
 * Así que se mete una espera de 300 ms JUSTO DESPUÉS DE VALIDAR — la rendija que ya existía, abierta
 * de par en par. Y se mete EN LAS DOS RONDAS, que es lo que hace que la prueba sea honesta:
 *
 *   · CON el candado    → el segundo se queda esperando en `lockForUpdate` ANTES de validar, así que
 *                         cuando por fin valida, ya ve la escritura del primero. La espera no le
 *                         sirve de nada al agujero.
 *   · SIN el candado    → los dos validan, los dos esperan, los dos escriben. Los dos ganan.
 *
 * La espera no INVENTA la carrera: la hace ocurrir siempre. Si el candado dependiera de que la
 * rendija fuera estrecha, no sería un candado: sería suerte.
 */
const ESPERA = '            usleep(300000);   // ← la ventana de la carrera, abierta a propósito';

const preparar = (conCandado) => {
    let php = antes.replace(
        '            $result = $this->validator->validate($draft);',
        `            $result = $this->validator->validate($draft);
${ESPERA}`,
    );

    if (! conCandado) {
        php = php.replace(
            'Person::whereKey($draft->personId())->lockForUpdate()->first();',
            '// Person::whereKey($draft->personId())->lockForUpdate()->first();   // ← QUITADO A PROPÓSITO',
        );
    }

    writeFileSync(CANDADO, php);
};

const ronda = async (conCandado) => {
    preparar(conCandado);
    await sembrar();

    const browser = await chromium.launch();
    const [uno, dos] = await abrirDos(browser);

    // 1. LOS DOS PREVISUALIZAN, contra el mismo estado. Los dos reciben «limpio».
    const [pA, pB] = await Promise.all([previsualizar(uno, A), previsualizar(dos, B)]);

    const limpios = pA.severidad === null && pB.severidad === null;

    // 2. Y LOS DOS ESCRIBEN A LA VEZ. Dos peticiones HTTP, dos procesos de PHP, una fila de InnoDB.
    const [rA, rB] = await Promise.all([escribir(uno, A), escribir(dos, B)]);

    const escritos = await cuantosTurnos(uno);

    await browser.close();

    return { limpios, pA, pB, rA, rB, escritos };
};

/* ── RONDA 1: CON EL CANDADO ───────────────────────────────────────────────────── */

di();
di('RONDA 1 — CON EL CANDADO (como está en producción)');
di('─'.repeat(100));

const r1 = await (async () => {
    const r = await ronda(true);

    di();
    di('  Los dos previsualizan contra el MISMO estado, y los dos reciben «limpio»:');
    di(`     navegador 1 → severidad: ${r.pA.severidad ?? 'limpio'}`);
    di(`     navegador 2 → severidad: ${r.pB.severidad ?? 'limpio'}`);
    di();
    di('  ⚠️ La previsualización MIENTE, y no pasa nada: no decide. Y ahora los dos escriben A LA VEZ.');
    di();
    di(`     navegador 1 → HTTP ${r.rA.status}  ${r.rA.resultado ?? ''}  ${r.rA.violations?.[0]?.code ?? ''}`);
    di(`     navegador 2 → HTTP ${r.rB.status}  ${r.rB.resultado ?? ''}  ${r.rB.violations?.[0]?.code ?? ''}`);
    di();

    return r;
})();

const ganadores = [r1.rA, r1.rB].filter((r) => r.status === 200).length;
const perdedores = [r1.rA, r1.rB].filter((r) => r.status === 409);

ok('los dos vieron «limpio» en la previsualización (la carrera es real)', r1.limpios);
ok('UNO gana', ganadores === 1, `${ganadores} ganaron`);
ok('y el otro PIERDE, y sabe por qué', perdedores.length === 1 && perdedores[0].violations?.[0]?.code === 'minimum_rest',
    perdedores[0]?.violations?.[0]?.message ?? 'sin motivo');

/* ── RONDA 2: SIN EL CANDADO. Y ESTA ES LA QUE DEMUESTRA QUE LA PRIMERA VALE ──── */

di();
di('RONDA 2 — SIN EL CANDADO (quitado a propósito)');
di('─'.repeat(100));
di();
di('  ⚠️ Si al quitar el candado los DOS ganan, la carrera es REAL y el candado es lo que la cierra.');
di('     Si sigue ganando solo uno, es que el servidor SERIALIZÓ las peticiones — y entonces la');
di('     ronda 1 no ha probado nada. Un verde sobre una carrera que nunca ocurrió no dice nada.');
di();

const r2 = await ronda(false);

// ⚠️ EL CANDADO SE DEVUELVE A SU SITIO, PASE LO QUE PASE. Un instrumento que deja la aplicación
// mutada es peor que no tener instrumento: el siguiente que abra la página está midiendo un bug.
writeFileSync(CANDADO, antes);

di(`     navegador 1 → HTTP ${r2.rA.status}  ${r2.rA.resultado ?? ''}`);
di(`     navegador 2 → HTTP ${r2.rB.status}  ${r2.rB.resultado ?? ''}`);
di(`     turnos en la parrilla: ${r2.escritos}   (con el candado: ${r1.escritos})`);
di();

const ganaronLosDos = [r2.rA, r2.rB].filter((r) => r.status === 200).length === 2;

ok('SIN el candado, LOS DOS GANAN → la carrera es REAL y el candado es lo que la cierra', ganaronLosDos,
    ganaronLosDos
        ? 'el agujero se reproduce'
        : '⚠️ el servidor SERIALIZÓ las peticiones: esta prueba NO ha probado nada sobre el candado');

/* ══════════════════════════════════════════════════════════════════════════════ */

di();
di('═'.repeat(100));

if (fallos.length) {
    di(`❌ ${fallos.length} FALLOS:`);
    di();
    fallos.forEach((f) => di(`   · ${f}`));
} else {
    di('✅ Dos navegadores, dos procesos de PHP, una fila de InnoDB. Uno gana, el otro pierde y sabe');
    di('   por qué. Y sin el candado, LOS DOS ESCRIBEN — así que la carrera era de verdad.');
    di();
    di('   El riesgo número uno de ESTRES-MOTOR.md deja de estar vivo.');
}

di();

writeFileSync(new URL('./salida/concurrencia.txt', import.meta.url), salida);

/*
 * ⚠️ `process.exitCode`, Y NO `process.exit()`.
 *
 * `process.exit()` corta el proceso EN SECO, con los handles de Playwright y los del cliente HTTP
 * todavía abiertos — y en Windows libuv revienta con una aserción DESPUÉS de haber impreso el
 * informe. Resultado: veredicto ✅, código de salida 127. El instrumento decía que todo estaba bien
 * y devolvía un fallo.
 *
 * Así, Node cierra sus handles y sale con el código que le hemos puesto. El veredicto y el código
 * dicen lo mismo, que es lo mínimo que se le pide a un instrumento.
 */
process.exitCode = fallos.length ? 1 : 0;
