# TURNIA — Documento de estado del proyecto

> **Proyecto 002.** Gestor de turnos y horarios de empresa.
> Segunda pieza del portfolio, tras Linaje (001).
>
> Este documento es la **memoria persistente** del proyecto (la conversación es volátil;
> el archivo perdura). Se actualiza al cerrar cada tanda.

**Estado actual:** Fase 0 — Concepción. Sin código.
**Última actualización:** sesión de concepción inicial.

---

## 1. Identidad

**Nombre: Turnia**
- Inventado → dominio y marca libres, sin competencia en buscadores.
- Se entiende solo, sin explicación (a diferencia de alternativas más poéticas descartadas:
  Vela, Vigilia, Posta, Tornada).
- Hace familia con Linaje sin forzar: una palabra, castellana, femenina, con cuerpo.

**Identidad visual:** propia y completa (logo, color, coherencia).
- **Criterio:** en portfolio, cada proyecto se defiende solo. Un reclutador que mira Turnia
  está mirando *un proyecto*, no "la pieza 2 de una suite".
- La "suite de aplicaciones" es **narrativa que se cuenta al final**, no arquitectura que
  condicione las decisiones de ahora.

**Color de marca: ÍNDIGO** (`#7F77DD` / oscuro `#534AB7` / texto `#3C3489` / fondo `#EEEDFE`)
- **Por qué índigo y no ámbar/verde:** la parrilla necesita **rojo = incumplimiento**,
  **ámbar = aviso**, **verde = correcto**. Si la marca fuese ámbar o verde, **competiría con la
  semántica de estado**. El índigo deja esos colores libres para comunicar información.
- Sobrio, técnico, profesional — encaja con un producto de gestión.
- Convive con el **teal de Linaje** sin competir (aire de familia, acento propio).

**Símbolo:** círculo de segmentos con núcleo — el **ciclo del turno**, el reparto del tiempo que
gira. Geométrico, limpio, minimal (mismo ADN que el árbol de nodos de Linaje).

**PENDIENTE:** afinar logo definitivo, favicon, versión centralizada *(Fase 5)*. Lo que hay ahora
es un **logo mínimo viable** suficiente para que el README del repo no nazca desnudo.

---

## 2. Qué es

Gestor de turnos y horarios de empresa.

**Ambición de completo, ejecución por hitos.** Base troncal sólida primero, mejoras en vivo
después. Método Linaje: *"publicar cuando lo troncal es sólido y mejorar en vivo"*.

**Formato:** aplicación web.
- App móvil como **posible correlación futura**, no compromiso.
- Lógica natural del dominio: **web para el que gestiona** el cuadrante (encargado, en
  ordenador), **móvil para el que consulta** su turno (empleado, sobre la marcha).
- El **saliente hacia la app se talla ahora** (API desde el diseño); la pieza se esculpe si toca.

**Por qué este dominio:** dolor real y mal resuelto (el encargado cuadrando turnos a mano en
Excel cada semana, peleando con descansos, vacaciones, preferencias y cobertura mínima),
menos competencia que reservas, y es donde la IA puede brillar de verdad (optimización con
restricciones).

---

## 3. Stack — Laravel + MySQL

**Cambio respecto a Linaje (PHP vanilla), y justificado:**

- **El dominio lo pide.** Turnia necesita usuarios, roles, permisos, API y migraciones —
  que es exactamente lo que Laravel da hecho. En vanilla habría que picar todo eso a mano,
  y no es donde está el valor del proyecto. **Las tandas dejan de gastarse en fontanería y
  se gastan en la lógica de turnos**, que es lo que hace único a Turnia y donde se demuestra
  el talento.

- **Mejor retorno de empleabilidad por unidad de esfuerzo.** Mismo lenguaje que ya se domina
  (PHP), sin gastar ninguno de los 5 slots de Node de Hostinger, sin cambiar de hosting —
  pero se salta de "sé PHP" a **"sé Laravel"**, que es la casilla que las ofertas piden por
  nombre. Es el escalón más barato que se puede subir.

- **No rompe la constancia.** Es un estiramiento, no un salto al vacío. La guía de despliegue
  sigue siendo casi entera válida: **el symlink a `public/` que ya está documentado ES el
  patrón nativo de Laravel.** Medio camino andado sin saberlo.

**Frontend:** librería JS potente para la parrilla del cuadrante (el equivalente al D3/family-chart
de Linaje). Un cuadrante es una interfaz con mucho estado — arrastrar turnos, recalcular al vuelo,
filtrar por semana/empleado — y eso pide JavaScript de verdad.

**Composer** para dependencias (ya disponible en Hostinger).

---

## 4. Arquitectura

### Permisos: desde el diseño, no como parche
Roles naturales del dominio:
- **Admin / dueño** — gestiona la empresa, da de alta empleados.
- **Encargado** — crea y publica cuadrantes, aprueba vacaciones, ve todo.
- **Empleado** — consulta su turno, pide vacaciones, propone cambios.

> El mismo cuadrante **se ve distinto según quién mire**: el encargado ve la parrilla entera;
> el empleado ve sus turnos destacados. Misma pieza, dos caras.

Conecta con la guía: *"estados y roles coherentes: qué puede hacer cada tipo de usuario en cada estado"*.

### Instalación: presente en el diseño, capada en la demo
**No autoinstalable de inicio** (un instalador no aporta nada a la demo del portfolio: la demo
es una URL pública donde el reclutador entra y prueba, no hay nada que instalar).

**Pero desde el día uno, con el saliente tallado:**
- Config separada del código, fuera del repo (patrón Linaje: `config` real en servidor, en
  `.gitignore`, permisos 600).
- **Nada de datos quemados**: nombre de empresa, turnos existentes, roles, horarios base →
  todo configurable. Una app que solo sirve para "Peluquería Pepe" es un juguete.
- **Multi-empresa contemplado en el modelo de datos**, aunque la demo enseñe solo una.

Así el instalador es luego **un hito pequeño, no una cirugía**.

---

## 5. Método de trabajo

**Mismo método de dos instancias.** La persona hace de **enrutador**: Claude (chat) para visión,
estrategia y preparación de prompts; Claude Code para ejecución. Tandas con aprobación entre cada
paso.

**Lo que cambia a mejor con Laravel:** en vanilla, "sistema de login con roles" era una tanda
entera (diseñar tablas, picar registro, cifrar contraseñas, sesiones, control de acceso, y luego
auditarlo en el megabloque de seguridad). Con Laravel es un comando y una configuración.
**Las tandas rinden mucho más.**

### Coletilla obligatoria en TODOS los prompts a Claude Code

> **"Cero ñapas. Haz las cosas al modo Laravel. No fuerces otro modo distinto dentro.
> Cíñete a cómo funciona el sistema Laravel."**

**Por qué importa:** un framework mal usado —peleándose contra sus convenciones, haciendo las
cosas "a la vanilla" dentro de Laravel— es peor que no usarlo.

> 📌 **Para la guía de buenas prácticas:** al usar un framework, la ñapa no es solo improvisar —
> **es hacer las cosas a tu manera dentro de una herramienta que ya tiene la suya.** Es la
> versión "framework" del cero ñapas.

### Laragon (desarrollo local en Windows)
Monta Apache/Nginx + PHP + MySQL + Composer en el PC. Se lleva de maravilla con Laravel.

**Por qué cambia el método a mejor:**
- **Se ve cada cambio al instante** en el navegador local, sin ciclo de despliegue. El enrutador
  prueba con las manos en caliente.
- **Separa los dos mundos como debe ser:** se rompe en local sin miedo; a Hostinger solo llega
  lo aprobado.

---

## 5 bis. MODELO DE DOMINIO ⭐ (el corazón del proyecto)

### El hallazgo central: **el motor NO tiene sector**

No hay tabla "tipo de negocio". No hay reglas de hostelería ni de sanidad cableadas. Solo hay
**puestos, franjas, empleados, perfiles y elegibilidad**. El sector es únicamente el nombre que
le pone quien configura.

> **Test superado:** *"Me da igual que sea un bar, que una granja de pollos, que un burdel —
> porque es configurable al 100%."*

