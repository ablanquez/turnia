#!/usr/bin/env bash
#
# ═══════════════════════════════════════════════════════════════════════════════════════
# LA CONTRAPRUEBA: SE REINTRODUCE CADA BUG DE ESTA TANDA Y SE MIRA SI EL INSTRUMENTO LO CAZA.
# ═══════════════════════════════════════════════════════════════════════════════════════
#
# ⚠️ TRES ESTADOS, NO DOS: CAZADO · ESCAPADO · NO PROBADA.
#
# «No probada» es que el parche NO ENCAJÓ (el código cambió y el `perl` ya no encuentra su patrón).
# Y eso NO es un aprobado: es que la mutación no llegó a existir, así que el verde del instrumento
# no significa nada. Un test que revienta no es un test que caza — y **cero casos probados no es
# cero fallos**.
#
#   bash tests/Visual/mutaciones-tanda9.sh
#
set -u
cd "$(dirname "$0")/../.." || exit 1

PHP="C:/laragon/bin/php/php-8.3.30-Win32-vs16-x64/php.exe"
MYSQL="C:/laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysql.exe"
DUMP="C:/laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysqldump.exe"

SALIDA="tests/Visual/salida"
LOG="$SALIDA/mutaciones-tanda9.log"
mkdir -p "$SALIDA"

# ═══════════════════════════════════════════════════════════════════════════════════════
# ⚠️ POR QUÉ ESTE SCRIPT SE REDISEÑÓ (y no era el reloj: era el DISEÑO).
# ═══════════════════════════════════════════════════════════════════════════════════════
#
# La versión anterior se cortaba SIEMPRE en el mismo sitio —el caso 6—, ni en primer ni en segundo
# plano llegaba al final. La causa no era un timeout tonto: cada una de las diez mutaciones dispara
# un instrumento entero, y esos instrumentos SIEMBRAN DE CERO (`migrate:fresh --seed`, ~13 s) antes
# de cada escenario. Entre `colateral.mjs` (5 escenarios) y `errores.mjs` (3), la contraprueba
# acababa reconstruyendo el esquema ~37 veces: casi ocho minutos SOLO en resembrar.
#
#     El esquema no cambia entre mutaciones. Reconstruirlo 37 veces es 37 veces el mismo trabajo.
#
# El arreglo, de raíz:
#
#   · LA BASE SE SIEMBRA UNA VEZ y se vuelca a un SNAPSHOT (.sql). Cada escenario la REVIERTE
#     restaurando el snapshot (~3 s, sin reconstruir esquema) en vez de `migrate:fresh` (~13 s).
#     El instrumento lo hace solo: si ve la variable TURNIA_SNAPSHOT, `reiniciarBase()` (db.mjs)
#     restaura en vez de sembrar. Suelto, sin la variable, sigue sembrando a la vieja usanza.
#
#   · EL BUILD NO ES EL CUELLO: `npm run build` tarda 1,5 s (lo medí). Se deja uno por mutación,
#     porque las diez tocan el FRONT (WeekGrid.vue, useEscritura.js, useEdicion.js, useAvisos.js,
#     useMatrizVisual.js) y el navegador tiene que cargar el código mutado. Colapsarlo a uno solo
#     sería imposible sirviendo assets compilados, y no hace falta: 1,5 s no es un problema.
#
#   · CADA RESULTADO SE ESCRIBE AL LOG EN CUANTO ACABA (`apunta` → `tee -a`). Si esto se corta en
#     el caso 6, los cinco primeros YA ESTÁN EN DISCO. Un instrumento que solo da resultado si
#     termina entero no sirve cuando se corta: este es incremental.

# ═══════════════════════════════════════════════════════════════════════════════════════
# ⚠️⚠️ ESTE SCRIPT **NO USA `git checkout` PARA RESTAURAR**. Y ESO NO ES UNA MANÍA.
# ═══════════════════════════════════════════════════════════════════════════════════════
#
# `git checkout` no restaura «lo que había antes de la mutación»: restaura **lo que hay en el último
# commit**. Si hay trabajo SIN COMMITEAR —y aquí siempre lo hay, porque la contraprueba se corre
# justo antes de cerrar la tanda— te lo borra entero, sin preguntar y sin decir nada. Ya me pasó
# dos veces, y una perdí la tanda del colateral completa. Ahora se guarda una COPIA REAL de cada
# fichero antes de tocarlo y se restaura DESDE ESA COPIA. Si mutas el mundo y no lo restauras, no
# eres un instrumento: eres un accidente.
COPIAS="$(mktemp -d)"
SNAP_DEFECTO="$COPIAS/defecto.sql"    # migrate:fresh --seed → company 1 (errores, colateral)
SNAP_MATRIZ="$COPIAS/matriz.sql"      # + Backtest + Matriz  → company 17 (semanticos, la tira)
MATRIZ_JSON="$COPIAS/matriz.json.bak" # MatrizSeeder REESCRIBE tests/Visual/matriz.json: se preserva

trap 'restaurar_todo' EXIT

CAZADOS=0; ESCAPADOS=0; NOPROBADAS=0
ESCAPES=()
TOCADOS=()

