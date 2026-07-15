# TURNIA — PLAN FINAL ÚNICO de arranque del prototipo

> Reinicio de TURNIA: lo mínimo funcionando perfecto (la parrilla se ve y las barras se arrastran),
> con cimientos firmes desde el commit 0 — sistema de diseño, bitácora, reglas y despliegue vivo.
> El Laravel viejo se archiva; no se pierde nada.
>
> **Estado:** pendiente del OK del usuario. Nada tocado. Fecha: 2026-07-15.
> **Regla que gobierna todo:** cero ñapas, al modo idiomático de Vue 3 + Vite + Tailwind 4.

---

## Decisiones cerradas (del usuario)

- **Stack:** Vue 3 + Vite + Tailwind 4, solo front, datos a fuego. Sin backend, login ni BD.
- **GitHub:** el repo `github.com/ablanquez/turnia` PASA A SER el nuevo (Vue). El viejo se archiva en tag + rama. `main` se reescribe **solo después** de verificar el archivo en GitHub.
- **Despliegue:** patrón Linaje (Claude Code → GitHub → Hostinger vía cron `git pull`), resuelto para Vue+Vite (ver §Despliegue). Destino: `turnia.antonioblanquez.es`.
- **Multidispositivo:** *seam* desde el día 0 (capability + breakpoints-token + router reservado). Ahora solo se construye la parrilla PC.
- **Discrepancias de color:** **manda el literal de la fuente** (la memoria del usuario estaba mal). Regla general nueva en `CLAUDE.md`.
- **`referencia/`:** sí, de solo lectura, para arqueología.
- **Prueba de aceptación visual:** el viejo aún corre en `turnia.test` → el tablero se compara **píxel a píxel** contra él.

---

## Despliegue — Vue+Vite en un Hostinger sin Node (resolución)

**Problema:** Linaje era PHP (git pull y corre). Vue+Vite hay que **compilarlo** (`npm run build` → `dist/`), y Hostinger no tiene Node.

**Propuesta: rama `produccion` con solo lo compilado; Claude Code compila en local; Hostinger hace `git pull`.**

| Vía | Veredicto |
|---|---|
| **Rama `produccion` (solo `dist/`), build local, cron `git pull`** ⭐ | **Elegida.** `main` queda solo-fuente y revisable; el host sigue sin Node (idéntico a Linaje); artefactos versionados y con *rollback*, fuera de la historia de fuente. |
| `dist/` versionado en `main`, cron `git pull` | Descartada: cada commit arrastra el diff del *bundle* minificado y **rompe el ritual de `git diff` antes de push**; mezcla fuente y artefacto (ñapa). |
| GitHub Actions → FTP | Descartada: se aleja del patrón Linaje (cron pull en el host) que el usuario quiere. |

**Mecanismo (repo-side, lo hago yo):**
- `deploy.sh`: un `git worktree` fijado a la rama `produccion`; `npm run build` → copia `dist/*` a la raíz del *worktree* → commit `deploy: <sha de main>` → `git push origin produccion`.
- `public/.htaccess` con **fallback SPA** (Hostinger es Apache): toda ruta → `index.html`, para que `/estilo` funcione al recargar en producción. Viaja dentro de `produccion`.
- `dist/` y `node_modules/` van en `.gitignore` de `main`.

**Mecanismo (host-side, lo haces tú una vez, como en Linaje):**
- Crear el subdominio `turnia.antonioblanquez.es`.
- `git clone -b produccion …` en su *docroot*.
- Cron: `*/N * * * * cd <docroot> && git pull --ff-only`.

**Resultado:** cada tanda → `deploy.sh` → el cron lo publica. Visible en producción **desde el primer commit**.

---

## Las CUATRO familias de color (literales de la fuente — no se mezclan)

Recogidas tal cual del viejo (detalle completo en `ARRANQUE-PROTOTIPO.md`). Se cristalizan en el sistema de diseño el día 0.

**1 · IDENTIDAD — 12 colores de persona** (`PersonPalette.php`), por índice, ΔE00 mín 16,1, croma ≥ 30, **L\* 31→78** (literal de fuente):
```
#2490B4 #085C88 #54588C #7C7CB0 #C484FC #A830A4
#44BCFC #789CFC #4068E8 #905CDC #64249C #F45CC8
```

**2 · SEMÁNTICA — gravedades + cobertura** (relleno ≠ tinta):

| | relleno | tinta |
|---|---|---|
| Imposible (rojo) | `#C81E1E` | `#B01414` |
| Incumplimiento (naranja) | `#E8590C` | `#A8410A` |
| Aviso (ámbar) | `#C2870A` | `#7D5606` |
| Correcto (verde) | `#15803D` | `#0F5C2C` |