**Consecuencia:** el motor aguanta cualquier sector **porque nunca supo qué era un bar.** Se
modeló el dominio, no los casos. Es la diferencia entre un juguete y un producto — y es
exactamente lo que un ingeniero valora al mirar el código.

### Turnia NO modela convenios. Modela parámetros.
El convenio (estatal, de empresa, o el pacto individual con Juan) es solo **la fuente de donde
salen los números** que alguien configura. Turnia no sabe qué es el Estatuto de los Trabajadores
ni el Estatuto Marco. Solo sabe que esta persona tiene un tope de horas, unos turnos posibles,
un descanso mínimo y un tipo de jornada. Y los **valida**.

*Validado en la investigación:* el descanso mínimo entre jornadas son 12h por Estatuto de los
Trabajadores, pero el régimen sanitario tiene otras cifras; y el límite de guardia médica está
pasando de 24h a 17h justo ahora (nuevo Estatuto Marco, anteproyecto aprobado jun-2026). **Si se
hubieran cableado los números, la app nacería obsoleta.** Reglas configurables = necesidad real
demostrada, no buena práctica abstracta.

### Las entidades

| Entidad | Qué es |
|---|---|
| **Empresario** | Puede tener varias empresas |
| **Empresa** | Puede tener varios **calendarios** (p.ej. fijos, refuerzo de vacaciones) |
| **Perfil** | Conjunto de **condiciones/límites**: horas anuales, descanso mínimo entre turnos, máx. horas por turno, tipo de jornada (continua/partida)… La empresa configura N perfiles. |
| **Empleado** | Tiene **un perfil** asignado |
| **Puesto** | Existe en el catálogo del negocio (barra, cocina, caja, almacén…). **Lleva los requisitos** que hay que cumplir para cubrirlo. |
| **Calendario** | La parrilla. Define **qué puestos hacen falta, en qué franja, cuántos**. |
| **Asignación** | Un empleado colocado en un hueco concreto del calendario |

### Las dos relaciones muchos-a-muchos (no confundir)
1. **Empleado ←→ Puesto** = *elegibilidad/cualificación*. "María puede cubrir caja, almacén y
   reposición." Es **capacidad, no asignación**: permite que la misma persona rote entre puestos
   según la semana.
2. **Empleado ←→ Calendario** = qué empleados juegan en qué calendario.

### Las dos validaciones INDEPENDIENTES (ambas deben pasar)
- **Perfil** → dice **cuánto** puede trabajar (límites: horas, descansos, jornada).
- **Puesto** → dice **qué** hace falta para cubrirlo (cualificación).

> Un empleado puede tener el perfil correcto (le caben las horas) y aun así **no poder cubrir ese
> puesto** por falta de cualificación. Y al revés.

### La necesidad es TEMPORAL, no estructural
El bar no "tiene 3 puestos de barra". Tiene **3 en agosto y 1 en febrero**.
- **Puesto como catálogo** (permanente) → es lo que se cruza con los empleados.
- **Puesto como necesidad en el calendario** (temporal) → cuántos hacen falta *ahora*.

Los puestos se añaden al calendario con granularidad variable: **semanal, mensual, anual o custom**.
→ Gratis: **el hueco no cubierto es visible**. Si necesitas 3 de barra y colocas 2, se ve el agujero.
→ Abre la puerta (hito futuro) a **plantillas de semana**: "semana tipo temporada alta" vs "baja".

---

### ⏱️ LO QUE OCUPA EL TIEMPO DE UN EMPLEADO — tres cosas, no una

No todo el tiempo del empleado son asignaciones a puestos. Hay **tres tipos de bloque**, y los
tres se pintan en el calendario y los tres entran en el cómputo (cada uno a su manera):

| Tipo | Qué es | Granularidad |
|---|---|---|
| **1. Asignación** | Está cubriendo un puesto | **Franja horaria** dentro de un día |
| **2. Concepto horario** | Ocupa horas pero no cubre puesto: hora médica, permiso retribuido, permiso sin sueldo, **hora extra** | **Franja horaria** dentro de un día |
| **3. Ausencia por rango** | Bloquea días enteros: **baja laboral**, vacaciones, permisos largos (maternidad/paternidad) | **Rango de días** |

**La distinción clave: "ocupa horas" vs "ocupa días".**

#### El comportamiento va en la tabla, NO en el código
Cada concepto/ausencia lleva un campo de **cómo computa**:
- **Suma al contador** (cuenta como trabajado): hora médica, permiso retribuido, formación…
- **No suma; reduce la jornada exigible**: permiso sin sueldo, huelga…
- **Suma a un contador aparte** (con su propio tope): **hora extra**
- **Bloquea disponibilidad sin computar**: vacaciones, baja…

> **Turnia no sabe qué es una hora médica.** Sabe que hay un concepto que *suma al contador*.
> El nombre y el catálogo los pone la empresa. **El motor conoce comportamientos, no casos.**
> (Mismo principio que con los convenios.)

#### El caso especial: la BAJA LABORAL
No es "un concepto más de la lista". Se comporta distinto a todo:
- Duración **indefinida** al inicio · **rango de días**, no franja · **sobrevenida** (te enteras el
  mismo día) · **bloquea al empleado por completo**.
- **Y lo peor: el cuadrante ya está hecho y publicado.** Los turnos asignados de esa persona
  **se quedan huérfanos**.

Turnia debe, como mínimo: marcar no disponible desde la fecha → **liberar sus asignaciones futuras**
→ **mostrar los huecos que quedan al descubierto** para recubrirlos.

> 💎 **Oro para la demo:** *"María se pone de baja → mira cómo el sistema te enseña los tres turnos
> que se quedan sin cubrir."*

#### Validación que sale GRATIS del modelo
Si María tiene hora médica de 10 a 12 y la intentas asignar a caja de 9 a 14 → **conflicto, en rojo.**
El mismo bloque que informa visualmente es el que alimenta el cálculo. **No hay dos fuentes de verdad:
lo que ves pintado es lo que cuenta.**

---

### 🔢 EL CONTADOR DE HORAS: se calcula, NO se guarda

**Qué se guarda en una asignación:** empleado · puesto · día · **hora inicio** · **hora fin**.
Nada más.

De ahí sale todo:
- **Jornada partida** = dos filas el mismo día (9–13 y 17–21). El modelo no necesita saber que
  "eso es una partida": lo es de facto.
- **Zoom a la hora** = las horas ya están guardadas, se pintan.
- **Zoom a semana / mes / año** = se agregan esas filas.
- **Validar descanso entre turnos** = hora fin del anterior vs hora inicio del siguiente.
- **Ver huecos** = filas existentes vs cobertura pedida.

*Las "franjas con nombre" (Mañana = 8:00–16:00) son **azúcar de interfaz** — un atajo al escribir.
Al guardar se expanden a horas concretas. **La BD siempre ve horas.***

#### ⚠️ El contador es una CONSULTA, no un campo

**El proceso de conteo se dispara** al asignar, modificar, mover o borrar. ✅ *(En esto coincidimos.)*

**Lo que hace:** recalcula sumando las asignaciones + conceptos de esa persona **en la ventana
correspondiente** (semana / mes / año) y compara con los límites de su perfil.

**Lo que NO hace:** incrementar un campo guardado (`horas_semana += 4`).

*Por qué:* un acumulador guardado **se desincroniza**. Si borras una asignación hay que acordarse
de restar; si mueves un turno de martes a miércoles hay que restar de una semana y sumar a otra.
**Basta un olvido para corromperlo** — y entonces la app dice "María va bien" cuando se ha pasado.

> Guía: *"fuente única de verdad"* + *"verificar el estado real (BD), no solo la pantalla: puede
> verse bien mientras por debajo hay corrupción."*

**No son tres contadores (semana/mes/año): es una misma función con distinta ventana temporal.**

*Optimización (solo si se demuestra que hace falta):* cachear el cálculo, nunca guardar el
acumulador a mano.

### El flujo de operación (orden correcto, validado)
1. **Configurar el calendario** → puestos por franja, cuántos hacen falta.
2. **Configurar la plantilla** → empleados con sus perfiles y su elegibilidad por puesto.
3. **Vincular** → qué empleados juegan en este calendario.
4. **Comprobar** → ¿hay candidatos elegibles para cada puesto? *(El sistema avisa de lo que falta:
   "no puedes generar: el puesto de cocina del sábado no tiene ningún empleado elegible".)*