# Escribe a pantalla Y al log, en el acto. El log es la red de seguridad si esto se corta.
apunta() { printf '%s\n' "$*" | tee -a "$LOG"; }

restaurar_todo() {
  for f in "${TOCADOS[@]:-}"; do
    [ -n "$f" ] && cp "$COPIAS/$(echo "$f" | tr '/' '_')" "$f" 2>/dev/null
  done

  # matriz.json lo reescribe el seeder: se devuelve tal cual estaba (commiteado o no).
  [ -f "$MATRIZ_JSON" ] && cp "$MATRIZ_JSON" tests/Visual/matriz.json 2>/dev/null

  rm -rf "$COPIAS"
  npm run build >/dev/null 2>&1
  "$PHP" artisan migrate:fresh --seed --quiet >/dev/null 2>&1   # base limpia y conocida al salir
}

# $1 nombre · $2 fichero · $3 patrón perl · $4 instrumento · $5 snapshot que el instrumento revierte
mutar() {
  local nombre="$1" fichero="$2" patron="$3" instrumento="$4" snap="$5"
  local copia="$COPIAS/$(echo "$fichero" | tr '/' '_')"

  # La copia se hace UNA vez, con el contenido REAL (commiteado o no).
  if [ ! -f "$copia" ]; then
    cp "$fichero" "$copia"
    TOCADOS+=("$fichero")
  fi

  cp "$copia" "$fichero"

  local antes; antes=$(md5sum "$fichero" | cut -d' ' -f1)
  perl -0pi -e "$patron" "$fichero"
  local despues; despues=$(md5sum "$fichero" | cut -d' ' -f1)

  if [ "$antes" = "$despues" ]; then
    apunta "  ⚠️  NO PROBADA  $nombre"
    apunta "                 (el patrón no encajó: la mutación NO EXISTE, así que el verde no dice nada)"
    NOPROBADAS=$((NOPROBADAS+1))
    return
  fi

  npm run build >/dev/null 2>&1

  # Se deja la base en el estado que el instrumento espera ANTES de arrancarlo. Los que resiembran
  # (errores, colateral) la revertirán a este mismo snapshot en cada escenario, vía TURNIA_SNAPSHOT.
  # Los que NO resiembran (semanticos) miden justo sobre este estado.
  "$MYSQL" -u root turnia < "$snap" 2>/dev/null

  if TURNIA_SNAPSHOT="$snap" node "tests/Visual/$instrumento" >/dev/null 2>&1; then
    apunta "  ❌ ESCAPADO    $nombre"
    apunta "                 ($instrumento dio VERDE con el bug dentro)"
    ESCAPADOS=$((ESCAPADOS+1))
    ESCAPES+=("$nombre  →  $instrumento")
  else
    apunta "  ✅ CAZADO      $nombre   ($instrumento)"
    CAZADOS=$((CAZADOS+1))
  fi

  # Se restaura DESDE LA COPIA, nunca desde git: puede haber trabajo sin commitear.
  cp "$copia" "$fichero"
}

: > "$LOG"
apunta ""
apunta "CONTRAPRUEBA — se mete cada bug de la tanda y se mira quién lo caza"
apunta "════════════════════════════════════════════════════════════════════════════════════════"
apunta ""

# ── SNAPSHOTS: se siembra UNA vez y se vuelca. A partir de aquí, revertir cuesta ~3 s, no ~13 s. ──
apunta "  · sembrando snapshots (una sola vez)…"
cp tests/Visual/matriz.json "$MATRIZ_JSON" 2>/dev/null

"$PHP" artisan migrate:fresh --seed --quiet
"$DUMP" -u root --no-tablespaces turnia > "$SNAP_DEFECTO" 2>/dev/null

"$PHP" artisan migrate:fresh --seed --quiet
"$PHP" artisan db:seed --class BacktestSeeder --quiet
"$PHP" artisan db:seed --class MatrizSeeder --quiet
"$DUMP" -u root --no-tablespaces turnia > "$SNAP_MATRIZ" 2>/dev/null

apunta "  · defecto: $(wc -l < "$SNAP_DEFECTO") líneas · matriz: $(wc -l < "$SNAP_MATRIZ") líneas"
apunta ""

# ── 1. EL VERDE EN EL else (ley 21) — la celda de destino ─────────────────────────────
mutar "el verde en el else · la celda no sabe y pinta que SÍ" \
  "resources/js/Components/Schedule/WeekGrid.vue" \
  "s/        return 'comprobando';/        return 'limpio';/" \
  "errores.mjs" "$SNAP_DEFECTO"

# ── 2. EL VERDE EN EL else — el fallo se pinta como limpio ────────────────────────────
mutar "el fallo del servidor se pinta como LIMPIO (verde)" \
  "resources/js/Components/Schedule/WeekGrid.vue" \
  "s/    if \(p\.fallo\) \{/    if (false) {/" \
  "errores.mjs" "$SNAP_DEFECTO"