Cobertura: correcto `#C3E6D1`/borde `#15803D` · falta `#F7C9C9`/`#DC2626` · exceso `#EFE0C0`/`#C2870A` · **sin candidato = gris rayado `#D7D4E2`** · **incubrible = rojo rayado** (dos cosas distintas: gana la fuente).

**3 · MARCA + logo índigo** (`app.css`, `AppLayout.vue`): brand-50 `#EEEDFE` · 300 `#7F77DD` · 600 `#534AB7` · 800 `#3C3489`. Logo = anillo discontinuo `#7F77DD` + punto `#534AB7` + wordmark **TURNIA** en `brand-800`. Se hereda literal.

**4 · COMPOSICIÓN — la página:** superficies (page `#E4E2EC` · panel `#ECEAF4` · card `#FFF` · rail `#F1F0F7` · band `#F7F6FC` · sunken `#E7E5F0`); líneas (edge `#C3BFD6` 2px sección > line `#DDDBE9` 1px día > line-soft `#EEECF4` pelo); tinta (ink `#2C2643` · soft `#5F5D70` · faint `#8F8DA0`); fuentes IBM Plex Sans + Mono.

**Reglas de separación (van a `reglas.js` + `ESTILO.md`):**
- **R < D/2** (D = ΔE mín entre personas; R = lo más que una barra se aleja de su color con trama/anillo/alfa).
- **Dos umbrales:** ESTADOS (gravedades + 4 tramos cobertura) → **ΔE 24**; FONDOS + MARCA → **ΔE 8** (el 20 fue piso inicial, superado por el corolario).
- Ley 2 (el relleno dice de quién es, medido en el píxel), Ley 4 (la trama = sombra de la persona, L\*−22), relleno ≠ tinta (≥ 4,5 de contraste).

---

## Estructura de carpetas nueva

```
002_TURNIA-PROTO/                (carpeta hermana LOCAL · su propio .git → origin turnia)
├── .githooks/commit-msg         # bitácora: autostub + bloqueo; corre contraste.check si toca color
├── .gitignore                   # /docs/*.md + !BITACORA.md + !ESTILO.md + !PLAN-ARRANQUE.md; dist/; node_modules/
├── CLAUDE.md                    # reglas permanentes (se leen cada sesión)
├── README.md                    # deja claro el reinicio y cómo llegar al archivo viejo
├── deploy.sh                    # build local → rama produccion → push (cron de Hostinger lo pulla)
├── index.html · package.json · vite.config.js
├── public/.htaccess             # fallback SPA (Apache/Hostinger)
├── docs/
│   ├── BITACORA.md              # nace con la entrada nº1 (decisión de arranque)
│   ├── ESTILO.md                # la ley del color: 4 familias, umbrales, R<D/2 (literales)
│   └── PLAN-ARRANQUE.md         # este documento
├── src/
│   ├── main.js · App.vue · router.js   # router reserva el slot de VistaConsulta (móvil)
│   ├── estilo/
│   │   ├── tokens.css           # @theme: semántica + marca + composición (fuente única fija)
│   │   ├── reglas.js            # umbrales ΔE + R<D/2 + croma + L* (una sola vez)
│   │   ├── contraste.check.mjs  # el verificador (destila semanticos.mjs, reescrito limpio)
│   │   └── marca/{logo.svg, Marca.vue}
│   ├── datos/{semana.js, paleta.js}     # identidad = datos, por índice
│   ├── composables/{useArrastre.js, useEje.js, useDispositivo.js}
│   └── components/{Parrilla.vue, Celda.vue, Barra.vue, TableroEstilo.vue}
└── referencia/                  # SOLO LECTURA: docs viejos, TURNIA-ESTADO.md, ficheros visuales
```

`produccion` es una rama aparte (solo estáticos); no aparece en este árbol.

---

## `CLAUDE.md` — reglas permanentes (se leen cada sesión, automáticamente)