5. **Generar** → el motor **propone** un posicionamiento inicial.
6. **Ajustar** → el encargado modifica. **La validación sigue viva siempre**, se genere o se
   coloque a mano.

### ⚠️ Alcance: el "botón generar" NO va en la v1

**v1 = editor de cuadrante con VALIDACIÓN.**
El encargado coloca a mano; el motor valida en tiempo real (descanso, horas, elegibilidad,
cualificación) y muestra los huecos. **El error clásico del cuadrante hecho a mano deja de ser
posible.** Eso es el ~80% del valor y es perfectamente tratable.

*Motivo:* auto-generar un cuadrante óptimo respetando todas las restricciones es un problema
**NP-duro**. No es un botón, es un proyecto en sí mismo. Si la v1 depende de él, la v1 puede no
llegar nunca. Y un botón que produce cuadrantes mediocres **hunde** la demo; un editor que valida
bien, no.

**Hito siguiente = auto-relleno (sugerencia, no óptimo).**

### 🚫 Turnia NO necesita IA (corrección importante)
El auto-relleno es un **algoritmo determinista**, no un LLM: recorrer huecos → filtrar candidatos
elegibles → heurística de reparto (el que menos horas lleve, el que más tiempo lleve sin librar)
→ colocar.

**La IA sería PEOR aquí:** un LLM no *garantiza* respetar las restricciones — puede violar un
descanso porque "le pareció razonable". Un algoritmo con las reglas codificadas **no puede**.
Para un problema donde la corrección es dura y verificable, **gana el código**.

*Dónde SÍ tendría sentido la IA (opcional, nunca en el núcleo):* explicar en lenguaje natural por
qué un cuadrante no cuadra; interpretar peticiones del empleado en texto libre; sugerir mejoras
cualitativas ("Juan lleva tres findes seguidos"). → **IA para lo blando y comunicativo; algoritmo
para lo duro y verificable.**

**Meter IA porque sí sería matar moscas a cañonazos.** El valor de Turnia está en el modelado del
dominio y el motor de reglas — ya es suficientemente impresionante.

---

## 6. Git y despliegue

**GitHub público**, como Linaje.
- El valor no está en el código (lo puede construir otro) — **está en demostrar que TÚ sabes
  construirlo**, y eso solo se demuestra enseñándolo. Un repo privado no consigue entrevistas.
- Sin filtrar secretos: `.gitignore` como **lista blanca**.

**Push desde el día uno.** Git no es "subir el resultado final", es **el registro de cómo se
construyó**.
- El historial **es prueba de método** para un reclutador (Conventional Commits: `feat:`, `fix:`,
  `docs:`, `refactor:`...). Un commit único de 300 archivos no demuestra nada — levanta sospechas.
- Es red de seguridad: cada commit es un punto al que volver.
- **Ritmo:** una tanda aprobada = uno o varios commits con sentido.

**La 1.0.0 es la etiqueta del hito**, no el punto de partida.

### Secuencia de despliegue (auto-deploy: sí, pero NO todavía)

**Fase de construcción (ahora):**
Laragon local + push a GitHub cada tanda aprobada. **Sin subdominio, sin cron, sin demo pública.**
El repo crece y la historia se escribe, pero nadie mira.

*Motivo:* con auto-deploy activo, cada push va directo a producción — incluyendo lo que está a
medias y lo roto.

**Fase de publicación (cuando lo troncal esté sólido):**
Patrón ya documentado en la guía: subdominio en Hostinger → base de datos → clonar fuera del
docroot → symlink a `public/` (nativo en Laravel) → config de producción fuera del repo →
permisos → **y entonces sí** cron `git pull` con `flock` y `PATH` fijo.

**⚠️ Novedad respecto a Linaje:** el script de despliegue necesita **pasos extra** — tras el
`git pull` hay que actualizar dependencias (**Composer**) y aplicar **migraciones de BD** si las
hubo. El script de Turnia no es el mismo que el de Linaje.

---

## 7. Pendiente de decidir

**Resueltos en esta sesión:**
- [x] ~~Sector-vitrina~~ → **El motor no tiene sector.** La vitrina de la demo será un sector
      concreto solo por narrativa (que el reclutador entienda en 30s qué ve), pero **no condiciona
      nada del diseño**. *(Decidir cuál al maquetar la demo.)*
- [x] ~~Modelo de datos~~ → **Cerrado.** Ver sección 5 bis.
- [x] ~~¿IA embebida?~~ → **NO en el núcleo.** El auto-relleno es algoritmo, no LLM.
- [x] ~~Alcance v1~~ → **Editor con validación.** El "generar" es hito posterior.

- [x] ~~¿La validación bloquea o avisa?~~ → **AVISA, NO BLOQUEA.** Ver abajo.

**Aún abiertos:**
- [ ] **Desglose de tandas** para Claude Code
- [ ] **Identidad visual concreta** — logo, color *(Fase 5, no bloquea el arranque)*

---

## 8. La validación: AVISA, no bloquea ✅

**Decisión:** el motor **deja colocar** aunque se incumpla, pero lo marca **en rojo** y lo deja
**registrado**.

**Por qué:** *el valor de Turnia no es impedir errores, es hacerlos visibles.* Hoy el encargado
incumple **sin saberlo** (el error clásico del cuadrante a mano). Con Turnia, si incumple, lo hace
**a sabiendas** — y eso ya es una mejora enorme.

**El riesgo de bloquear:** un encargado a veces *necesita* saltarse una regla (se le pone uno malo
el sábado y no tiene a nadie más). Si la app se lo impide, **cierra la app y coge el Excel.** Ahí
perdiste.

**Responsabilidad:** si la app bloqueara, estaría tomando una decisión laboral por el empresario.
No le corresponde. **Turnia informa; el humano decide.**

### Dos niveles de gravedad
- **Imposible** (físicamente absurdo: está de vacaciones, no puede estar en dos sitios a la vez)
  → **sí puede bloquear**.
- **Incumplimiento** (se pasa de horas, descanso corto, sin cualificación) → **avisa en rojo y deja**.

### El incumplimiento queda REGISTRADO, no solo pintado
Permite un **informe de incumplimientos** del cuadrante: *"esta semana tienes 3 turnos que rompen
el descanso"*. Información de negocio real — justo lo que un inspector de trabajo o un abogado
laboralista querría ver.

---

## Anexo — Decisiones de contexto ya cerradas (sesión previa)

- **Coste de la IA no es un factor.** Céntimos por consulta. Elegir por la idea, no por la factura.
- **Universo demo ≠ universo real.** Construir para el demo (fricción cero), diseñar pensando en
  el real.
- **El peso del proyecto es PORTFOLIO**, no pelear mercado → **profundidad técnica sobre cantidad
  de features**. Que exista competencia no resta: ayuda, porque quien evalúa entiende el problema
  sin explicaciones.
- **Estrategia general:** constancia. Hacer proyectos y que venga lo que tenga que venir. No matar
  moscas a cañonazos.

---

## 9. REGISTRO DE CONSTRUCCIÓN

**Estado actual:** Laravel 13.19 sirviendo en `http://turnia.test/` · modelo de datos completo
y verificado contra MySQL · repo público al día.
**Repo:** https://github.com/ablanquez/turnia (público, `main`, 2 commits, sin coautorías)

### Entorno verificado
PHP 8.3.30 · Composer 2.9.4 · MySQL 8.4.3 · Apache · Laragon
Junction: `C:\laragon\www\turnia` → `F:\01_PROYECTOS\002_TURNIA\public`

⚠️ **Si se renombra/mueve la carpeta, la junction se rompe.** Rehacer con:
`mklink /J "C:\laragon\www\turnia" "F:\01_PROYECTOS\002_TURNIA\public"`

### Cambios fuera del proyecto (registro)
1. `php.ini` de Laragon, línea 832: `;extension=zip` → `extension=zip`
   *(Composer la necesita para descomprimir; sin ella cae en un fallback lento de clonar por git.)*