# ── 3. EL CSRF DEL <meta> — el token que no se refresca ───────────────────────────────
mutar "el CSRF sale del <meta>, que en una SPA no se refresca nunca" \
  "resources/js/composables/useEscritura.js" \
  "s/    if \(cookie\) \{\R        return decodeURIComponent\(cookie\.slice\('XSRF-TOKEN='\.length\)\);\R    \}/    if (false) {\n        return '';\n    }/" \
  "errores.mjs" "$SNAP_DEFECTO"

# ── 4. LA PETICIÓN QUE FALLA EN SILENCIO ─────────────────────────────────────────────
mutar "una respuesta inesperada (419/500) cae en el vacío: silencio" \
  "resources/js/composables/useEdicion.js" \
  "s/        cerrarPopover\(\);\R\R        decision\.value = \{\R            resultado: 'imposible',\R            violations: \[\{\R                code: r\.fallo/        return;\n\n        decision.value = {\n            resultado: 'imposible',\n            violations: [{\n                code: r.fallo/" \
  "errores.mjs" "$SNAP_DEFECTO"

# ── 5. EL COLATERAL QUE SOLO MIRA LOS HUECOS ─────────────────────────────────────────
mutar "el colateral solo mira los HUECOS (se calla el exceso)" \
  "resources/js/composables/useAvisos.js" \
  "s/        if \(s\.state !== 'missing' && s\.state !== 'excess'\) \{/        if (s.state !== 'missing') {/" \
  "colateral.mjs" "$SNAP_DEFECTO"

# ── 6. EL COLATERAL QUE NO MIRA LAS VIOLACIONES ──────────────────────────────────────
mutar "el colateral ignora las violaciones (ni topes, ni descansos, ni solapes)" \
  "resources/js/composables/useAvisos.js" \
  "s/    for \(const id of new Set\(\[\.\.\.antes\.vios\.keys\(\), \.\.\.despues\.vios\.keys\(\)\]\)\) \{/    for (const id of []) {/" \
  "colateral.mjs" "$SNAP_DEFECTO"

# ── 7. EL COLATERAL QUE NO CUENTA LAS BUENAS NOTICIAS ────────────────────────────────
mutar "el colateral solo cuenta las malas noticias" \
  "resources/js/composables/useAvisos.js" \
  "s/    for \(const g of idas\.values\(\)\) \{\R        buenas\.push\(frase\(g, true, ctx\)\);\R    \}/    for (const g of []) {\n        buenas.push(frase(g, true, ctx));\n    }/" \
  "colateral.mjs" "$SNAP_DEFECTO"

# ── 8. EL COLATERAL QUE SE INVENTA UN «ANTES» ────────────────────────────────────────
mutar "se inventa un colateral aunque el informe no hubiera llegado" \
  "resources/js/composables/useAvisos.js" \
  "s/    if \(! coverage\?\.segments \|\| ! violations\) \{\R        return null;\R    \}/    if (! coverage?.segments) {\n        return { celdas: new Map(), vios: new Map(), turnos: new Map() };\n    }/" \
  "colateral.mjs" "$SNAP_DEFECTO"

# ── 9. EL TOPE SEMANAL SIN AGRUPAR: cinco líneas iguales ─────────────────────────────
mutar "el tope semanal escupe una línea por turno, sin agrupar" \
  "resources/js/composables/useAvisos.js" \
  "s/    const clave = \`\\\$\{turno\.personId\}\|\\\$\{v\.code\}\`;/    const clave = \`\\\${turno.id}|\\\${v.code}\`;/" \
  "colateral.mjs" "$SNAP_DEFECTO"

# ── 10. EL EXCESO PINTADO CON LA MARCA ───────────────────────────────────────────────
mutar "el exceso se pinta con la MARCA (el color de una persona)" \
  "resources/js/composables/useMatrizVisual.js" \
  "s/    excess: \{ bg: 'var\(--color-excess-fill\)', border: 'var\(--color-notice\)', color: severityColor\('notice'\) \},/    excess: { bg: 'var(--color-excess-fill)', border: 'var(--color-brand-300)', color: 'var(--color-brand-600)' },/" \
  "semanticos.mjs" "$SNAP_MATRIZ"

apunta ""
apunta "════════════════════════════════════════════════════════════════════════════════════════"
apunta "$(printf '  CAZADOS: %s   ·   ESCAPADOS: %s   ·   NO PROBADAS: %s' "$CAZADOS" "$ESCAPADOS" "$NOPROBADAS")"
apunta ""

if [ "$ESCAPADOS" -gt 0 ]; then
  apunta "  ❌ ESTOS BUGS PASAN DESAPERCIBIDOS. El instrumento que debía cazarlos NO PRUEBA NADA:"
  for e in "${ESCAPES[@]}"; do apunta "     · $e"; done
  apunta ""
  exit 1
fi

if [ "$NOPROBADAS" -gt 0 ]; then
  apunta "  ⚠️  Hay mutaciones que NO LLEGARON A EXISTIR (el patrón no encajó al cambiar el código)."
  apunta "     Eso NO es un aprobado: es que no se probó. Hay que reescribirlas."
  apunta ""
  exit 1
fi

apunta "  ✅ Todos los bugs de la tanda tienen quien los cace."
apunta ""
