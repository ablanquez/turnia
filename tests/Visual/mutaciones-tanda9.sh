#!/usr/bin/env bash
#
# ═══════════════════════════════════════════════════════════════════════════════════════
# LA CONTRAPRUEBA: SE REINTRODUCE CADA BUG DE ESTA TANDA Y SE MIRA SI EL INSTRUMENTO LO CAZA.
# ═══════════════════════════════════════════════════════════════════════════════════════
#
# ⚠️ TRES ESTADOS, NO DOS: CAZADO · ESCAPADO · NO PROBADA.
#
# «No probada» es que el parche NO ENCAJÓ (el código cambió y el `sed` ya no encuentra su patrón).
# Y eso NO es un aprobado: es que la mutación no llegó a existir, así que el verde del instrumento
# no significa nada. Un test que revienta no es un test que caza — y **cero casos probados no es
# cero fallos**.
#
#   bash tests/Visual/mutaciones-tanda9.sh
#
set -u
cd "$(dirname "$0")/../.." || exit 1

# ═══════════════════════════════════════════════════════════════════════════════════════
# ⚠️⚠️ ESTE SCRIPT **NO USA `git checkout` PARA RESTAURAR**. Y ESO NO ES UNA MANÍA.
# ═══════════════════════════════════════════════════════════════════════════════════════
#
# La primera versión hacía `git checkout -- resources/ app/` al terminar. Y `git checkout` no
# restaura «lo que había antes de la mutación»: restaura **lo que hay en el último commit**. O sea
# que si tienes trabajo SIN COMMITEAR —y aquí siempre lo hay, porque la contraprueba se corre justo
# antes de cerrar la tanda— **te lo borra entero, sin preguntar y sin decir nada.**
#
# Me pasó. Perdí la tanda del colateral completa y hubo que rehacerla. Y ya había pasado una vez.
#
# Ahora se guarda una COPIA REAL del fichero antes de tocarlo y se restaura DESDE ESA COPIA. Un
# script que muta el código tiene que dejarlo EXACTAMENTE como lo encontró — commiteado o no. Es la
# misma ley que la de los instrumentos que siembran: si mutas el mundo y no lo restauras, no eres un
# instrumento: eres un accidente.
COPIAS="$(mktemp -d)"
trap 'restaurar_todo' EXIT

CAZADOS=0; ESCAPADOS=0; NOPROBADAS=0
ESCAPES=()
TOCADOS=()

restaurar_todo() {
  for f in "${TOCADOS[@]:-}"; do
    [ -n "$f" ] && cp "$COPIAS/$(echo "$f" | tr '/' '_')" "$f" 2>/dev/null
  done

  rm -rf "$COPIAS"
  npm run build >/dev/null 2>&1
}

# $1 = nombre · $2 = fichero · $3 = patrón perl · $4 = instrumento
mutar() {
  local nombre="$1" fichero="$2" patron="$3" instrumento="$4"
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
    printf '  ⚠️  NO PROBADA  %s\n' "$nombre"
    printf '                 (el patrón no encajó: la mutación NO EXISTE, así que el verde no dice nada)\n'
    NOPROBADAS=$((NOPROBADAS+1))
    return
  fi

  npm run build >/dev/null 2>&1

  if node "tests/Visual/$instrumento" >/dev/null 2>&1; then
    printf '  ❌ ESCAPADO    %s\n' "$nombre"
    printf '                 (%s dio VERDE con el bug dentro)\n' "$instrumento"
    ESCAPADOS=$((ESCAPADOS+1))
    ESCAPES+=("$nombre  →  $instrumento")
  else
    printf '  ✅ CAZADO      %s   (%s)\n' "$nombre" "$instrumento"
    CAZADOS=$((CAZADOS+1))
  fi

  # Se restaura DESDE LA COPIA, nunca desde git: puede haber trabajo sin commitear.
  cp "$copia" "$fichero"
}

echo
echo "CONTRAPRUEBA — se mete cada bug de la tanda y se mira quién lo caza"
echo "════════════════════════════════════════════════════════════════════════════════════════"
echo

# ── 1. EL VERDE EN EL else (ley 21) — la celda de destino ─────────────────────────────
mutar "el verde en el else · la celda no sabe y pinta que SÍ" \
  "resources/js/Components/Schedule/WeekGrid.vue" \
  "s/    const p = edicion\.previa\.value;\n\n    \/\/ ⚠️ TODAVÍA NO HA CONTESTADO[^\n]*\n    if \(! p\) \{/    const p = edicion.previa.value ?? {};\n\n    if (false) {/" \
  "errores.mjs"

# ── 2. EL VERDE EN EL else — el fallo se pinta como limpio ────────────────────────────
mutar "el fallo del servidor se pinta como LIMPIO (verde)" \
  "resources/js/Components/Schedule/WeekGrid.vue" \
  "s/    if \(p\.fallo\) \{/    if (false) {/" \
  "errores.mjs"