2. `git config --global credential.https://github.com.helper` → `gh auth git-credential`
   *(El Git Credential Manager abre un diálogo gráfico que cuelga la shell no interactiva.
   Resuelto con `gh auth setup-git`, vía oficial.)*

*Nota de entorno:* Apache y MySQL en Laragon corren **como procesos, no como servicios** —
`httpd -k restart` falla.

### Tandas completadas

**Tanda 1 — Andamiaje** (`chore: inicializa Laravel 13 con MySQL y vhost local`)
Laravel 13.19.0 + MySQL + repo público creado.
> 🎣 *El instalador desatendido eligió **SQLite** por defecto y migró ahí.* Detectado y corregido
> a MySQL sin dejar rastro. Sin backtesting, habría quedado una BD fantasma dentro del proyecto.

**Tanda 2 — Modelo de datos** (`feat: añade el modelo de datos de turnos y horarios`)
15 migraciones · 13 modelos · 4 enums · 31 FKs · soft delete en las 6 tablas con histórico.
Verificado con **16 comprobaciones contra MySQL real** (con rollback): dos empresas del mismo
empresario · María con dos contratos y perfiles distintos · turno nocturno 22:00→06:00 (480 min
limpios) · jornada partida · el contador sumando la hora médica · baja abierta detectando 3
asignaciones huérfanas **por consulta, sin flag** · soft delete de empresa **sin cascadear el
histórico**.

---

## 10. APRENDIZAJES PARA LA GUÍA MAESTRA

### 🔑 Al usar un framework, la ñapa es "hacerlo a tu manera dentro"
No es solo improvisar. Es **forzar tu modo dentro de una herramienta que ya tiene el suyo.**

### 🔑 Nombres de índice: MySQL corta en 64 caracteres
El nombre autogenerado por Laravel para un índice de 3 columnas con nombres largos
(`coverage_requirements_calendar_id_effective_from_effective_to_index`) **pasa del límite y MySQL
lo rechaza.** Solución al modo Laravel: nombre explícito en el 2º argumento de `index()`.
⚠️ **Y MySQL no revierte DDL:** la migración fallida deja la tabla creada a medias y sin
registrar. Hay que eliminarla y relanzar.

### 🔑 El orden de las migraciones NO es el de creación
Artisan puede generar varios ficheros **dentro del mismo segundo**, y Laravel los ejecuta por
**orden alfabético de nombre de fichero**. `calendar_employment` corría antes que `calendars`
(el `_` va antes que la `s` en ASCII) → las FKs habrían petado. Renombrar con orden explícito
siguiendo la cadena de dependencias.

### 🔑 `migrate:fresh` tras cualquier arreglo de migración
Es el único modo de cazar el fallo que **solo aparece al desplegar en limpio**. Si no se prueba
la reconstrucción total desde cero, el error estalla en producción.

### 🔑 `$fillable`, no `$guarded` — fail-closed
`$guarded` es **inseguro por defecto**: si mañana añades una columna sensible y olvidas guardarla,
queda expuesta a asignación masiva. Con `$fillable` el olvido es **benigno** (no funciona); con
`$guarded` el olvido es **un agujero**.

### 🔑 Columnas denormalizadas: derivarlas en un hook, no exponerlas
*(Patrón reutilizable — salió mejor que el diseño original.)*
Al dejar `company_id`/`person_id` fuera de `$fillable` (para que el cliente no pudiera mentir
sobre las copias denormalizadas), el `INSERT` rompía. Abrirlas habría reintroducido el agujero.
**Solución: derivarlas del contrato en un hook `saving()` del modelo.** La copia denormalizada
**no puede mentir por construcción** — ni el cliente ni el código pueden falsearla.

### 🔑 Enums de PHP respaldados por string, NO `ENUM` de MySQL
El `ENUM` nativo de MySQL exige un `ALTER TABLE` para añadir un valor. Un `varchar` + enum de PHP
casteado en el modelo da lo mismo: legible, portable, con autocompletado y sin magic strings.

### 🔑 Minutos enteros, nunca horas decimales
`7.5h + 7.5h ≠ 15h` con flotantes. Guardar siempre minutos (`unsignedInteger`); mostrar horas en
la interfaz. Las sumas del contador son enteros exactos.

---

## 11. TANDAS 3 y 4 — EL MOTOR DE REGLAS (cerrado)

**Estado:** el motor está COMPLETO. Ningún parámetro del modelo sin motor.
**131 tests · 271 aserciones · contra MySQL real** (`turnia_testing`, no SQLite) · Pint limpio.

```
adb72b6  feat: cierra el motor con conceptos, ausencias y cobertura
37e7a7d  feat: añade el motor de reglas y validación de turnos
14bf888  feat: añade el modelo de datos de turnos y horarios
53dca1c  chore: inicializa Laravel 13 con MySQL y vhost local
```

### Decisiones de diseño que MEJORARON el encargo
*(Las cuatro salieron de que el ejecutor discutió el diseño en vez de obedecer.)*

**1. NO se materializan los incumplimientos.** Yo pedí registrarlos; el argumento en contra
era más fuerte: un contador acumulado se desincroniza cuando tocas **sus** filas; un
incumplimiento guardado se desincroniza cuando tocas **cualquier fila relacionada** (una baja,
un turno en otra empresa, un cambio de perfil). **Es un campo que miente solo.** Peor que el
contador. → El informe se **deriva** (`ViolationReport` re-valida la ventana).
→ Lo que SÍ se registra (`assignment_overrides`): que el encargado **forzó a sabiendas**
(quién, cuándo, justificación). Eso es dato nuevo, no derivable.

**2. Instantes en UTC.** Con hora local ingenua, la noche del cambio de hora un turno
22:00→06:00 daría 8h cuando dura 9. **El contador mentiría una vez al año, en la noche que más
se paga.** `starts_at`/`ends_at` = instantes UTC; `work_date` = día local de negocio.

**3. Precedencia de cobertura `date > weekly > daily`.** Sin ella, el bar que cierra el 25 de
diciembre (sábado) enseñaría un **hueco fantasma** de 3 personas un día que ni abre.
`required_count = 0` = "cerrado", sin columna nueva.

**4. La baja durante las vacaciones NO se bloquea.** En España la baja **interrumpe** las
vacaciones y esos días se recuperan — caso real y frecuente. Si el motor lo marcara IMPOSIBLE,
**el gestor borraría las vacaciones a mano para poder registrar la baja** → la app forzaría el
dato corrupto que pretende impedir. → Solape de ausencias = **incumplimiento**, no imposible.
→ Y **NO se devuelven los días al cupo automáticamente**: se avisa. *Turnia informa; el humano
decide.*

