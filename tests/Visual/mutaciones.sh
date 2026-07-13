#!/usr/bin/env bash
#
# LA CONTRAPRUEBA DEL INSTRUMENTO. "Si nada se rompe al primer intento, SOSPECHA DEL TEST."
#
# Un detector que nunca ha cazado nada no es un detector: es un adorno que da verde. Así que se
# le meten los bugs A PROPÓSITO —uno a uno, los ocho que esta tanda ha arreglado— y se comprueba
# que los caza TODOS. Si alguno pasa, el instrumento está ciego justo donde más falta hace.
#
#   bash tests/Visual/mutaciones.sh
#
set -u

MATRIZ=resources/js/composables/useMatrizVisual.js
WEEK=resources/js/Components/Schedule/WeekGrid.vue
PAYLOAD=app/Services/Scheduling/Presentation/SchedulePayload.php

cp $MATRIZ $MATRIZ.bak; cp $WEEK $WEEK.bak; cp $PAYLOAD $PAYLOAD.bak

restaurar() {
    mv $MATRIZ.bak $MATRIZ 2>/dev/null
    mv $WEEK.bak $WEEK 2>/dev/null
    mv $PAYLOAD.bak $PAYLOAD 2>/dev/null
}
trap restaurar EXIT

cazados=0
escapados=0

probar() {
    local nombre="$1"
    npm run build >/dev/null 2>&1
    # Se calienta el servidor antes de medir. Tras tocar un .php, la primera petición paga la
    # recompilación, y ese retraso tiraba el instrumento con un TimeoutError — que devuelve el
    # mismo código de salida que un hallazgo. Un detector que se cae no ha cazado nada.
    curl -s -o /dev/null --max-time 120 http://turnia.test/login 2>/dev/null
    if node tests/Visual/matriz.mjs >/tmp/mut.txt 2>&1; then
        echo "  ESCAPADO   $nombre"
        escapados=$((escapados + 1))
    elif ! grep -q 'DISCREPANCIAS' /tmp/mut.txt; then
        # ⚠️ REVENTAR NO ES CAZAR. Un instrumento que se cae con la mutación devuelve el mismo
        # código de salida que uno que la detecta, y si me quedo con el código de salida me creo
        # un detector que en realidad está roto. Aquí se exige que DIGA QUÉ HA VISTO.
        echo "  REVENTÓ    $nombre  — el instrumento se cayó, no lo cazó:"
        tail -4 /tmp/mut.txt | sed 's/^/             /'
        escapados=$((escapados + 1))
    else
        # El número se lee de la línea que lo dice, no se recuenta a ojo: contar las líneas por
        # su sangría daba CERO en una mutación que sí se había cazado, y un detector que informa
        # "cazado, 0 discrepancias" es justo la clase de mensaje que no hay que creerse.
        local n
        n=$(sed -n 's/.*❌ \([0-9]*\) DISCREPANCIAS.*/\1/p' /tmp/mut.txt | head -1)
        echo "  CAZADO     $nombre  (${n:-?} discrepancias)"
        sed -n 's/^   · /             → /p' /tmp/mut.txt | head -1
        cazados=$((cazados + 1))
    fi
    cp $MATRIZ.bak $MATRIZ; cp $WEEK.bak $WEEK; cp $PAYLOAD.bak $PAYLOAD
}

echo
echo "CONTRAPRUEBA — los ocho bugs de esta tanda, reintroducidos a propósito"
echo "──────────────────────────────────────────────────────────────────────────────"

# 1. El nocturno le roba el relleno a la persona (el bug original).
sed -i "s|const color = escala === 'dia' ? \`\${person.color}26\` : person.color;|const color = block.crossesMidnight ? '#534AB7' : (escala === 'dia' ? \`\${person.color}26\` : person.color);|" $MATRIZ
probar "1. el nocturno le roba el relleno a la persona"

# 2. El forzado pierde su canal (vuelve a compartir el naranja del incumplimiento).
sed -i "s|forzado: block.kind === 'shift' \&\& !!block.forced,|forzado: false,|" $MATRIZ
probar "2. el forzado se pinta igual que el que incumple"

# 3. Los cuatro cómputos del concepto, otra vez idénticos.
sed -i "s|return block.computa ? DENSIDAD.tramado : DENSIDAD.hueco;|return DENSIDAD.hueco;|" $MATRIZ
probar "3. los cuatro cómputos del concepto pintan igual"

# 4. Las violaciones de los conceptos, otra vez mudas.
sed -i "s|const fuente = block.kind === 'shift' ? violations.assignments : violations.conceptEntries;|const fuente = block.kind === 'shift' ? violations.assignments : {};|" $MATRIZ
probar "4. las violaciones de los conceptos no se pintan"

# 5. Los carteles de celda, otra vez excluyentes.
sed -i 's|v-if="uncoverableIn(position.id, day.date)"|v-else-if="uncoverableIn(position.id, day.date)"|' $WEEK
probar "5. imposible y sin-candidato no se pueden ver a la vez"

# 6. La banda pierde la trama de "bloquea la disponibilidad".
sed -i "s|const fondo = banda.blocks ? \`\${TRAMA}, \${BANDA_BG}\` : BANDA_BG;|const fondo = BANDA_BG;|" $MATRIZ
probar "6. una baja que bloquea y una que no se pintan igual"

# 7. El cuarto estado de la tira colapsa contra el exceso.
sed -i "s|unrequested: { bg: '#EFEEF4', border: '#C9C6D6', color: 'transparent' },|unrequested: { bg: 'var(--color-excess-fill)', border: 'var(--color-brand-300)', color: 'var(--color-brand-600)' },|" $MATRIZ
probar "7. 'no se pide a nadie' se pinta como 'sobra gente'"

# 8. El servidor se calla que el concepto cruza medianoche.
#    ⚠️ ÉSTE ES EL DIFÍCIL, y es el que justifica la cuenta de casos alcanzados: el pintado queda
#    COHERENTE con la mentira del servidor —si el payload dice que no cruza, la parrilla no pinta
#    el filo y acierta— así que las tres comprobaciones de siempre dan VERDE. Lo único que lo
#    caza es notar que un caso que el modelo permite no aparece por ninguna parte.
perl -0pi -e "s/(\* puede probar\.\n                 \*\/\n                )'crossesMidnight' => \\\$to > 24,/\${1}'crossesMidnight' => false,/" $PAYLOAD
grep -q "'crossesMidnight' => false," $PAYLOAD || { echo "  ⚠️  la mutación 8 no se aplicó: el test no probaría nada"; exit 2; }
probar "8. el servidor se calla que el concepto cruza medianoche"

echo "──────────────────────────────────────────────────────────────────────────────"
echo "  CAZADOS: $cazados/8    ESCAPADOS: $escapados/8"
echo

npm run build >/dev/null 2>&1
exit $escapados