```markdown
# TURNIA — reglas permanentes del proyecto

Gestor de cuadrantes. Prototipo Vue 3 + Vite + Tailwind 4 (sin backend, datos a fuego).
Reinicio de la v1 (Laravel), archivada en el tag `archivo/v1-laravel`.

## Cómo se trabaja
- Diseñar primero. Enseñar el plan, esperar OK, ir por BLOQUES con puntos de control.
- El ejecutor DISCUTE el diseño, no lo obedece: si ve una debilidad, la señala y pregunta.
- El usuario prueba con las manos. Ninguna tanda se cierra sin que abra la página. Ningún test mide "se entiende".
- En español.

## La fuente manda
- Ante discrepancia entre lo que el usuario dijo DE MEMORIA y lo que dice LA FUENTE (código,
  literal, captura), GANA LA FUENTE — y se anota por qué. La retrospectiva miente, también la del usuario.

## Cero ñapas
- Al modo idiomático del stack. No forzar otro modo dentro de una herramienta que ya tiene el suyo.
- Ante la duda, preguntar antes de improvisar.

## Se heredan las decisiones, no el código
- Del Turnia viejo se reutiliza el APRENDIZAJE (qué funcionó, qué falló y por qué); el código se
  REESCRIBE limpio. Nunca se clona verbatim ni se le arrancan trozos.
- Por qué: este reinicio existe porque el viejo arrastró deuda de un orden equivocado. Clonar el
  código de una parte que dio guerra mete esa deuda por la puerta de atrás el primer día, y operar
  código enredado para quitarle lo que sobra siempre deja un cable colgando que reaparece tres
  tandas después. Destilar el aprendizaje cuesta un poco más y es lo único que hace el proyecto
  nuevo de verdad nuevo, y no el viejo con ropa de Vue.
- Cómo: se lee el viejo para ENTENDER la decisión (p. ej. "Pointer Events, cero dependencias,
  umbral de ~5px para separar clic de arrastre") y se reescribe desde cero con ese conocimiento.
  Vale para todo lo que venga del viejo: el arrastre ahora; el motor, la matriz, el candado después.
- Única excepción: los LITERALES que ya son la fuente de verdad y no tienen lógica que reescribir
  (valores de color, hex, el SVG del logo). Esos se heredan tal cual.

## Color (es INFORMACIÓN, no decoración)
- Cuatro familias que NO se mezclan: identidad · semántica · marca · composición.
- Todo color pasa por su fuente única (tokens.css / paleta.js). Ningún #hex ni rgb() suelto en un .vue.
- Añadir un color obliga a: (a) meterlo en su fuente, (b) que contraste.check pase (ΔE 24 estados /
  8 marca-fondos, R<D/2), (c) que salga en el tablero /estilo.

## Verificación
- Abrir la página y mirarla con los ojos antes de dar nada por bueno.
- Backtesting cebado: intentar ROMPER, no confirmar. Si nada se rompe al primer intento, sospechar del test.
- Verificar el estado real (disco, consola del navegador) — y mirar la pantalla, no solo el estado.
- Medir el píxel resultante, no el declarado.

## Bitácora (docs/BITACORA.md)
- Todo fallo cazado → una entrada, antes de cerrar el `fix:`. El hook la verifica y autogenera el esqueleto.
- El ⭐ ("qué dio verde mientras el fallo vivía") se captura AL DESCUBRIR, antes de arreglar.
- NO CONSTA es honesto y válido; nunca se inventa. En esta fase el ⭐ casi siempre será NO CONSTA, sin paja.

## Multidispositivo
- Capacidad, no "encoger". PC gestiona (arrastra); móvil consulta (vista propia, sin arrastre).
- Nunca cablear un ancho. Los breakpoints son tokens, en un solo sitio.

## Git y despliegue
- `git diff` antes de cada push — que no se cuele nada.
- Push al cerrar cada BLOQUE; el repo es parte del entregable, y el deploy lo publica.
- Nunca `dist/` en `main`: lo compilado vive en la rama `produccion`.
- Conventional Commits en español. Sin coautorías ni mención de herramientas.
```

---

## La bitácora y su hook (nacen en el Bloque 1)

- **Formato** (9 campos, orden de Linaje): `## [fecha] — título` · Categoría · Síntoma · **Qué se probó y DIO VERDE mientras el fallo estaba vivo (⭐)** · Causa raíz · Cómo se cazó · Arreglo aplicado · **Commit** · Ley que sale de aquí · Traza.
- **Categorías** (cerradas): carencia · visual · datos · rompe · seguridad · aviso falso · silencio falso · despliegue. (Las dos "falso" dormidas hasta que haya motor.)
- **`NO CONSTA`** = valor honesto; se distingue el hueco añadiendo el motivo.
- **Hook `.githooks/commit-msg`** (`core.hooksPath .githooks`): si el mensaje es `fix:` y no hay entrada en el *stage* → **autogenera el stub** (todo `NO CONSTA`, `Commit: (este commit)`), lo añade al *stage* y aborta con aviso. Segundo intento: pasa. Y **corre `contraste.check`** si el commit toca `paleta.js`/`tokens.css`.
- **Entrada nº1** = la decisión de arranque (stack + archivado). La bitácora nace poblada.

---

# LOS BLOQUES (con puntos de control)