### Tres niveles de gravedad (el tercero nació de una necesidad real)
- **Impossible** → físicamente absurdo (solape, duración cero, fin antes que inicio, >24h).
- **Breach** → incumple una condición (se pasa de horas, descanso corto, sin cualificación).
- **Notice** → información pura, no rompe nada. *(Ej: "esta persona trabaja hoy también en otra
  empresa"; "este contrato no tiene perfil definido".)* Silencio ≠ "todo correcto".

---

## 12. ⚠️ EL MODO DE FALLO DE ESTE DOMINIO

**Cuatro tandas, cuatro veces el mismo patrón. Turnia no falla petando: falla MINTIENDO CON
CONFIANZA.**

### El AVISO FALSO (3 casos)
El motor avisa de un incumplimiento que no existe. **No pete, no rompe — y es peor**, porque
el encargado **aprende a ignorar los avisos** y entonces toda la app deja de valer.

> 🎣 **El caso que lo destapó:** la regla de descanso comparaba el turno nuevo contra *cualquier*
> turno anterior… **incluida la otra mitad de su propia jornada partida.** Entre las 13:00 y las
> 17:00 hay 4h < 12h → **toda jornada partida salía en rojo.** El motor habría sido inútil
> precisamente en hostelería, que es la vitrina.
> **La causa conceptual:** el descanso legal es **entre** jornadas, no **dentro** de una. Y el
> dato que lo distingue ya existía: las dos mitades de una partida comparten `work_date`.
> **Ningún test del camino feliz lo habría cazado.**

### El SILENCIO FALSO (1 caso) — peor por naturaleza
Un hueco que **desaparece**. **Un aviso falso lo ves; un silencio falso, no.**

> 🎣 Alguien añade un turno de noche para el sábado 15 con un requisito `date` → **borra la
> demanda del mediodía de ese día** (por la precedencia). El motor decía "cubierto". **Nadie
> cubre la barra a la hora de comer.**
> **El arreglo correcto:** no deshacer la decisión de producto — **eliminar el silencio
> manteniendo la semántica acordada.** La precedencia sigue igual, pero ahora el motor **grita**
> cuando anula (`RuleCode::RequirementOverridden`).

### 🔑 COROLARIO PARA LAS TANDAS QUE VENGAN
Ante un fallo de este tipo, la solución **no es deshacer la decisión de producto**, sino
**eliminar el silencio** manteniendo la semántica acordada.

**En la parrilla (tanda 5) el peligro es exactamente este:** que la interfaz **pinte verde donde
hay rojo**, o **no pinte nada donde falta gente**.

---

## 13. Deuda consciente (documentada, no olvidada)

`requiredReductionMinutes()` se calcula, está probado, y **nadie lo consume**.
No es un agujero: el modelo **no tiene ningún campo de "jornada exigible"** contra el que restar,
porque nunca se definió de dónde sale esa cifra.

**Pregunta a responder antes de tocarlo:** si se quiere el informe *"esta semana debía 40h, hizo
38 y tenía 2h de permiso sin sueldo: cuadra"* — **¿de dónde sale la cifra de jornada exigible?**

---

## 14. TANDA 5 — ESTRÉS DEL MOTOR (`793cf8f`)

**160 tests · 444 aserciones.** 20 negocios distintos · 1.000+ turnos colocados a través del
validador real · dataset de **32.057 asignaciones/año** sobre MySQL 8.4.
Informe completo: `docs/ESTRES-MOTOR.md`

### ✅ EL DATO QUE DESBLOQUEA LA PARRILLA
> **Validar una asignación cuesta 4-6 ms.** No 2 segundos.
> **La parrilla PUEDE validar al arrastrar** — sin debounce agresivo, sin optimistic UI, sin
> trucos. 20× de margen sobre el criterio de 100 ms. **Y no se degrada con el tamaño:** la
> empresa de 60 empleados valida igual de rápido que la peluquería de 3.

### ✅ LA COHERENCIA GLOBAL SE SOSTIENE
1.000+ turnos colocados uno a uno (escribiendo solo los que el motor declaraba limpios) →
**cero incumplimientos sobrevenidos** al re-validar el conjunto.
**No existe el caso "colocar A vale, colocar B vale, pero A+B no"** en el camino secuencial.
*(Era el mayor temor. No está ahí.)*

Y las reglas **no dependen del orden**: 100 permutaciones aleatorias, resultado idéntico.

### 🎣 LOS TRES FALLOS ERAN DE OMISIÓN — el motor DEJABA DE MIRAR

**1. SILENCIO FALSO — el informe miraba solo un tercio.**
`ViolationReport` re-validaba **asignaciones y nada más**, ignorando conceptos y ausencias.
Una hora médica el jueves + una baja registrada *después* que cubre ese jueves = contradicción
que **se queda ahí para siempre**, y el contador la sigue sumando.
> 🔑 **"Lo que el motor sabe validar y nadie re-valida es un silencio falso esperando a ocurrir."**
> La idea equivocada: *"el informe es sobre el cuadrante"*. En realidad **es sobre todo lo que
> ocupa el tiempo de la gente.**

**2. SILENCIO FALSO — el puesto que nadie puede cubrir salía como hueco normal.**
"Faltan 2 de Sumiller", igual que cualquier otro rojo. El encargado busca a quién colocar y no
entiende por qué no encuentra a nadie. **El problema estaba en el CATÁLOGO, no en el cuadrante —
y el motor lo sabía.** → Ahora emite `Notice: UncoverablePosition`.

**3. CRASH — el mejor diagnóstico conceptual del informe.**
Validar contra un turno de una empresa borrada en suave reventaba (`property "name" on null`).
> 🔑 **"Creímos que 'no cascadear' era una decisión sobre el BORRADO. En realidad es una decisión
> sobre la LECTURA: si el hijo sobrevive al padre, tiene que poder nombrarlo."**
> → `->withTrashed()` en los `belongsTo` hacia modelos con soft delete (11 modelos).

**4. Índice que faltaba** — solo visible con datos reales: `(person_id, ends_at)`.
La regla del descanso hacía `filesort` sobre 122 filas → ahora *backward index scan*, 56 filas,
0,168 ms.

### 🧠 LA MEMOIZACIÓN REVERTIDA (la decisión más madura)
Se intentó memoizar el contador para atacar las 6.854 consultas del informe. **Midió 6.830. Nada.**
El coste no está en el contador (0,6 ms) sino en que cada asignación dispara las consultas de
*todas* las reglas.
> 🔑 **Un caché que no sirve es PEOR que ninguno: deja una trampa cargada para quien venga después
> y lo encienda en el camino de escritura**, donde una lectura vieja sería exactamente *el
> contador que miente* del que huimos.
*(Guía: "medir antes de elegir" + "coste de tocar lo que funciona".)*

### ⚠️ EL INFORME ES LENTO — y es una decisión, no una rendición
**2,9 s y 6.830 consultas** para el mes de una empresa de 60 empleados. El coste es **inherente
al diseño**: re-validar contra el estado completo es exactamente lo que lo hace **incapaz de
mentir**.
- **NO puede ir en el camino de la petición.** Va en cola o bajo demanda con indicador de carga.
- **Su ventana natural es la SEMANA (719 ms), no el mes.** Es lo que mira un encargado.
- *Optimización futura (merece su propia tanda):* objeto de contexto pre-cargado por ventana
  (3 consultas en memoria) que se pasa a las reglas → convierte O(N × reglas) en O(reglas).

---

## 15. 🚨 EL RIESGO VIVO: TOCTOU (concurrencia)

**Reproducido, diseñado, NO implementado — a propósito.** Pertenece a la capa que escribe.

**El agujero:** dos encargados validan a la vez contra el mismo estado. Los dos reciben "limpio".
Los dos escriben. **El resultado combinado nunca se validó contra nada.**
> El caso peor **no es el duplicado evidente**: son **dos turnos distintos, en días distintos, que
> individualmente cumplen el descanso y JUNTOS lo rompen.** Silencio falso por concurrencia.

**La solución (demostrada en test):**
```php
DB::transaction(function () use ($draft) {
    Person::whereKey($draft->personId())->lockForUpdate()->first();
    $result = app(AssignmentValidator::class)->validate($draft);   // RE-validar DENTRO
    // decidir y escribir con el estado ya bloqueado
});
```
**Por qué el candado va sobre la PERSONA:** el solape y el descanso —las dos reglas que la
concurrencia puede romper— se validan a nivel de persona. Serializa **exactamente** lo que puede
interferir y deja pasar el resto en paralelo. *(La empresa serializaría de más; la asignación, de
menos.)*

### ⚠️⚠️ COROLARIO OBLIGATORIO PARA LA TANDA DE LA PARRILLA
> **La validación que se enseña al arrastrar es una PREVISUALIZACIÓN.**
> **La validación que DECIDE es la que corre DENTRO DEL CANDADO.**
> **No son la misma llamada, y confundirlas reabre el agujero.**

**Es el riesgo nº1 vivo.** Solo se cerrará del todo con dos navegadores peleándose de verdad
contra InnoDB.

### Otros asumidos (no probados)
- **60 empleados es el tope medido.** Una cadena de 500 no está probada (no hay razón teórica para
  que se degrade, pero *"debería"* no es *"está medido"*).
- **Solo se ha probado `Europe/Madrid`.** Una empresa en Canarias, no.
- **El reloj del servidor y el de MySQL deben estar de acuerdo.** Todo el motor descansa en
  instantes UTC: una zona mal configurada **mentiría de forma silenciosa y sistemática.**
  → **Comprobar en el arranque del despliegue.**

---

## 16. TANDA 6 — PARRILLA (Vue + Inertia + Fortify)

**197 tests · 628 aserciones.** Commits: `41bdbc6` · `9c88a3c` · `ca1e52f`

**Ya se puede abrir:** `http://turnia.test/` — contraseña `turnia`
| Usuario | Rol | Qué ve |
|---|---|---|
| `demo@turnia.test` | Empresario | Los dos bares. Y *"también trabaja en **Bar Central** (08:00-12:00)"* |
| `encargado@turnia.test` | Encargado | L'Òptim entero. Y *"también trabaja en **otra empresa**"* (redactado) |
| `empleada@turnia.test` | Ana, empleada | El cuadrante. Su baja. **Ni las horas médicas de nadie, ni un solo contador** |

### Stack y decisiones
**Vue 3 + Inertia 3 + Fortify.** *(Breeze y Jetstream están MUERTOS desde 2025; los starter
kits solo existen para `laravel new`. Para una app ya creada, la vía oficial es **Fortify** —
que es lo que los starter kits usan por debajo.)*
**Sin registro público:** Turnia guarda bajas médicas de gente que no se registró ella. Un
registro abierto crearía empresarios anónimos metiendo **datos de salud de terceros**.

**Los tres papeles NO son una columna: SE DERIVAN.**
Empresario = `companies.user_id` · Encargado = pivote `company_user` · Empleado = tiene contrato.
*Guardarlo en una columna obligaría a mantenerla sincronizada con esas tres relaciones, y el día
que se desincronizara **alguien vería datos que no le tocan**.* El pivote **no lleva columna
`role`**: el dueño ya vive en `user_id`, y una segunda fuente de verdad sobre lo mismo acaba
mintiendo. **Fail-closed:** quien no es ninguna de las tres cosas, no ve nada.

**El eje temporal se calcula en el SERVIDOR.** Si el navegador convirtiera de UTC usaría **la
zona del navegador, no la del bar**: un encargado en Canarias vería el cuadrante de Madrid
corrido una hora. **Ningún componente Vue toca una fecha ni evalúa una regla** — un segundo motor
en JavaScript acabaría divergiendo del de verdad.
El eje va de 06:00 a 06:00 y **se ENSANCHA** si algo se sale (la panadería que entra a las 04:00):
**nunca recorta, porque una barra recortada es una mentira dibujada.**

---

## 17. 🔴 EL BUG QUE CAMBIA LA ESTRATEGIA DE PRUEBAS

### El aviso era CORRECTO. La hora que daba, FALSA.
Los turnos se guardan en UTC (decisión correcta). Pero cuatro reglas escribían sus mensajes con
`$turno->starts_at->format('H:i')` → **imprime la hora UTC**. En Madrid en verano son **DOS HORAS
MENOS**: el motor decía *"ya tiene un turno de 12:00 a 18:00"* cuando el turno era de **14:00 a
20:00**.

> El encargado mira las 12:00 de su parrilla, no encuentra nada, y **deja de creerse los avisos**.
> **Un aviso que miente en los detalles hace más daño que ningún aviso.**

### 🔑 POR QUÉ NADIE LO VIO — el agujero real
> **"Ningún test leía el TEXTO del mensaje: solo comprobaban el `RuleCode`.
> Solo apareció al enseñárselo a un humano."**

**Eso no es un bug: es un AGUJERO EN LA ESTRATEGIA DE PRUEBAS.**
Los tests validaban que **la regla saltaba**, no que **dijera la verdad**.
Se probaba la lógica, **no la comunicación** — en una app cuyo valor entero es *comunicar bien*.

**→ REGLA NUEVA: si un mensaje puede mentir, hay que PROBAR EL MENSAJE.
No basta con probar que salta.**

### La contraprueba que validó el diagnóstico
Volvió a meter el bug para ver si los tests nuevos lo cazaban:
- **Con el bug puesto: en julio mentía 12:00. En enero, 13:00.**
- Un arreglo que restara *"dos horas"* a mano **habría pasado el test de verano y fallado en
  invierno**.
- **Con la empresa en UTC el desfase sería CERO** → un test escrito sin zona horaria de verdad
  **habría pasado en verde sin cazar nada.**

`MessageTruthTest` prueba **verano, invierno, Canarias**, y que el aviso redactado **no deje ni
rastro del otro bar**.

### 🎣 Y el mismo modo de fallo mordió OTRA VEZ el mismo día
`diffInDays()` devuelve un **float**. Restar la medianoche UTC del `work_date` de la medianoche
local (que en Madrid en verano es **la víspera a las 22:00**) da **−0,083 días → ×24 = −2 horas**.
**Toda la parrilla se pintaba dos horas antes de su hora real.**

> **"No reventaba: PINTABA. Nadie habría visto un error — habría visto un cuadrante."**

Perfectamente coherente. Perfectamente falso.

### La hora se cuenta en el reloj de la empresa DONDE OCURRE el turno
No en el de quien mira. *Si el otro bar estuviera en Canarias, decir la hora de Madrid sería
**mentir con precisión**.* `Company::localTime()` es la inversa de `toUtc()` y queda como **único
sitio que sabe convertir**.

---

## 18. Dos avisos más de la tanda 6

### ✅ El `$fillable` (fail-closed) defendió al proyecto de su propio ejecutor
Claude Code intentó crear la empleada pasando `person_id` por `create()`. **Eloquent lo descartó
en silencio** (no está en `$fillable`) → quedó **un login que no era de nadie**. Lo cazó el test
de privacidad con un 403.
> Es **exactamente** el argumento que impuso `$fillable` sobre `$guarded`: *el olvido es benigno,
> no un agujero.* Demostrado en vivo.

### ⚠️ Tests que pasaban POR NO HABER COMPILADO
Los tests de la prop diferida mandaban la versión de assets vacía; **funcionaba porque no existía
el manifest**. Al ejecutar `npm run build`, los tres se cayeron con un 409.
> **"Un test cuyo resultado depende de si alguien compiló antes no prueba nada."** En CI habría
> fallado el primer día.

### Rendimiento y N+1 cazados
`CoverageCalculator` consultaba **dentro del doble bucle** (día × puesto): **una consulta por
celda** (35 la semana, 150 el mes), escondidas tras dos `foreach`.
`HourCounter` preguntaba **contrato a contrato** (16 consultas para un bar de 8; 120 para 60).
→ **La carga de la parrilla pasa de 72 a 24 consultas (~60 ms).**
*`workedMinutesFor()` agrupa **sin dejar de ser una consulta**: no cayó en el acumulador.*

### El informe diferido NO pinta verde mientras carga
Llega como **prop diferida de Inertia**. Mientras no llega, el indicador dice *"comprobando
incumplimientos…"* y **no pinta nada en verde**.
> **Pintar verde por defecto habría fabricado un silencio falso en la propia interfaz.**

---

## 19. Cabo suelto para el despliegue
⚠️ **`/public/build` está en `.gitignore`.** Hostinger **no tiene Node**, así que hay que
**sacarlo del ignore** (versionar los assets compilados) **o subirlos por FTP aparte**.
*Vue se compila en LOCAL: Hostinger solo necesita PHP y MySQL, no gasta slot de Node.*

---

## 20. LA PARRILLA — estado al cerrar la sesión

**Commits:** `82d9bc3` → `76d1c19` → `8a9d524` → `cc73470` → `cf74f46` → `8e5f9de`
**204 tests + 14 comprobaciones visuales (Playwright).** Funciona y se lee.

### Lo que quedó bien
- **Sistema visual:** 5 superficies · 3 pesos de borde · puestos como bloques (cebra + borde de
  sección 2px + raíl fijo con el nombre). *La estructura calla; el color habla.*
- **Panel de plantilla colapsable**, recogido de inicio. **Altura = 100% de la ventana, siempre**
  (ni más por exceso de gente, ni menos por falta). La lista es su contenido, no su medida.
- **Columnas fluidas** (`minmax(160px, 1fr)`): la semana entera **cabe a 1366px** con el panel
  recogido. Sábado y domingo dejan de estar escondidos — el pico de carga en hostelería.
- **Sub-carriles geométricos:** si dos bloques se pisan → alturas distintas → **el solape se VE**;
  si hay aire → misma línea → **la partida se VE**. *La vista no juzga: solo coloca. Quien decide
  sigue siendo el motor.*
- **Zoom Día:** el escalón de cobertura (`faltan 3` → `faltan 2`) con su anchura real.
- **Seeder sano:** 27 tramos verdes, 2 rojos, y los 8 casos difíciles **uno de cada**.
  *Un cuadrante en llamas no impresiona: alarma.*

---

## 21. 🚨 EL AGUJERO QUE SE REPITE — SEIS CAPAS

**Cada vez que se cierra, reaparece una capa más arriba. Es EL patrón del proyecto.**

| # | Se probaba… | …pero no se probaba |
|---|---|---|
| 1 | que la regla **saltaba** | que **dijera la verdad** *(mensajes con hora UTC)* |
| 2 | que el dato **llegaba** | que la **pantalla se viera** *(nunca abrió la página)* |
| 3 | que la página **se veía** | que se viera **al tamaño del usuario** *(capturas en fullPage 2.640px: el panel "salía")* |
| 4 | el **array** que devuelve el motor | el **píxel** en pantalla *("27 tramos verdes" y cero verde visible)* |
| 5 | el **píxel declarado** | el **píxel resultante** ⭐ |
| 6 | — | **el propio detector mentía** ⭐⭐ |

### ⭐ La capa 5 — el verde que era gris
`rgba(21,128,61,.18)` sobre gris claro **da `#DDE6DE`. Que es un gris.**
El dato estaba. El color estaba. **El resultado era gris.**
→ `tests/Visual/comprobar.mjs` ya no mira props ni JSON: **le pregunta al navegador qué color
CALCULÓ de verdad.**

### ⭐⭐ La capa 6 — el detector mintiendo
> *"La primera versión de la comprobación del scroll le preguntaba **al panel recogido** si tenía
> scroll vertical. Un raíl de 40px nunca lo tiene. **Daba verde.**"*

**Preguntar a la cosa equivocada te da una respuesta correcta a una pregunta que no era la que
había que hacer.** El instrumento construido para cazar mentiras, mintiendo.

### 🔑 Y el momento cumbre: EL MOTOR CAZÓ A SU PROPIO AUTOR
> *"Moví esa hora médica dentro de su turno 'para que se viera la colisión'… y el motor la declaró
> IMPOSIBLE. Y tenía razón: no se puede estar en el médico y cubriendo la cocina a la vez.
> **Arreglé el dato de demo, no el motor. El motor cazó mi mentira antes que yo.**"*

### 🔑 REGLAS DE TRABAJO QUE SALEN DE ESTO
1. **Ninguna tanda se cierra sin ABRIR LA PÁGINA.** Ni una.
2. **Y hay que abrirla al tamaño que la mira el usuario** (1366px, no 2.640).
3. **Medir el píxel resultante, no el declarado.** Preguntarle al navegador, no al código.
4. **Los tests no leen rótulos: miden geometría.** *(Si mañana alguien devuelve las dos barras del
   solape a la misma pista, el test cae **aunque el texto siga diciendo "IMPOSIBLE"**.)*
5. **La referencia manda en lo visual. NO manda en lo que miente.**
   *(La maqueta no ejecuta reglas; con un motor de verdad, "41/40" no produce una celda naranja:
   produce cinco. Fidelidad no es copiar un bug.)*

---

## 22. 📌 MAÑANA: RESPONSIVE

**El foco de la próxima sesión.** Estudio de resoluciones y adaptación completa.

**Lo que ya está:** funciona a 1366px y a 1366×560 (panel y parrilla con scroll propio, sin
desbordar la página).

**Lo que falta:** barrer resoluciones de verdad y ver cómo queda todo.

⚠️ **Y una decisión de fondo que hay que tomar:** una parrilla de 7 días × 5 puestos × carriles
**NO CABE en un móvil**, y no debe intentarlo. Ya se decidió en su día, aunque no se llamara
*responsive*:
> **Web para el que GESTIONA el cuadrante. Móvil para el que CONSULTA su turno.**

→ El responsive de Turnia **no es "que la parrilla se encoja"**: es que el **empleado tenga OTRA
vista**, pensada para móvil, que enseñe sus turnos y poco más. **Eso es una tanda propia.**

---

## 23. Pendientes anotados
- [ ] **Drag & drop + escritura + el CANDADO (TOCTOU).** ⚠️ *La validación que se enseña al
      arrastrar es una PREVISUALIZACIÓN; la que DECIDE corre dentro del candado. No son la misma
      llamada.* **Riesgo nº1 vivo.**
- [ ] **Zona horaria por CALENDARIO** (o por "centro"), no solo por empresa. Cambio de modelo; va
      con la creación de calendarios.
- [ ] **Páginas de error propias** (400/403/404/500), como en Linaje. *Ya mordió: Fortify
      redirigía a `/home`, que no existe → 404 tras meter bien la contraseña.*
- [ ] **Zooms Año y Mes** (hoy apagados a propósito): necesitan **agregados** que no se han
      diseñado. El Año no puede mandar 30.000 turnos uno a uno.
- [ ] **`/public/build` está en `.gitignore`** — Hostinger no tiene Node. Sacarlo del ignore o
      subirlo aparte.
- [ ] Resto de pantallas (creación de empresas, empleados, puestos, perfiles, ausencias) + landing.

---

## 24. LA PARRILLA — segunda sesión (lunes)

**Ocho rondas de pulido visual.** Commits: `5b03b65` · `898fa16` · `21d9366` · `6a29c5b` ·
`78dae28` · `51440ca` · `eeaef89`
**207 tests PHP · 21 comprobar · 72 backtest · 89 cotejo · 44 matriz · 36 píxeles**

### 🔑 EL DOCUMENTO QUE LO CAMBIA TODO: `docs/MATRIZ-VISUAL.md`

**El diagnóstico:** siete rondas de arreglos visuales, y **cada una destapaba una casuística
nueva.** Cada arreglo era un parche puntual. **No existía ningún sitio que dijera "este caso se
pinta así".**

**La solución no es una lista de casos: es un SISTEMA DE COMPOSICIÓN.**
> Del producto de las dimensiones salen **cientos de combinaciones**. No se enumeran: **se
> derivan.** Si una combinación queda indefinida, **falta una LEY, no falta un caso.**

*(Es el mismo principio que hizo bueno al motor: el comportamiento vive en la tabla, no en el
código. Aquí: **la representación sale de las leyes**.)*

**Las leyes fundamentales:**
- **Ley 0 — UN CANAL, UNA PREGUNTA.** *La ley que se había roto siete veces:* el gris significaba
  a la vez "cubierto" y "no se pide nada"; el naranja, "forzado" e "incumple"; el índigo, "esta
  persona" y "cruza medianoche".
- **Ley 2 — el RELLENO dice DE QUIÉN ES.** Nunca el estado.
- **Ley 3 — el BORDE dice la GRAVEDAD.** Nunca identidad.
- **Ley 6 — NINGÚN COLOR VA SOLO.** Todo lo que dice un color lo dice también una palabra.
- **Ley 11 — el VACÍO significa "no hay dato", NUNCA "todo bien".**
- **Ley 13 — la representación vive en UN SOLO SITIO** (`useMatrizVisual.js`).

**Resultado:** 44 casos alcanzables → 44 firmas visuales distintas → **0 gemelos** (946 pares
comparados).

### 🔑 LA REGLA DEL CARTEL (decisión de producto)
> **EL CARTEL ES PARA LO QUE PIDE UNA DECISIÓN. NO PARA LO QUE SIMPLEMENTE OCURRE.**

- **Va a cartel:** imposible · incumplimiento · sin candidato *(exigen que alguien haga algo)*
- **NO va a cartel:** hora médica, baja, vacaciones, doble empresa *(son hechos, no problemas)*
- **Y el forzado NO lleva cartel:** ya está decidido. Sigue viéndose (anillo + muesca + nota),
  pero **deja de alarmar**.
  > *Si los forzados llevaran cartel, un encargado que HACE BIEN SU TRABAJO acabaría con una
  > parrilla MÁS ROJA que antes de revisarla. **El sistema castigaría el buen comportamiento.***
  > **El cartel se apaga cuando la decisión se toma.**

---

## 25. 🎣 LOS HALLAZGOS DE ESTA SESIÓN

### ⭐ HAY DOS CEROS, Y CASI SE COME EL CARO
`required = 0` significa **dos cosas OPUESTAS**:
- **Fuera de franja** → nadie ha dicho nada sobre ese tramo. No sobra nadie.
- **CERRADO** → alguien declaró un requisito de **cero personas** (así se dice *"ese día el bar no
  abre"*). Poner a alguien ahí **SÍ es un exceso, y del caro: pagas una jornada un día que el
  negocio cierra.**

Al arreglar el `unrequested`, **se cargó el aviso más caro.** Lo cazó un test de PHPUnit que ya
existía. **Los instrumentos se acumulan.**

**Y destapó una bomba latente:** `CoverageSegment::state()` devolvía **verde** para
`required=0, covered=0`. *"No se pide nada" pintado de "correcto"*.
> 🔑 **El verde se gana: ya no hay rama por defecto.**

### ⭐ LA PALETA: QUINCE ÍNDIGOS INDISTINGUIBLES
**El instrumento decía la verdad y era inútil.**
> *"Con la paleta vieja, `matriz.mjs` pasa —44 firmas, **0 gemelos**— mientras **el ojo no
> distingue nada**."*

Quince colores con **la misma luminosidad** (L\* 52–60) y el mismo croma. Medido sobre la imagen:
**Diego≡Sara ΔE00 = 4,0** · Diego≡Iker 6,1 · Ana≡Nuria 6,6. **Quince pares por debajo del umbral
perceptible.**
Y el reparto era `crc32(nombre) % 15` → **Bea y Tomás tenían el MISMO RGB exacto.**

**El arreglo:** paleta calculada maximizando el **ΔE mínimo en Lab**. De 4,0 → **16,5**. Y con la
**luminosidad abierta de L\* 32 a 74** — *"que es lo que de verdad lo arregla, porque a 10px **la
luminosidad es la única señal que el ojo conserva**"*.

> 🔑 **Capa 5 al extremo:** no es que el píxel resultante fuera *otro* — **es que era
> imperceptiblemente distinto.** Colores distintos en el CSS, indistinguibles en el ojo.

### ⭐ EL PORTADOR DE LA IDENTIDAD CAMBIA CON LA VISTA
En la **Semana** la barra está vacía → el relleno identifica (ΔE 17,8).
En el **Día** la barra lleva el nombre dentro → el relleno es un tinte (ΔE 7,3: **no basta**) y
quien identifica es **el avatar** (ΔE 18,4).
> 🔑 **La ley está en las dos vistas; el ELEMENTO que la lleva, no.**
> *Entender la ley, no obedecerla.*

### ⭐ EL PUNTO CIEGO: UN CONCEPTO NOCTURNO NO EXISTÍA
`conceptRows()` **no mandaba `crossesMidnight`**. Una hora extra de 22:00 a 06:00 llegaba al
navegador **afirmando que no cruza el día**. Y **las tres comprobaciones daban verde** — porque
*el pintado era coherente con la mentira del servidor*.
> 🔑 **Solo lo caza declarar QUÉ CASOS DEBE PERMITIR EL MODELO y exigir que aparezcan todos.**
> Un test que no verifica lo que hay, sino **que no falte nada**.

### 🎣 Otros de la sesión
- **"Sin incidencias" sobre una semana VACÍA.** El contador solo miraba turnos que incumplen, y en
  una semana vacía **no incumple nadie porque no hay a quién**. Un cuadrante perfecto y uno
  inexistente daban el mismo número: **cero**.
- **La celda imposible, MUDA.** *"Este lo metí yo razonando bien, que es lo que lo hace
  peligroso."* Era verdad que el número era una ficción — pero **esconder la tira dejaba una celda
  muda sobre un puesto descubierto**. → **Se arregló la ficción DONDE NACÍA:** el motor ya no
  cuenta como cobertura un turno que declara imposible.
- **El aviso sin sujeto, DOS VECES en la misma tanda.** Arregló el de Diego y **creó otro igual**
  con el "no cubre puesto". → **Ley 8: toda nota lleva sujeto y hora.**
- **La banda de baja caía en `positions[0]`** si la persona no tenía turnos esa semana (justo el
  caso de una baja larga). → Ahora va a **todas las filas que esa persona puede cubrir**: *la
  banda no informa de dónde ESTABA, sino de **dónde deja el hueco**.*
- **Un borde de 2px arriba y abajo de una barra de 8px deja 4px de relleno:** el canal del borde
  **se comía al de la identidad**.

---

## 26. 🚨 EL INSTRUMENTO HA MENTIDO DOCE VECES

**Y ya es una categoría, no una anécdota.**

| # | Cómo mintió |
|---|---|
| 1-6 | *(las seis capas de la sesión anterior)* |
| 7 | Buscaba *"el primer tramo rojo de la página"* y lo comparaba con **otra celda** |
| 8 | Preguntaba *"¿hay algún tramo rayado?"* — **el tipo de cosa, no la cosa**. Acertaba por casualidad |
| 9 | **Un `TimeoutError` daba el mismo código de salida que un hallazgo** → la contraprueba anunciaba **"CAZADO" sobre un test caído** |
| 10 | Muestreaba **fuera del viewport** (píxel `#000000`, ΔE 0,0) |
| 11 | Muestreaba **el centro de la barra** — que en el zoom Día es **donde está el texto** |
| 12 | Muestreaba **la esquina** — justo donde va **el punto ámbar** de "otra empresa" |

### 🔑 REGLAS NUEVAS
- **REVENTAR NO ES CAZAR.** Un test que se cae **no es** un test que encontró el bug.
  → Tres estados: **CAZADO · ESCAPADO · NO PROBADA.**
- **EL INSTRUMENTO LLEVA GUARDIA:** si el píxel medido no cuadra con el color declarado, **el que
  suspende es el instrumento**.
- **MEDIR SOBRE LA IMAGEN RENDERIZADA, no sobre el CSS.**
- **Preguntar por LA COSA CONCRETA** (esta celda, este puesto, este día) — **nunca "la primera
  que…"**.
- **NINGÚN TEST MIDE "SE ENTIENDE".** *Con los cuatro instrumentos en verde, se abrió la página y
  había dos cosas mal.* **Por eso la página se abre. Siempre.**

---

## 27. 📌 Pendientes actualizados

- [ ] **Push al cerrar cada tanda** ⚠️ *(el repo iba retrasado: si el trabajo no está en GitHub,
      para el portfolio NO EXISTE)*
- [ ] **RESPONSIVE** — el foco que se aplazó. *Web para quien GESTIONA; móvil para quien CONSULTA
      su turno → **dos vistas, no una que se encoge.***
- [ ] **Drag & drop + escritura + el CANDADO (TOCTOU).** ⚠️ Riesgo nº1 vivo.
- [ ] **Zona horaria por CALENDARIO** *(cambio de modelo)*
- [ ] ⚠️ **El INICIO DEL EJE (06:00) está CABLEADO.** Una panadería que entra a las 03:00 no encaja.
      Debe ser parámetro del calendario, en tramos de 24h: *"elige dónde empieza tu día"*, no
      *"elige tu rango"*.
- [ ] **El indicador de incidencias tendrá que llevar a algún sitio** (panel, modal, filtro)
- [ ] **Zooms Año y Mes** — necesitan **agregados**. *El Año no puede mandar 30.000 turnos uno a
      uno.*
- [ ] **Plantillas de >12 personas:** los colores se repiten. **No hay salida en "más colores"** —
      hay que decidir otra cosa.
- [ ] **Daltonismo:** la ley 6 está probada (toda gravedad lleva su palabra), pero **la paleta no
      se ha medido en escala de grises**.
- [ ] `/public/build` en `.gitignore` y Hostinger sin Node
- [ ] Páginas de error propias · resto de pantallas · landing
- [ ] **La demo final llevará UN AÑO ENTERO de cuadrantes** *(cargar la semana en curso y
      precargar las vecinas — ⚠️ pero eso NO sirve para el zoom Año: ahí el problema no es que
      tarde, es que **el contrato de datos es distinto**)*
