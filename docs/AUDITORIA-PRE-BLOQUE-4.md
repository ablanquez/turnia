# Auditoría pre-Bloque 4 — TURNIA

- **Fecha:** 2026-07-23
- **Commit auditado:** `29c0a64` (feat: Bloque 3 — parrilla estática en fichas, hilo-guía, hueco reservado)
- **Rama:** `main` (limpia, 0 ficheros `dist/`); `produccion` en `229a95a` (solo compilado, coherente)
- **Estado en una línea:** la parrilla estática se ve y se despliega sola, pero **descansa sobre cero tests y cero instrumentos de geometría vivos** — todo lo que se midió en el Bloque 3 se borró tras medirlo una vez.

> Diagnóstico puro. No se ha tocado código. Las propuestas de la tabla de rumbo son propuestas, no acciones.

---

## 1. TESTS: inventario real

### Lo que HAY
- Un `package.json` con scripts `dev`, `build`, `preview`, `estilo:check`. El único de verificación es `estilo:check` = `node sin-hex.check.mjs && node contraste.check.mjs`.
- `contraste.check.mjs`: afirma que cada color de identidad está a ΔE ≥ 24 del estado más cercano, ΔE ≥ 8 del fondo/marca más cercano, croma ≥ 30, y R < D/2 (con R fijado a 0). Lee los colores de la fuente real (paleta.js + parseo de tokens.css).
- `sin-hex.check.mjs`: afirma que no hay `#hex` ni `rgb()/hsl()/oklch()` aplicado (no en comentario) en ningún `.vue`/`.css` bajo `src/`.

### Lo que NO HAY
- No hay runner de tests (ni Vitest, ni Jest, ni ningún otro). No existe fichero de configuración de test. No existe ni un solo `*.test.*` / `*.spec.*` en el repo.
- No hay ningún test de `useEje`: left%/width% no lo prueba nada; el ensanche del eje por debajo de 06:00 no lo prueba nada (solo lo ejercita el dato de Carlos, sin aserción); el ensanche por encima de 06:00 del día siguiente no lo ejercita ni un dato ni un test; la rejilla cada 6 h en horas redondas al ensancharse no lo prueba nada.
- No hay ningún test del reparto en carriles: **la función `carriles` se eliminó en el Bloque 3** (cada turno es su propia ficha), así que no hay ni código ni test de solape de dos / de tres / de un minuto / de contención total. Ese reparto **ya no existe** en el nuevo.
- No hay ningún test de `normaliza()` — la función que tuvo el bug `08:00–960`. Nada la prueba.
- No hay ningún test de `useDispositivo` ni del umbral de gestión. El `matchMedia` no lo ejercita nada automático.
- No hay ningún test del hueco de cobertura ni de su alto reservado (15 px + 9). Se midió una vez a mano y el script se borró.
- Ningún test depende del build porque no hay tests. (Los dos checkers de color NO dependen del build: leen los `.js`/`.css` fuente directamente.)
- Ningún test prueba contra un sustituto: los dos checkers leen la fuente real. Pero **la geometría no la prueba nada, ni real ni sustituto.**

---

## 2. Instrumentos visuales: ¿se acumularon o se perdieron?

**Veredicto de la sección: se PERDIERON todos.** Los únicos instrumentos que sobreviven en el repo son `sin-hex.check.mjs` y `contraste.check.mjs`, y **los dos miden color, ninguno mide geometría**. No hay ni un `.mjs` con Playwright/Chromium en `src/`. Los scripts de medición se escribieron como ficheros temporales dentro de `F:\01_PROYECTOS\002_TURNIA-OLD-LARAVEL` (la única carpeta con Playwright) y se borraron con `rm -f` tras cada uso. En el scratchpad solo quedan los PNG, ningún script.

Por cada medición del Bloque 3:

- **Barra de 1 h a 6,1 px, ratio 0,125 = 1/8** — script de un solo uso, borrado. Sin guardia. Sin contraprueba (se ejecutó una vez en verde; nunca se reintrodujo un ancho mínimo para ver si lo cazaba). Medía el píxel resultante (`getBoundingClientRect`). Hoy: no reejecutable.
- **Mismo `#C484FC` en 1 h y 8 h, dist 0,0** — mismo script, borrado. Sin guardia, sin contraprueba. Medía el píxel resultante (`getImageData` del canvas). Hoy: no reejecutable.
- **0 barras con texto dentro** — mismo script, borrado. Sin guardia, sin contraprueba (nunca se metió texto a propósito para ver si lo cazaba). Medía `textContent` del DOM real. Hoy: no reejecutable.
- **Hueco muerto de 1 px tras el cajetín** — script `_cap.mjs` por heredoc, borrado en la misma línea. Sin guardia, sin contraprueba. Medía `getBoundingClientRect`. Hoy: no reejecutable.
- **Hilo de 2 px en rgb(196,132,252)** — script `_cap.mjs`, borrado. Sin guardia, sin contraprueba. Medía `getComputedStyle`. Hoy: no reejecutable.
- **Tira reservada de 15 px con 9 px de separación** — script `_cap.mjs`, borrado. Sin guardia, sin contraprueba. Medía `getBoundingClientRect` + `getComputedStyle`. Hoy: no reejecutable.
- **Panadería de 04:00 no recortada** — primer script `verif-parrilla.mjs`, borrado. Sin guardia, sin contraprueba (nunca se recortó a propósito para ver si lo cazaba). Medía `getBoundingClientRect`. Hoy: no reejecutable.

- **¿Distinguen CAZADO / ESCAPADO / NO PROBADA?** No. Imprimían `✅`/`❌`, pero si el script petaba (navegador caído, selector cambiado) lanzaba excepción y moría — que un humano distingue de "no encontró nada", pero el instrumento no lo reportaba como tercer estado. No había guardia que dijera "el instrumento reventó, no te fíes del verde".

**La pregunta que cierra la sección — cuando el Bloque 4 mueva barras al arrastrar, ¿qué re-verifica que el ratio sigue, que el color no se falsea, que ningún texto entra en una barra, que nada se recorta? NADA. No hay nada que lo cubra.** Cada una de esas propiedades se comprobó una sola vez, a mano, con un script que ya no existe.

---

## 3. Qué dio verde mientras algo estaba roto (repaso de la bitácora)

La bitácora tiene **4 entradas**. Por cada una, qué dio verde y si HOY hay algo que la cace si vuelve:

- **Reinicio (carencia).** No es un fallo con prueba que mintiera; es una decisión de arquitectura. No aplica guardia. — sin deuda.
- **Fuentes 80→14 (despliegue).** Verde mientras vivía: build + deploy + tablero `/estilo`. **HOY: no hay nada que lo cace.** No existe ninguna comprobación del peso de `produccion` ni de que los imports de fuente sean solo `latin`. Si alguien vuelve a escribir `@fontsource/…/400.css`, sube el mundo entero otra vez, en silencio. **DEUDA.**
- **`08:00–960` (datos).** Verde mientras vivía: build + los dos checkers de color, y cada barra bien pintada. **HOY: no hay nada que lo cace.** `normaliza()` sigue sin test; nada lee el TEXTO de un rótulo. Si el bug vuelve, vuelve a viajar hasta la captura. **DEUDA.**
- **Rótulo dentro de la barra vs Ley 2 (método/carencia).** Verde mientras vivía: la medición "¿el rótulo pisa otra barra?" daba 0 (solo miraba rótulo-vs-rectángulo). **HOY: no hay nada automático que lo cace.** La garantía es estructural (la barra ya no recibe texto) + el ojo humano contra la referencia; no hay un instrumento que afirme "0 texto en barra" de forma reejecutable. **DEUDA parcial** (mitigado por estructura, no por instrumento).

**Fallos de los que hablamos en conversación y que NO llegaron a la bitácora:**
- **El cajetín estirado por `h-full`** (el panel no ajustaba su alto al contenido; se arregló a `max-h-full`). Se corrigió dentro del `feat:`, sin entrada de bitácora. No consta.
- **El commit que se adelantó al punto de control** (se commiteó la v1 de bloques pelados antes de enseñar la captura; luego se deshizo con `reset --soft`). Se habló, se reconoció en el chat, **no se anotó**. No consta.
- **`tintaSobre` retirado y luego repuesto** en la misma tanda (se quitó al no tener texto la barra, se repuso para la insignia). Quedó reflejado al reescribir la entrada del rótulo, pero no como caso propio. Menor.

---

## 4. Gobernanza y hooks

