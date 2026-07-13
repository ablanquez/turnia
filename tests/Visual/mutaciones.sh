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
sed -i "s|    const color = \`\${person.color}\${alfa}\`;|    const color = block.crossesMidnight ? '#534AB7' : \`\${person.color}\${alfa}\`;|" $MATRIZ
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

# 5. Los carteles de celda, otra vez excluyentes: solo se enseña el primero.
#    (Eran v-if / v-else-if. Ahora son un v-for, así que la mutación equivalente es truncar la
#     lista: una celda que es imposible Y sin candidato solo enseñaría el imposible.)
#    (Los ficheros llevan CRLF: los patrones multilínea de perl con \n NO encajan. Se hace por
#     líneas, que es lo único que aguanta los dos finales de línea.)
sed -i 's/v-for="cartel in carteles(position.id, day.date)"/v-for="cartel in carteles(position.id, day.date).slice(0, 1)"/' $WEEK
verificar $WEEK "5. los carteles no se apilan: solo se ve el primero" && probar "5. los carteles no se apilan: solo se ve el primero"

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

# 9. El anillo de gravedad vuelve a pintarse con la TINTA en vez de con el RELLENO.
sed -i "s|    const color = severityFill(severidad);|    const color = severityColor(severidad);|" $MATRIZ
verificar $MATRIZ "9. el anillo de gravedad se pinta con la tinta (ámbar sucio)" && probar "9. el anillo de gravedad se pinta con la tinta (ámbar sucio)"

# 10. EL CARTEL NARANJA DESAPARECE: el incumplimiento vuelve a vivir solo en una nota pequeña.
perl -0pi -e "s/    for \(const severidad of \['impossible', 'breach'\]\) \{/    for (const severidad of ['impossible']) {/" $MATRIZ
verificar $MATRIZ "10. el incumplimiento pierde su cartel (vuelve a la nota pequeña)" && probar "10. el incumplimiento pierde su cartel (vuelve a la nota pequeña)"

# 11. EL CARTEL NARANJA SALE TAMBIÉN EN EL FORZADO: alarma sobre una decisión ya tomada.
perl -0pi -e "s/            \.filter\(\(b\) => severidad === 'impossible' \|\| ! b\.forced\)/            .filter(() => true)/" $MATRIZ
verificar $MATRIZ "11. el incumplimiento YA FORZADO también grita (cuadrante en llamas)" && probar "11. el incumplimiento YA FORZADO también grita (cuadrante en llamas)"

# ── Y LAS TRES QUE matriz.mjs ES INCAPAZ DE VER ───────────────────────────────
#
# ⚠️ ESTAS TRES JUSTIFICAN QUE EXISTA pixeles.mjs.
#
# matriz.mjs compara los colores que el navegador CALCULA para cada propiedad CSS. Y ahí los
# quince índigos de la paleta vieja eran quince colores DISTINTOS: daba 44 firmas y 0 gemelos
# mientras las barras de la Semana eran indistinguibles a ojo. Lo mismo con el borde: un borde
# ámbar sobre un relleno teal SON dos propiedades correctas, y lo que sale es un verde que
# significa "cobertura correcta". "Declarado bien" no es lo mismo que "se ve bien", y esa
# diferencia solo aparece MIDIENDO EL PÍXEL DE LA IMAGEN.
echo
echo "  ── y estas tres, solo las ve pixeles.mjs ──"

# 12. LA GRAVEDAD VUELVE DENTRO DE LA BARRA (como borde). El bug de esta tanda, reintroducido.
#     El borde se come el 40 % de la barra y el ojo ve una MEZCLA: el teal con un aviso ámbar da
#     un verde a ΔE 10 del verde de "cobertura correcta". Un aviso pintado del color de "todo bien".
#     Una sola sustitución: el anillo deja de ser `outline` (fuera) y vuelve a ser `border`
#     (dentro), que es lo que pisaba el relleno. Como `border` va después de la base en el spread,
#     la sobrescribe — igual que estaba antes.
sed -i "s|        boxShadow: \`0 -\${px}px 0 0 \${color}, 0 \${px}px 0 0 \${color}\`,|        border: \`2px solid \${color}\`,|" $MATRIZ
verificar $MATRIZ "12. la gravedad vuelve DENTRO de la barra (borde en vez de franja)" && probar "12. la gravedad vuelve DENTRO de la barra (borde en vez de franja)" pixeles