# ── 3. EL CSRF DEL <meta> — el token que no se refresca ───────────────────────────────
mutar "el CSRF sale del <meta>, que en una SPA no se refresca nunca" \
  "resources/js/composables/useEscritura.js" \
  "s/    if \(cookie\) \{\n        return decodeURIComponent\(cookie\.slice\('XSRF-TOKEN='\.length\)\);\n    \}/    if (false) {\n        return '';\n    }/" \
  "errores.mjs"

# ── 4. LA PETICIÓN QUE FALLA EN SILENCIO ─────────────────────────────────────────────
mutar "una respuesta inesperada (419/500) cae en el vacío: silencio" \
  "resources/js/composables/useEdicion.js" \
  "s/        cerrarPopover\(\);\n\n        decision\.value = \{\n            resultado: 'imposible',\n            violations: \[\{\n                code: r\.fallo/        return;\n\n        decision.value = {\n            resultado: 'imposible',\n            violations: [{\n                code: r.fallo/" \
  "errores.mjs"

# ── 5. EL COLATERAL QUE SOLO MIRA LOS HUECOS ─────────────────────────────────────────
mutar "el colateral solo mira los HUECOS (se calla el exceso)" \
  "resources/js/composables/useAvisos.js" \
  "s/        if \(s\.state !== 'missing' && s\.state !== 'excess'\) \{/        if (s.state !== 'missing') {/" \
  "colateral.mjs"

# ── 6. EL COLATERAL QUE NO MIRA LAS VIOLACIONES ──────────────────────────────────────
mutar "el colateral ignora las violaciones (ni topes, ni descansos, ni solapes)" \
  "resources/js/composables/useAvisos.js" \
  "s/    for \(const id of new Set\(\[\.\.\.antes\.vios\.keys\(\), \.\.\.despues\.vios\.keys\(\)\]\)\) \{/    for (const id of []) {/" \
  "colateral.mjs"

# ── 7. EL COLATERAL QUE NO CUENTA LAS BUENAS NOTICIAS ────────────────────────────────
mutar "el colateral solo cuenta las malas noticias" \
  "resources/js/composables/useAvisos.js" \
  "s/    for \(const g of idas\.values\(\)\) \{\n        buenas\.push\(frase\(g, true, ctx\)\);\n    \}/    for (const g of []) {\n        buenas.push(frase(g, true, ctx));\n    }/" \
  "colateral.mjs"

# ── 8. EL COLATERAL QUE SE INVENTA UN «ANTES» ────────────────────────────────────────
mutar "se inventa un colateral aunque el informe no hubiera llegado" \
  "resources/js/composables/useAvisos.js" \
  "s/    if \(! coverage\?\.segments \|\| ! violations\) \{\n        return null;\n    \}/    if (! coverage?.segments) {\n        return { celdas: new Map(), vios: new Map(), turnos: new Map() };\n    }/" \
  "colateral.mjs"

# ── 9. EL TOPE SEMANAL SIN AGRUPAR: cinco líneas iguales ─────────────────────────────
mutar "el tope semanal escupe una línea por turno, sin agrupar" \
  "resources/js/composables/useAvisos.js" \
  "s/    const clave = \`\\\$\{turno\.personId\}\|\\\$\{v\.code\}\`;/    const clave = \`\\\${turno.id}|\\\${v.code}\`;/" \
  "colateral.mjs"

# ── 10. EL EXCESO PINTADO CON LA MARCA ───────────────────────────────────────────────
mutar "el exceso se pinta con la MARCA (el color de una persona)" \
  "resources/js/composables/useMatrizVisual.js" \
  "s/    excess: \{ bg: 'var\(--color-excess-fill\)', border: 'var\(--color-notice\)', color: severityColor\('notice'\) \},/    excess: { bg: 'var(--color-excess-fill)', border: 'var(--color-brand-300)', color: 'var(--color-brand-600)' },/" \
  "semanticos.mjs"

echo
echo "════════════════════════════════════════════════════════════════════════════════════════"
printf '  CAZADOS: %s   ·   ESCAPADOS: %s   ·   NO PROBADAS: %s\n' "$CAZADOS" "$ESCAPADOS" "$NOPROBADAS"
echo

if [ "$ESCAPADOS" -gt 0 ]; then
  echo "  ❌ ESTOS BUGS PASAN DESAPERCIBIDOS. El instrumento que debía cazarlos NO PRUEBA NADA:"
  for e in "${ESCAPES[@]}"; do echo "     · $e"; done
  echo
  exit 1
fi

if [ "$NOPROBADAS" -gt 0 ]; then
  echo "  ⚠️  Hay mutaciones que NO LLEGARON A EXISTIR (el patrón no encajó al cambiar el código)."
  echo "     Eso NO es un aprobado: es que no se probó. Hay que reescribirlas."
  echo
  exit 1
fi

echo "  ✅ Todos los bugs de la tanda tienen quien los cace."
echo