### Lo que HAY
- Hook `commit-msg` activo (`git config core.hooksPath` = `.githooks`, confirmado).
- Regla 1: todo `fix:` sin `docs/BITACORA.md` en el stage → autogenera el esqueleto (todo NO CONSTA), lo añade al stage y aborta (exit 1). Al recommitear pasa.
- Regla 2a: si el commit toca algún `.vue`/`.css` → corre `sin-hex.check`. Falla el commit si hay color suelto.
- Regla 2b: si el commit toca `paleta.js` o `tokens.css` → corre `contraste.check`. Falla el commit si un color colisiona entre familias.

### Lo que NO HAY / lo que NO vigila
- El hook es `commit-msg`: **se salta con `git commit --no-verify`**, a propósito o por costumbre. Nada lo impide.
- **Un cambio de solo-lógica en un `.js` que no sea `paleta.js` entra a `main` sin pasar por NINGUNA comprobación.** `useEje.js` (el fichero que tuvo el bug `08:00–960`), `useDispositivo.js`, `semana.js`, `reglas.js`: editarlos no dispara sin-hex (solo escanea `.vue`/`.css`) ni contraste (solo `paleta`/`tokens`). Cero red.
- Un `feat:` (como este Bloque 3) **no exige entrada de bitácora**: solo los `fix:`. Un fallo cazado y arreglado dentro de un `feat:` puede cerrarse sin registro (ocurrió: el cajetín `h-full`).
- `contraste.check` NO vigila: estado↔estado; **fondo↔fondo** (¿`card` #FFFFFF se distingue de `band` #F7F6FC, las filas alternas? ¿`sunken` del `band`? no se mide); estado↔fondo; la legibilidad de `tintaSobre` sobre cada color de identidad (la insignia); la visibilidad del **hilo de identidad** sobre la superficie que tenga debajo (`card`/`band`/`sunken`); la distinción entre `edge`/`line`/`line-soft`.
- `sin-hex.check` decide "esto es un comentario" con una heurística de regex (`enComentario`): un `#hex` en una posición rara de una línea podría escaparse o marcarse mal. Escanea todo `src/` en cada corrida (no solo lo staged): un hex preexistente en cualquier sitio hace fallar cualquier commit de `.vue`/`.css`.
- No hay hook de `pre-push` ni CI: entre el commit local y `main` en GitHub no hay ninguna barrera adicional. `deploy.sh` no corre ningún checker antes de publicar.

---

## 5. Deuda, cabos sueltos y constantes escondidas

### TODO / FIXME / HACK
- No hay ni un `TODO`, `FIXME`, `HACK`, `XXX` en `src/`. (Los "pendiente/stub" que aparecen son texto descriptivo de comentarios, no marcadores de deuda.)

### Constantes escondidas (cableadas, ciertas solo en un caso)
- `reglas.js`: **`R = 0` está cableado dentro de `auditar()`**. Toda la ley R < D/2 descansa en ese literal, cierto solo mientras las barras sean relleno plano. En cuanto el Bloque 4 (o el motor) meta trama/anillo/alfa, ese 0 miente y nadie lo recalcula solo. Está comentado, pero es la misma forma que el 50 px del viejo. **La más peligrosa de la lista.**
- `useEje.js`: `DEFECTO_DESDE = 6*60`, `DEFECTO_HASTA = 30*60`. El día "va de 06:00 a 06:00" está cableado; un negocio con otra ventana lo rompería. Declarado y comentado, pero no es un token ni un dato configurable.
- `Celda.vue`: el hueco reservado usa `h-[15px]` + `mt-[9px]` — **números copiados a mano de la medición del viejo**. Si la tira real llega con otro alto, este hueco reservado queda mal y hay que rehacerlo. Comentado y documentado en ESTILO.md, pero es un literal en la plantilla.
- `FichaTurno.vue`: `h-4` (alto de pista = alto de barra, 16 px), `border-l-2` (hilo), `ml-[9px]`/`pl-[9px]` (sangría del hilo), `h-5 w-5` (insignia), tamaños `[13px]`/`[11px]`/`[9px]`. Ninguno es token; viven en la plantilla.
- `Parrilla.vue`: `9rem` (ancho del rail) y `11rem` (ancho mínimo de columna de día) cableados en `gridTemplateColumns`. (El nº de días y de columnas SÍ se deriva de `DIAS.length` — eso no es constante escondida.)
- El intervalo de rejilla **6 h** se repite como valor por defecto en `rejilla()` y `marcasHoras()` y se pasa a mano en `FichaTurno`. Tres sitios, un número.
- **NO reapareció** la constante escondida del viejo: la paleta se reparte por `colorDe(indice)` sobre 12 literales, sin ningún ancho fijo metido en el modelo. Esa deuda concreta no se heredó. (Hallazgo en positivo.)

### Copias a mano
- **`docs/ESTILO.md` lista a mano TODOS los valores hex** (identidad, semántica, marca, composición). Es una copia de `paleta.js`/`tokens.css`; si la fuente cambia, ESTILO.md deriva en silencio y **nada lo comprueba**.
- ESTILO.md y la bitácora llevan cifras de medición copiadas (D = 13,9, los pares ΔE, ratio 0,125, px). Son fotos fijas; si la paleta cambia, quedan viejas sin avisar.
- La traza de la entrada `08:00–960` cita `carriles` como fichero tocado, pero `carriles` se eliminó después. Deriva menor de la bitácora.

### Decisiones "de momento" no retocadas
- `FichaTurno.vue:46` usa **`truncate` en el nombre**. El viejo (`PersonLane.vue`) manda lo contrario: "el nombre NO se trunca, nunca; si no cabe, ENVUELVE". Es una divergencia de una ley del proyecto, metida sin querer, que **ningún dato actual expone** (todos los nombres son cortos).

### ¿Stub y hueco marcados como pendientes?
- `VistaConsulta.vue`: **inequívocamente marcado** — comentario "STUB RESERVADO. No es la vista real" y el propio texto en pantalla dice "llega en un bloque futuro, ábrela en un ordenador". Nadie lo tomaría por terminado.
- Hueco de cobertura: **marcado** — comentario extenso en `Celda.vue` + sección propia en ESTILO.md que dice que la tira funcional llega con el motor. Nadie lo tomaría por terminado.

### main / produccion
- `main`: 0 ficheros `dist/` (confirmado con `git ls-files`); `.gitignore` incluye `dist/`. Coherente.
- `produccion`: solo `.htaccess`, `assets/`, `index.html`. Último commit `deploy: 29c0a64`. Coherente con `main`.
- **No hay `.gitattributes`**: git avisa "LF will be replaced by CRLF" en cada fichero de cada commit. Riesgo de churn de fin de línea y de diffs ruidosos entre máquinas. Deuda menor pero real.

---

## 6. Los datos a fuego: ¿está sembrado el peor caso?

### Lo que SÍ está sembrado (`semana.js`, 13 turnos, 6 personas, 4 puestos, 7 días)
- Elena (Persona 05, `#C484FC`, el color de margen ΔE más ajustado del sistema) con **8 h y 1 h en la misma celda** (Barra·Lun): el estrecho junto al ancho, mismo color, para comparar el píxel.
- **Panadería a las 04:00** (Carlos, Cocina·Lun): antes del inicio del eje → ejercita el ensanche del `desde`.
- **Celdas vacías**: muchas (columna Dom entera, Barra·Mié, etc.).

### Lo que NO está sembrado (comprobado turno a turno)
- **Turno que cruza medianoche: NO existe.** 0 de 13 turnos tienen `fin ≤ inicio`. La rama `if (finMin <= iniMin) finMin += 24*60` de `normaliza()` **no la ejercita ningún dato** — código sin recorrer, sin test, que se activará con datos reales. El viejo lo tenía como caso propio; aquí desapareció.
- **Solape de dos: NO existe.** Los dos turnos de Elena (06:00–14:00 y 15:00–16:00) NO se solapan (hay hueco 14:00–15:00). Ninguna celda tiene dos turnos que se pisen.
- **Solape de tres: NO existe.**
- **Contención (un turno dentro de otro): NO existe.**
- **Persona con 3+ turnos en un día: NO existe** (el máximo es 2, Elena).
- **Nombre muy largo: NO existe.** Todos los nombres son cortos; nada expone el `truncate` de `FichaTurno`.
- **Los 12 colores de identidad a la vez: NO.** Solo se usan los índices 0–5 → 6 de 12 colores en pantalla. La mitad de la paleta nunca se ve junta.
- **Puesto sin nadie toda la semana: NO existe.** Los 4 puestos tienen gente algún día.
- **Turno que termina después de las 06:00 del día siguiente: NO existe.** No se ejercita el ensanche del `hasta` en `calcularEje`.

Para todos estos, hoy no hay ni dato ni test: **no hay nada que los sujete.**

---

## 7. Rendimiento: solo lo medido

### Medido (con cifra)
- Bundle del build `29c0a64`: `index.js` **107,78 kB** (gzip 41,57 kB); `index.css` **19,91 kB** (gzip 4,98 kB). 14 ficheros de fuente (tras el arreglo del subset latin). Tiempo de build ≈ 2 s.

### No medido (se declara "no medido", no se infiere)
- Tiempo de render de la parrilla: **no medido.**
- Nº de nodos del DOM: **no medido.**
- Coste de reflow al redimensionar / al cambiar de gestión a consulta: **no medido.**
- Memoria: **no medido.**
- No se propone ninguna optimización: no hay medición que la justifique.

---

## 8. Puntos ciegos de esta propia auditoría

- **La vista de consulta (móvil) no la he verificado renderizada.** En todas las capturas `useDispositivo` devolvió `esGestion = true` (Chromium headless a 1366). Nunca he visto pintarse `VistaConsulta` en un dispositivo de puntero grueso, ni he comprobado que el `matchMedia` conmute en el umbral. NO CONSTA que la rama móvil funcione.
- **Solo he medido a 1366×768.** Ningún otro ancho, ningún táctil real. El comportamiento del cajetín, las fichas y el hilo a otras resoluciones: NO CONSTA.
- **El sitio live lo verifiqué por cadenas, no por render.** Confirmé que el `index.html` del subdominio referencia el asset nuevo, que los assets dan 200 y que el JS contiene `min-h-16`/`border-dashed`. **No hice una captura del subdominio**: NO CONSTA que la página desplegada se vea correcta con el ojo.
- **Me fié de los checkers de color sin rederivar el ΔE a mano.** Confié en que `deltaE00` implementa CIEDE2000 bien; no lo validé contra valores de referencia conocidos.
- **La alineación de la tira/hueco solo la medí en la fila Barra.** Supuse que el `flex-1` alinea igual en Cocina/Caja/Sala; no lo medí celda a celda.
- **Revisé por encima `TableroEstilo.vue` y `Marca.vue`.** Solo confirmé que consumen el manifiesto/tokens; no audité su geometría ni su render.
- **Me fié del código y de la documentación en dos sitios sin ejecutarlos:** que la rejilla cae en horas redondas al ensancharse el eje (leído en `rejilla`/`marcasHoras`, no medido con el eje ensanchado); y que `useDispositivo` limpia su listener al desmontar (leído, no probado).
- **No auditté accesibilidad** (contraste tinta/superficie, foco, teclado): fuera del alcance que me di, pero es un hueco.

---

## CIERRE

> **Revisión 2026-07-23 (tras lectura del usuario).** Se corrige la priorización en tres puntos: #3 (`truncate`) baja a PUEDE ESPERAR (CSS que no toca el arrastre, sin nombres largos en los datos); #4 (`R=0`) baja a PUEDE ESPERAR con condición (sube a bloqueante si el arrastre toca el color de la barra); #15-live sube a ANTES DEL BLOQUE 4 (nadie ha mirado el subdominio con el ojo). La sección A se reordena en consecuencia.

### A) LAS 3 QUE MÁS ME PREOCUPAN

1. **No hay red de seguridad para el Bloque 4, y el Bloque 4 es justo el que mueve barras.** Cero tests, cero instrumentos de geometría vivos. El ratio 1/8, el color no falseado, el "0 texto en barra" y el "nada se recorta" se midieron una vez con scripts ya borrados. *Si no se toca:* el arrastre podrá falsear un ancho, meter texto en una barra o recortar un turno y **nada lo cazará** hasta que un humano abra la captura y lo vea — que es exactamente el modo de fallo que el proyecto dice combatir.
2. **La lógica temporal no tiene test y su caso más peligroso no está ni en los datos.** `normaliza()` (la del bug `08:00–960`) sigue sin prueba, y el cruce de medianoche es una rama de código que **ningún dato recorre**. *Si no se toca:* el arrastre generará turnos nuevos (uno que cruce medianoche, dos que se solapen) que caen en ramas jamás ejercitadas, sobre una función que ya demostró que sabe mentir en silencio.
3. **Nadie ha MIRADO el live.** Se desplegó y se confirmó que el `index.html` del subdominio cambió de hash, que los assets dan 200 y que el JS lleva las clases nuevas — pero **ningún ojo ha abierto turnia.antonioblanquez.es y visto la parrilla**. *Si no se toca:* lo desplegado podría verse roto (CSS que no carga, ruta que no resuelve, fuente que no aplica) y no lo sabríamos, porque confirmamos el hash, no el render. Es la capa 3 del agujero de las seis capas y cuesta un minuto.

### B) TABLA DE RUMBO

| # | Hallazgo | Propuesta | Porqué (si es ANTES) |
|---|---|---|---|
| 1 | 0 instrumentos de geometría vivos; todo lo medido se borró | **ANTES DEL BLOQUE 4** | El arrastre modifica geometría; sin un instrumento reejecutable (ratio, 0-texto, no-recorte) el bloque nace ciego. |
| 2 | `normaliza()` sin test; cruce de medianoche sin dato ni test | **ANTES DEL BLOQUE 4** | El arrastre produce turnos que pisan esa rama; hay que sembrarla y sujetarla antes de moverlos. |
| 3 | `truncate` en el nombre contradice "no truncar, envolver" | **ANTES DEL BLOQUE 4** | Se activa al sembrar el nombre largo en el punto 4 del 3.5; deja de ser aplazable en cuanto existe el dato que lo ejercita (un nombre truncado es una mentira dibujada). |
| 4 | `R = 0` cableado en `auditar()` | **PUEDE ESPERAR — salvo que el arrastre toque el color de la barra** | Si el arrastre añade cualquier canal de color a la barra (fantasma, resalte, sombra, alfa), R deja de ser 0 y esto sube a bloqueante en ese momento. |
| 5 | Cambio de solo-lógica en `.js` entra a main sin ninguna comprobación | **ANTES DEL BLOQUE 4** | `useArrastre.js` será `.js`: sin un test o guardia, su lógica entra a main sin red, como entró `useEje`. |
| 6 | Datos sin sembrar: solape (2/3), contención, 3+ turnos, nombre largo, 12 colores, puesto vacío, fin tras 06:00 | **ANTES DEL BLOQUE 4** (los de solape/medianoche/nombre largo) · **PUEDE ESPERAR** (12 colores, puesto vacío) | El arrastre crea solapes y turnos partidos: sin el dato, el peor caso solo lo sujetaría un test que nadie mira. |
| 7 | Fuentes 80→14 sin guardia (puede volver) | PUEDE ESPERAR | No lo toca el Bloque 4; una guardia de peso/import es barata cuando toque despliegue. |
| 8 | ESTILO.md copia a mano los hex; deriva en silencio | PUEDE ESPERAR | No bloquea el arrastre; conviene un checker que compare ESTILO.md con la fuente, no urgente. |
| 9 | `contraste.check` no vigila fondo↔fondo, tinta-insignia, ni hilo-sobre-fondo | PUEDE ESPERAR | La alternancia card/band y el hilo ya se vieron con el ojo; ampliar el checker es mejora, no urgencia. |
| 10 | Hook `commit-msg` saltable con `--no-verify`; `feat:` no exige bitácora | PUEDE ESPERAR | Es disciplina, no estructura; un `pre-push`/CI lo endurece cuando haya presupuesto. |
| 11 | Constantes de plantilla (15/9 px del hueco, 9rem/11rem, 6 h ×3) | PUEDE ESPERAR | No fallan hoy; conviene tokenizar antes de que se multipliquen. |
| 12 | `DEFECTO_DESDE/HASTA` (día 06→06) cableado | PUEDE ESPERAR | El prototipo asume una ventana; se vuelve deuda solo cuando haya negocios con otra. |
| 13 | Sin `.gitattributes` (churn LF/CRLF) | PUEDE ESPERAR | Molesto en los diffs, no rompe nada; un `.gitattributes` lo cierra en un commit. |
| 14 | Cajetín `h-full` y "commit adelantado" no llegaron a la bitácora | PUEDE ESPERAR | Registro histórico; anotarlos cierra la deuda de memoria, no afecta al código. |
| 15 | Live (subdominio) sin verificar con el ojo: nadie ha abierto turnia.antonioblanquez.es y mirado la parrilla | **ANTES DEL BLOQUE 4** | Solo se confirmó que el hash cambió, no que la página se vea; capa 3 del agujero de las seis capas, cuesta un minuto. |
| 15b | Vista consulta (móvil) sin verificar renderizada | PUEDE ESPERAR | Se construye en su bloque; su render se comprueba cuando exista. |
| 16 | Paleta por índice sin ancho oculto; stub y hueco bien marcados; main/produccion coherentes | **NO ES DEUDA** | Están bien; se listan para que conste que se miraron y se dieron por sanos. |