# 12c. EL ANILLO VUELVE A RODEAR (outline). El bug del turno corto, reintroducido: el peso del
#      anillo pasa a depender del ANCHO de la barra, y en un turno de una hora se come el 67 %.
#      ⚠️ SOLO LO VE anchos.mjs, porque la demo y los 96 casos del cuadrante usan turnos de 8 h:
#      con barras anchas, el anillo que rodea PASA. El peor caso geométrico hay que sembrarlo.
sed -i "s|        boxShadow: \`0 -\${px}px 0 0 \${color}, 0 \${px}px 0 0 \${color}\`,|        outline: \`\${px}px solid \${color}\`,|" $MATRIZ
verificar $MATRIZ "12c. el anillo vuelve a RODEAR (y en un turno de 1 h se come la barra)" && probar "12c. el anillo vuelve a RODEAR (y en un turno de 1 h se come la barra)" anchos

# 12b. EL ANILLO DEL INCUMPLIMIENTO SE QUEDA FINO OTRA VEZ (2 px, como estaba).
#      A 2 px sobre una barra de 16 el naranja se lee como un borde, no como una alarma. Esto NO
#      lo caza un instrumento —"se ve poco" no es una medida—: lo cazó el usuario con los ojos, y
#      lo único que lo sujeta es que matriz.mjs exige EL GROSOR que la matriz declara.
sed -i "s/const ANILLO = { notice: '2px', breach: '3px', impossible: '4px' };/const ANILLO = { notice: '1.5px', breach: '2px', impossible: '3px' };/" $MATRIZ
verificar $MATRIZ "12b. el anillo del incumplimiento se queda fino (2 px)" && probar "12b. el anillo del incumplimiento se queda fino (2 px)"

# 13. La paleta de croma bajo: ciruelas y grises que no tienen color propio y adoptan el del
#     anillo. Con el borde arreglado siguen fallando — los dos arreglos hacen falta.
sed -i "s/^        '#70D0CC'.*$/        '#14748A', '#E662AE', '#5C4460', '#9EB0F0', '#14C2E4', '#6E68C6', '#1492DE', '#CEAAC6', '#AA328A', '#1A5084', '#927496', '#BC86EA',/" $PALETA
sed -i "/^        '#0880A8'/d; /^        '#38A0FC'/d; /^        '#989CFC'/d; /^        '#5844BC'/d; /^        '#840884'/d; /^        '#40CCFC'/d; /^        '#08507C'/d; /^        '#4470F0'/d; /^        '#8074A8'/d; /^        '#F890F8'/d; /^        '#C844B8'/d" $PALETA
verificar $PALETA "13. la paleta de croma bajo (el ciruela de Marco, que se vuelve marrón)" && probar "13. la paleta de croma bajo (el ciruela de Marco, que se vuelve marrón)" pixeles

# 14. El color se SORTEA en vez de repartirse: dos personas de la misma empresa, el mismo color.
perl -0pi -e "s/        \\\$ids = Employment::query\(\)/        return Employment::query()->where('company_id', \\\$company->id)->distinct()->pluck('person_id')\n            ->mapWithKeys(fn (int \\\$id) => [\\\$id => self::COLORS[crc32((string) \\\$id) % 3]])->all();\n\n        \\\$ids = Employment::query()/" $PALETA
verificar $PALETA "14. el color se sortea (hash) y colisiona dentro de la empresa" && probar "14. el color se sortea (hash) y colisiona dentro de la empresa" pixeles

