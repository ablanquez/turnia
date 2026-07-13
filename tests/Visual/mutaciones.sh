#!/usr/bin/env bash
#
# LA CONTRAPRUEBA DEL INSTRUMENTO. "Si nada se rompe al primer intento, SOSPECHA DEL TEST."
#
# Un detector que nunca ha cazado nada no es un detector: es un adorno que da verde. Así que se
# le meten los bugs A PROPÓSITO —uno a uno, los diez que estas dos tandas han arreglado— y se
# comprueba que los caza TODOS.
#
# ⚠️ Y HAY TRES FORMAS DE MENTIR AQUÍ, Y LAS TRES ME HAN PASADO:
#
#   1. EL TEST REVIENTA (un TimeoutError) → devuelve el mismo código de salida que un hallazgo,
#      y el arnés canta "CAZADO" sobre un test caído. → Se exige que DIGA QUÉ HA VISTO.
#
#   2. LA MUTACIÓN NO SE APLICA (cambié la línea y el `sed` dejó de encajar) → el test pasa,
#      claro, y el arnés canta "ESCAPADO" sobre un bug que nunca se introdujo. → Se COMPRUEBA
#      que el fichero ha cambiado de verdad antes de creerse nada.
#
#   3. EL PROPIO INSTRUMENTO MIDE OTRA COSA (el vacío, las letras, el punto ámbar del avatar).
#      → pixeles.mjs lleva un guardia: si el píxel medido no cuadra con el color declarado, el
#      que suspende es el instrumento.
#
#   bash tests/Visual/mutaciones.sh
#
set -u

MATRIZ=resources/js/composables/useMatrizVisual.js
WEEK=resources/js/Components/Schedule/WeekGrid.vue
PAYLOAD=app/Services/Scheduling/Presentation/SchedulePayload.php
PALETA=app/Services/Scheduling/Presentation/PersonPalette.php

for f in $MATRIZ $WEEK $PAYLOAD $PALETA; do cp "$f" "$f.bak"; done

restaurar() { for f in $MATRIZ $WEEK $PAYLOAD $PALETA; do [ -f "$f.bak" ] && mv "$f.bak" "$f"; done; }
trap restaurar EXIT

cazados=0
escapados=0
rotas=0

# ⚠️ Comprueba que la mutación SE HA APLICADO. Un sed que no encaja es un bug que nunca se
# introdujo, y entonces el "ESCAPADO" no dice nada sobre el detector: dice que no probé nada.
verificar() {
    local f="$1" nombre="$2"

    if cmp -s "$f" "$f.bak"; then
        echo "  ⚠️  NO PROBADA  $nombre"
        echo "               → la mutación no se aplicó (el patrón ya no encaja). No prueba nada."
        rotas=$((rotas + 1))

        return 1
    fi

    return 0
}

restaurar_todo() { for f in $MATRIZ $WEEK $PAYLOAD $PALETA; do cp "$f.bak" "$f"; done; }

probar() {
    local nombre="$1" instrumento="${2:-matriz}"

    npm run build >/dev/null 2>&1
    # Se calienta el servidor: tras tocar un .php la primera petición paga la recompilación, y
    # ese retraso tiraba el instrumento con un TimeoutError — el mismo código de salida que un
    # hallazgo. Un detector que se cae no ha cazado nada.
    curl -s -o /dev/null --max-time 120 http://turnia.test/login 2>/dev/null

    if node "tests/Visual/${instrumento}.mjs" >/tmp/mut.txt 2>&1; then
        echo "  ESCAPADO   $nombre"
        escapados=$((escapados + 1))
    elif ! grep -qE 'DISCREPANCIAS|FALLOS' /tmp/mut.txt; then
        echo "  REVENTÓ    $nombre  — el instrumento se cayó, no lo cazó:"
        tail -3 /tmp/mut.txt | sed 's/^/               /'
        escapados=$((escapados + 1))
    else
        local n
        n=$(sed -n 's/.*[❌] \([0-9]*\) \(DISCREPANCIAS\|FALLOS\).*/\1/p' /tmp/mut.txt | head -1)
        echo "  CAZADO     $nombre  (${n:-?}, por ${instrumento}.mjs)"
        sed -n 's/^   · /             → /p' /tmp/mut.txt | head -1
        cazados=$((cazados + 1))
    fi

    restaurar_todo
}

echo
echo "CONTRAPRUEBA — los diez bugs, reintroducidos a propósito"
echo "──────────────────────────────────────────────────────────────────────────────"

# 1. El nocturno le roba el relleno a la persona.
perl -0pi -e "s/(const color = escala === 'dia' \? \`\\\$\{person\.color\}6E\` : person\.color;)/const color = block.crossesMidnight ? '#534AB7' : (escala === 'dia' ? \`\\\$\{person.color\}6E\` : person.color);/" $MATRIZ
verificar $MATRIZ "1. el nocturno le roba el relleno a la persona" && probar "1. el nocturno le roba el relleno a la persona"

# 2. El forzado pierde su canal y vuelve a compartir el naranja del incumplimiento.
perl -0pi -e "s/forzado: block\.kind === 'shift' && !!block\.forced,/forzado: false,/" $MATRIZ
verificar $MATRIZ "2. el forzado se pinta igual que el que incumple" && probar "2. el forzado se pinta igual que el que incumple"

# 3. Los cuatro cómputos del concepto, otra vez idénticos.
perl -0pi -e "s/return block\.computa \? DENSIDAD\.tramado : DENSIDAD\.hueco;/return DENSIDAD.hueco;/" $MATRIZ
verificar $MATRIZ "3. los cuatro cómputos del concepto pintan igual" && probar "3. los cuatro cómputos del concepto pintan igual"