## ⭐ BLOQUE 0 — Archivar y ASEGURAR el viejo *(lo primero al dar el OK)*
1. En el repo viejo (`002_TURNIA`):
   ```
   git tag -a archivo/v1-laravel -m "Turnia v1: Laravel+Inertia+Vue+MySQL, archivado al reiniciar"
   git branch archivo/laravel-inertia            # sobre 1b20120
   git push origin archivo/v1-laravel
   git push origin archivo/laravel-inertia
   ```
2. Verificación por terminal:
   ```
   git ls-remote --tags  origin archivo/v1-laravel
   git ls-remote --heads origin archivo/laravel-inertia
   ```
3. 🛑 **PUNTO DE CONTROL — TÚ CONFIRMAS EN GITHUB.** Abres `github.com/ablanquez/turnia` (pestañas *tags* y *branches*) y ves el tag y la rama con el commit `1b20120`. **Hasta que no digas "el viejo está a salvo", `main` NO se toca.** Primero la red de seguridad, después nada.

## BLOQUE 1 — Nacimiento del proyecto + reescritura de `main`
1. Carpeta hermana `002_TURNIA-PROTO`, `git init`. Andamiaje Vue 3 + Vite + Tailwind 4.
2. Infra de método: `docs/BITACORA.md` (preámbulo + entrada nº1), `.gitignore`, `.githooks/commit-msg` + `core.hooksPath`, `CLAUDE.md`, `README.md`, `referencia/` (solo lectura), `deploy.sh` + `public/.htaccess`.
3. Primer commit (incluye ya bitácora, reglas y pipeline de deploy).
4. ⚠️ **REESCRITURA DE `main`** (solo tras el 🛑 del Bloque 0):
   ```
   git remote add origin https://github.com/ablanquez/turnia.git
   git fetch origin
   git push --force-with-lease origin main
   ```
5. Primer `deploy.sh` → rama `produccion`. (Tú, una vez: subdominio + clone de `produccion` + cron en Hostinger.)
6. 🛑 **PUNTO DE CONTROL:** en GitHub, `main` es Vue y el tag/rama de archivo **siguen ahí**. Y probamos el hook (un `fix:` de mentira sin entrada → genera el stub y bloquea). Y `turnia.antonioblanquez.es` sirve el andamiaje.

## BLOQUE 2 — Sistema de diseño vivo (tablero `/estilo`)
1. `tokens.css` (@theme: semántica + marca + composición, literales), `paleta.js` (12 identidad por índice), `reglas.js` (ΔE 24/8, R<D/2, croma 30, L\*), `contraste.check.mjs`, `docs/ESTILO.md`, `Marca.vue` + `logo.svg`.
2. Ruta `/estilo` (`TableroEstilo.vue`): las **4 familias juntas**, leídas de la fuente; **mide la ley** (D, R<D/2, distancia a semánticos ≥24 y a marca ≥8) y saca **banda roja** si algo colisiona.
3. Gobernanza: check anti-`#hex`-suelto; `contraste.check` en verde.
4. 🛑 **PUNTO DE CONTROL:** abres `/estilo` (producción y local) y ves las 4 familias separadas. **Prueba de aceptación:** comparo el tablero **píxel a píxel contra `turnia.test`** (el viejo). Backtesting cebado: meto un color colisionante y confirmo que salta la banda **y** el checker.

## BLOQUE 3 — La parrilla estática (PC)
1. `datos/semana.js` (personas, puestos, turnos a fuego). `useEje.js` (eje 06→06).
2. `Parrilla.vue` + `Celda.vue` + `Barra.vue`: rejilla días×puestos, barras posicionadas por hora, rótulos (nombre + horas), color de persona por índice. Bebe de los tokens.
3. **Seam multidispositivo:** `useDispositivo.js` (capacidad, no ancho mágico), breakpoints como tokens, `router.js` con el slot reservado para `VistaConsulta` (móvil). Solo se construye la vista PC.
4. 🛑 **PUNTO DE CONTROL:** abres la parrilla (producción y local), poblada, y la comparas con `turnia.test`. Se ve bien.

## BLOQUE 4 — El arrastre
1. `useArrastre.js` **reescrito limpio** destilando la decisión del viejo (Pointer Events, cero dependencias, umbral ~5px para separar clic de arrastre). **No se clona ni se le arrancan trozos.** Nace pequeño y sin historia: coger una barra, mover el fantasma, resaltar la celda destino, soltar y que se quede. **Sin motor, sin previsualización de servidor, sin candado — nada de eso existe todavía.**
2. 🛑 **PUNTO DE CONTROL:** **arrastras tú con las manos**, con la consola abierta, antes de dar nada por bueno.

**Cierre de cada bloque:** `git diff` → commit(s) (entrada de bitácora si hubo `fix:`) → push → `deploy.sh`.

---

## Decisiones pendientes: ninguna. Falta solo tu **OK** para ejecutar el Bloque 0.
```