# ── LA TRAMA. Y ESTAS DOS EXISTEN PORQUE PROBÉ LA 15 Y NO LA CAZABA NADIE ──────
#
# ⚠️ Arreglé la trama y ME QUEDÉ SIN NADA QUE SUJETARA EL ARREGLO. Metí el fallo viejo a propósito
# y el instrumento —el mismo que acababa de escribir— lo dejó PASAR: con la paleta nueva hay tanto
# sitio (D = 16,1) que la tinta índigo tampoco llega a mover la MEDIA hasta otra persona. El tono
# ajeno SE DILUYE AL PROMEDIAR, y la mentira sobrevive al promedio.
#
# Un instrumento que mide el resultado y no la causa da verde sobre el bug que acabas de quitar.

# 15. LA TRAMA VUELVE A LA TINTA FIJA. El canal de la DENSIDAD mete un TONO que la IDENTIDAD no ha
#     puesto: la raya de Iker (teal) sale índigo, y la de Bea salía del color de MARCO. Medido: la
#     raya se desvía 40–70° del tono de su relleno.
sed -i "s|^export const tramaDe = (color, alfa = '') => .*$|export const tramaDe = (color, alfa = '') => 'repeating-linear-gradient(45deg, rgba(44,38,67,.30) 0 3px, transparent 3px 7px)';|" $MATRIZ
verificar $MATRIZ "15. la trama vuelve a la TINTA FIJA (la raya de uno lleva el color de otro)" && probar "15. la trama vuelve a la TINTA FIJA (la raya de uno lleva el color de otro)" pixeles

# 16. LA SOMBRA SE RECORTA EN VEZ DE BAJARLE EL CROMA. Bajar L* en un azul oscuro lo saca del gamut
#     sRGB; recortar el canal a 0 MUEVE EL TONO. Es la misma mentira que la 15, pero silenciosa: el
#     código dice "mismo tono" y el espacio de color dice otra cosa. La cazó pixeles.mjs sobre mi
#     propia implementación, a la primera pasada.
sed -i "s|^    if (cabe(\[objetivo, A, B\])) {$|    if (true) {|" $MATRIZ
verificar $MATRIZ "16. la sombra se RECORTA (y el recorte mueve el tono de la raya)" && probar "16. la sombra se RECORTA (y el recorte mueve el tono de la raya)" pixeles

# 17. LA TRAMA SE APAGA: la sombra baja solo 6 de L*. La raya deja de verse, y un bloque que NO
#     CUBRE EL PUESTO se lee como SÓLIDO — o sea, como si lo cubriera. Silencio falso, y del caro:
#     el turno imposible de Tomás parecería estar cubriendo la caja.
sed -i "s/^const BAJADA = 22;$/const BAJADA = 6;/" $MATRIZ
verificar $MATRIZ "17. la trama se apaga (la raya deja de verse: un bloque que no cubre parece sólido)" && probar "17. la trama se apaga (la raya deja de verse: un bloque que no cubre parece sólido)" pixeles

# 18. LAS NOTAS SE AGRUPAN POR LO PARECIDO (por el icono) EN VEZ DE POR EL MOTIVO EXACTO.
#     Agrupar es BORRAR: dos turnos con motivos distintos caen bajo una sola frase y uno de los dos
#     motivos DESAPARECE de la pantalla. Un dato perdido por ahorrar espacio — el silencio falso de
#     siempre, pero con buena letra. Lo caza matriz.mjs porque la nota entra en la FIRMA: al perder
#     un motivo, dos casos distintos se vuelven gemelos visuales.
sed -i 's@const clave = `${n.icono}|${n.texto}|${n.color}|${n.dot}`;@const clave = `${n.icono}`;@' $MATRIZ
verificar $MATRIZ "18. las notas agrupan lo PARECIDO (y un motivo desaparece)" && probar "18. las notas agrupan lo PARECIDO (y un motivo desaparece)"

echo "──────────────────────────────────────────────────────────────────────────────"
echo "  CAZADOS: $cazados    ESCAPADOS: $escapados    NO PROBADAS: $rotas"
echo

npm run build >/dev/null 2>&1
exit $(( escapados + rotas ))