# 4. Las violaciones de los conceptos, otra vez mudas.
perl -0pi -e "s/const fuente = block\.kind === 'shift' \? violations\.assignments : violations\.conceptEntries;/const fuente = block.kind === 'shift' ? violations.assignments : {};/" $MATRIZ
verificar $MATRIZ "4. las violaciones de los conceptos no se pintan" && probar "4. las violaciones de los conceptos no se pintan"

# 5. Los carteles de celda, otra vez excluyentes.
perl -0pi -e 's/v-if="uncoverableIn\(position\.id, day\.date\)"/v-else-if="uncoverableIn(position.id, day.date)"/' $WEEK
verificar $WEEK "5. imposible y sin-candidato no se pueden ver a la vez" && probar "5. imposible y sin-candidato no se pueden ver a la vez"

# 6. La banda pierde la trama de "bloquea la disponibilidad".
perl -0pi -e "s/const fondo = banda\.blocks \? \`\\\$\{TRAMA_BANDA\}, \\\$\{BANDA_BG\}\` : BANDA_BG;/const fondo = BANDA_BG;/" $MATRIZ
verificar $MATRIZ "6. una baja que bloquea y una que no se pintan igual" && probar "6. una baja que bloquea y una que no se pintan igual"

# 7. El cuarto estado de la tira colapsa contra el exceso.
perl -0pi -e "s/unrequested: \{ bg: '#EFEEF4', border: '#C9C6D6', color: 'transparent' \},/unrequested: { bg: 'var(--color-excess-fill)', border: 'var(--color-brand-300)', color: 'var(--color-brand-600)' },/" $MATRIZ
verificar $MATRIZ "7. 'no se pide a nadie' se pinta como 'sobra gente'" && probar "7. 'no se pide a nadie' se pinta como 'sobra gente'"

# 8. El servidor se calla que un bloque cruza medianoche.
#    ⚠️ EL DIFÍCIL: el pintado queda COHERENTE con la mentira del servidor —si el payload dice
#    que no cruza, la parrilla no pinta el filo y ACIERTA— así que las tres comprobaciones de
#    siempre dan VERDE. Lo único que lo caza es notar que un caso que el modelo permite no ha
#    aparecido por ninguna parte (la lista ESPERADAS de matriz.mjs).
sed -i "s/'crossesMidnight' => \$to > 24,/'crossesMidnight' => false,/g" $PAYLOAD
verificar $PAYLOAD "8. el servidor se calla que un bloque cruza medianoche" && probar "8. el servidor se calla que un bloque cruza medianoche"

# 9. El borde de gravedad vuelve a pintarse con la TINTA en vez de con el RELLENO.
perl -0pi -e "s/const color = severityFill\(severidad\) \?\? person\.color;/const color = severityColor(severidad) ?? person.color;/" $MATRIZ
verificar $MATRIZ "9. el borde de gravedad se pinta con la tinta (ámbar sucio)" && probar "9. el borde de gravedad se pinta con la tinta (ámbar sucio)"

# ── Y las dos que matriz.mjs ES INCAPAZ DE VER ────────────────────────────────
#
# ⚠️ ESTAS DOS JUSTIFICAN QUE EXISTA pixeles.mjs.
#
# matriz.mjs compara los colores que el navegador CALCULA para cada propiedad CSS, y ahí los
# quince índigos de la paleta vieja eran quince colores DISTINTOS: daba 44 firmas y 0 gemelos
# mientras las barras de la Semana eran indistinguibles a ojo. "Firma distinta" no es lo mismo
# que "se distingue", y esa diferencia solo se ve MIDIENDO EL PÍXEL DE LA IMAGEN.
echo
echo "  ── y estas dos, solo las ve pixeles.mjs ──"

# 10. La paleta vieja: quince índigos con la misma luminosidad y el mismo croma.
#     (Los ficheros llevan CRLF, así que los patrones multilínea de perl con \n no encajan: se
#      hace por líneas, que es lo que aguanta los dos finales de línea.)
sed -i "s/^        '#14748A'.*$/        '#7F77DD', '#5B8DEF', '#9B6FD1', '#6478C4', '#A86BB0', '#5E86C9', '#8A6FC7', '#6A76B8', '#7E6FB0', '#A06BB0', '#4E7FD1', '#7A73C9', '#5566B8', '#9166C0', '#6C74C6',/" $PALETA
sed -i "/^        '#E662AE'/d; /^        '#5C4460'/d; /^        '#9EB0F0'/d; /^        '#14C2E4'/d; /^        '#6E68C6'/d; /^        '#1492DE'/d; /^        '#CEAAC6'/d; /^        '#AA328A'/d; /^        '#1A5084'/d; /^        '#927496'/d; /^        '#BC86EA'/d" $PALETA
verificar $PALETA "10. la paleta vieja (quince índigos que el ojo no distingue)" && probar "10. la paleta vieja (quince índigos que el ojo no distingue)" pixeles

# 11. El color se SORTEA en vez de repartirse: dos personas de la misma empresa, el mismo color.
perl -0pi -e "s/        \\\$ids = Employment::query\(\)/        return Employment::query()->where('company_id', \\\$company->id)->distinct()->pluck('person_id')\n            ->mapWithKeys(fn (int \\\$id) => [\\\$id => self::COLORS[crc32((string) \\\$id) % 3]])->all();\n\n        \\\$ids = Employment::query()/" $PALETA
verificar $PALETA "11. el color se sortea (hash) y colisiona dentro de la empresa" && probar "11. el color se sortea (hash) y colisiona dentro de la empresa" pixeles

echo "──────────────────────────────────────────────────────────────────────────────"
echo "  CAZADOS: $cazados    ESCAPADOS: $escapados    NO PROBADAS: $rotas"
echo

npm run build >/dev/null 2>&1
exit $(( escapados + rotas ))
