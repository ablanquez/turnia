/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * DEJAR LA BASE COMO RECIÉN SEMBRADA — POR EL CAMINO RÁPIDO SI HAY SNAPSHOT, POR EL LENTO SI NO.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `migrate:fresh --seed` tarda ~13 s: reconstruye el esquema TABLA A TABLA. Cada instrumento que
 * escribe lo llama antes de CADA escenario para partir de un cuadrante limpio —y hace bien—, pero
 * la contraprueba, que corre diez mutaciones y cada una dispara un instrumento entero, acababa
 * llamándolo ~37 veces: casi OCHO MINUTOS que no caben en una sola pasada. Se cortaba siempre en
 * el mismo sitio, y no era el reloj: era el DISEÑO.
 *
 *     El esquema no cambia entre escenarios. Reconstruirlo 37 veces es 37 veces el mismo trabajo.
 *
 * Si el que llama pasa un SNAPSHOT —una .sql volcada UNA vez con `mysqldump`— se restaura por
 * importación: ~3 s, sin reconstruir nada. Mismo estado exacto, cuatro veces más rápido. La base
 * se siembra UNA vez y cada escenario la REVIERTE, que es justo lo que pedía el diseño.
 *
 * ⚠️ Y SIN SNAPSHOT SE SIEMBRA A LA VIEJA USANZA. Así el instrumento sigue corriendo SUELTO, sin
 * depender de que nadie le haya dejado una .sql preparada. El camino rápido es un atajo opcional,
 * no un requisito: quien lo invoca a mano no nota diferencia.
 *
 * El snapshot llega por la variable de entorno TURNIA_SNAPSHOT (la pone la contraprueba). Restaurar
 * borra la tabla de usuarios igual que `migrate:fresh`, así que quien llame a esto TIENE QUE VOLVER
 * A ENTRAR después: la sesión se ha ido con el resto.
 */
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { createReadStream } from 'fs';

const correr = promisify(execFile);

const PHP = String.raw`C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe`;
const MYSQL = String.raw`C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe`;
const BASEDATOS = 'turnia';

export async function reiniciarBase(seeders = []) {
    const snap = process.env.TURNIA_SNAPSHOT;

    if (snap) {
        await restaurarSnapshot(snap);
        return;
    }

    await correr(PHP, ['artisan', 'migrate:fresh', '--seed', '--quiet']);

    for (const clase of seeders) {
        await correr(PHP, ['artisan', 'db:seed', '--class', clase, '--quiet']);
    }
}

/**
 * Importa la .sql por la ENTRADA ESTÁNDAR de mysql —igual que `mysql turnia < snap.sql`—, no con
 * `-e "SOURCE ..."`: SOURCE es un comando del cliente interactivo y no está en todas las versiones.
 * El volcado trae sus propios DROP/CREATE, así que deja el esquema y los datos idénticos al momento
 * en que se volcó.
 */
function restaurarSnapshot(ruta) {
    return new Promise((cumplir, fallar) => {
        const proceso = spawn(MYSQL, ['-u', 'root', BASEDATOS], { stdio: ['pipe', 'ignore', 'inherit'] });

        proceso.on('error', fallar);
        proceso.on('close', (codigo) => (codigo === 0 ? cumplir() : fallar(new Error(`mysql salió con código ${codigo}`))));

        createReadStream(ruta).pipe(proceso.stdin);
    });
}
