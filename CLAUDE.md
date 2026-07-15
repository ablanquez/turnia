# TURNIA — reglas permanentes del proyecto

Gestor de cuadrantes de turnos. Prototipo **Vue 3 + Vite + Tailwind 4** (sin backend, datos a fuego).
Reinicio de la v1 (Laravel + Inertia + MySQL), archivada en el tag `archivo/v1-laravel` y la rama
`archivo/laravel-inertia`. Para navegarla: `git checkout archivo/v1-laravel`.

## Cómo se trabaja
- **Diseñar primero.** Enseñar el plan, esperar OK, ir por BLOQUES con puntos de control. No arrancar código sin aprobación.
- **El ejecutor DISCUTE el diseño, no lo obedece.** Si ve una debilidad en lo pedido, la señala y pregunta antes de hacerlo.
- **El usuario prueba con las manos.** Ninguna tanda se cierra sin que abra la página y la use. Ningún test mide "se entiende".
- **En español**, siempre.

## La fuente manda
- Ante discrepancia entre lo que el usuario dijo **de memoria** y lo que dice **la fuente** (código, literal, captura), **gana la fuente** — y se anota por qué. La retrospectiva miente, también la del usuario.

## Cero ñapas
- Al modo idiomático del stack. No forzar otro modo dentro de una herramienta que ya tiene el suyo.
- Ante la duda, preguntar antes de improvisar.

## Se heredan las decisiones, no el código
- Del Turnia viejo se reutiliza el **APRENDIZAJE** (qué funcionó, qué falló y por qué); el código se **REESCRIBE limpio**. Nunca se clona verbatim ni se le arrancan trozos.
- **Por qué:** este reinicio existe porque el viejo arrastró deuda de un orden equivocado. Clonar el código de una parte que dio guerra mete esa deuda por la puerta de atrás el primer día, y operar código enredado para quitarle lo que sobra siempre deja un cable colgando que reaparece tres tandas después. Destilar el aprendizaje cuesta un poco más y es lo único que hace el proyecto nuevo de verdad nuevo, y no el viejo con ropa de Vue.
- **Cómo:** se lee el viejo para ENTENDER la decisión y se reescribe desde cero con ese conocimiento. Vale para todo lo que venga del viejo (el arrastre ahora; el motor, la matriz, el candado después).
- **Única excepción:** los LITERALES que ya son la fuente de verdad y no tienen lógica que reescribir (valores de color, hex, el SVG del logo). Esos se heredan tal cual.

## Color (es INFORMACIÓN, no decoración)
- Cuatro familias que NO se mezclan: **identidad · semántica · marca · composición**.
- Todo color pasa por su fuente única (`src/estilo/tokens.css` / `src/datos/paleta.js`). Ningún `#hex` ni `rgb()` suelto en un `.vue`.
- Añadir un color obliga a: (a) meterlo en su fuente, (b) que `contraste.check` pase (ΔE 24 estados / 8 marca-fondos, R < D/2), (c) que salga en el tablero `/estilo`.

## Verificación
- **Abrir la página y mirarla con los ojos** antes de dar nada por bueno.
- **Backtesting cebado:** intentar ROMPER, no confirmar. Si nada se rompe al primer intento, sospechar del test.
- **Verificar el estado real** (disco, consola del navegador) — y mirar la pantalla, no solo el estado.
- **Medir el píxel resultante, no el declarado.**

## Bitácora (docs/BITACORA.md) — la memoria de los fallos
- **Todo fallo cazado → una entrada, antes de cerrar el `fix:`.** El hook `commit-msg` lo verifica y autogenera el esqueleto si falta.
- **El ⭐ ("qué dio verde mientras el fallo vivía") se captura AL DESCUBRIR, antes de arreglar.** Es el dato perecedero: la retrospectiva lo pierde.
- **`NO CONSTA` es honesto y válido; nunca se inventa.** En esta fase (sin motor ni tests) el ⭐ casi siempre será `NO CONSTA`, sin paja.
- Una entrada por fallo. No fusionar, no suavizar.

## Multidispositivo
- **Capacidad, no "encoger".** PC gestiona (arrastra); móvil consulta (vista propia, sin arrastre). Son vistas distintas sobre los mismos datos.
- **Nunca cablear un ancho.** Los breakpoints son tokens, en un solo sitio.

## Git y despliegue
- **`git diff` antes de cada push** — que no se cuele nada.
- **Push al cerrar cada BLOQUE.** El repo es parte del entregable, y el deploy lo publica.
- **Nunca `dist/` en `main`:** lo compilado vive en la rama `produccion` (ver `deploy.sh`).
- Conventional Commits en español. Sin coautorías ni mención de herramientas.
