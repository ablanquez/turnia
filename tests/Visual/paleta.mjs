/**
 * GENERA LA PALETA DE PERSONAS. Y la garantía que da NO ES "los colores son distintos": es que
 * NINGUNA BARRA, PÍNTESE COMO SE PINTE, SE PARECERÁ MÁS A OTRA PERSONA QUE A LA SUYA.
 *
 * ⚠️ ESA ES LA DIFERENCIA ENTRE ESTA VERSIÓN Y LAS CUATRO ANTERIORES, Y ES TODA LA DIFERENCIA.
 *
 * Antes se elegían doce colores separados entre sí y se daba por hecho que las barras heredarían
 * esa separación. Y no la heredan: una barra NUNCA es su color pelado. Lleva encima una trama,
 * pegado un anillo de gravedad, y en el zoom Día un alfa. Cada uno de esos canales MUEVE el color,
 * y con doce colores a ΔE 13,8 unos de otros bastaba un empujón de 7 para que una barra cayese más
 * cerca de otra persona que de sí misma.
 *
 * Así que la paleta se diseña con una desigualdad triangular, y no con un gusto:
 *
 *     Si dos personas cualesquiera distan D, y CADA FORMA de pintar a una persona se queda dentro
 *     de un radio R de su propio color, entonces la barra pintada está a ≥ D − R de cualquier otra
 *     persona y a R de la suya. Gana la suya SI Y SOLO SI:
 *
 *                                    R  <  D / 2
 *
 * Se maximiza D. Se acota R. Y entonces la ley 2 no se cumple por suerte: se cumple por
 * construcción, para toda barra que exista y para las que todavía no.
 *
 *   node tests/Visual/paleta.mjs
 *
 * Ver docs/COTEJO-VISUAL.md y docs/MATRIZ-VISUAL.md.
 */
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lab = ([r,g,b]) => { const [R,G,B]=[lin(r),lin(g),lin(b)];
  const X=(R*0.4124+G*0.3576+B*0.1805)/0.95047, Y=(R*0.2126+G*0.7152+B*0.0722), Z=(R*0.0193+G*0.1192+B*0.9505)/1.08883;
  const f=(t)=>t>0.008856?Math.cbrt(t):7.787*t+16/116;
  return [116*f(Y)-16, 500*(f(X)-f(Y)), 200*(f(Y)-f(Z))]; };
const dE=(c1,c2)=>{const[L1,a1,b1]=lab(c1),[L2,a2,b2]=lab(c2);const rad=Math.PI/180,deg=180/Math.PI;
  const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cm=(C1+C2)/2;
  const G=0.5*(1-Math.sqrt(Cm**7/(Cm**7+25**7)));const ap1=(1+G)*a1,ap2=(1+G)*a2;
  const Cp1=Math.hypot(ap1,b1),Cp2=Math.hypot(ap2,b2);
  const hp=(b,ap)=>{if(b===0&&ap===0)return 0;const h=Math.atan2(b,ap)*deg;return h>=0?h:h+360;};
  const hp1=hp(b1,ap1),hp2=hp(b2,ap2);const dL=L2-L1,dC=Cp2-Cp1;
  let dh=0;if(Cp1*Cp2!==0){dh=hp2-hp1;if(dh>180)dh-=360;else if(dh<-180)dh+=360;}
  const dH=2*Math.sqrt(Cp1*Cp2)*Math.sin((dh/2)*rad);const Lm=(L1+L2)/2,Cpm=(Cp1+Cp2)/2;
  let hpm;if(Cp1*Cp2===0)hpm=hp1+hp2;else if(Math.abs(hp1-hp2)<=180)hpm=(hp1+hp2)/2;
  else hpm=hp1+hp2<360?(hp1+hp2+360)/2:(hp1+hp2-360)/2;
  const T=1-0.17*Math.cos((hpm-30)*rad)+0.24*Math.cos(2*hpm*rad)+0.32*Math.cos((3*hpm+6)*rad)-0.20*Math.cos((4*hpm-63)*rad);
  const dT=30*Math.exp(-(((hpm-275)/25)**2));const Rc=2*Math.sqrt(Cpm**7/(Cpm**7+25**7));
  const Sl=1+(0.015*(Lm-50)**2)/Math.sqrt(20+(Lm-50)**2),Sc=1+0.045*Cpm,Sh=1+0.015*Cpm*T;
  const Rt=-Math.sin(2*dT*rad)*Rc;
  return Math.sqrt((dL/Sl)**2+(dC/Sc)**2+(dH/Sh)**2+Rt*(dC/Sc)*(dH/Sh));};

// Lab → sRGB. Hace falta para OSCURECER un color sin cambiarle el tono (ver SOMBRA, abajo).
const inv=(t)=>t**3>0.008856?t**3:(t-16/116)/7.787;
const gam=(v)=>v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055;
const crudo=([L,A,B])=>{const fy=(L+16)/116,fx=fy+A/500,fz=fy-B/200;
  const X=inv(fx)*0.95047,Y=inv(fy),Z=inv(fz)*1.08883;
  return [3.2406*X-1.5372*Y-0.4986*Z, -0.9689*X+1.8758*Y+0.0415*Z, 0.0557*X-0.2040*Y+1.0570*Z];};
const cabe=(l)=>crudo(l).every(v=>v>=-0.0005&&v<=1.0005);
const rgbDeLab=(l)=>crudo(l).map(v=>Math.max(0,Math.min(255,gam(v)*255)));

/**
 * Los colores del ESTADO, AGRUPADOS POR FAMILIA. Y agruparlos importa.
 *
 * ⚠️ UNA BARRA IMPOSIBLE SE TIENE QUE PARECER A UN ROJO. ES UN IMPOSIBLE.
 *
 * El generador comparaba la barra vista contra TODOS los colores de estado, incluidos los de su
 * propia gravedad. Así que castigaba a la barra imposible por parecerse al rojo —o sea, por hacer
 * justo lo que tiene que hacer— y con la trama encima el candidato ni siquiera entraba: quedaban
 * 238 colores y el ΔE mínimo entre personas caía a 6,2. Estaba exigiendo que la alarma no sonara.
 *
 * Lo que hay que impedir es que una barra suene a una gravedad AJENA. Ésa es la pregunta que hizo
 * el usuario con los ojos: "la barra de Marco, que tiene un AVISO, ¿parece un INCUMPLIMIENTO?".
 */
const FAMILIA = {
  impossible: [[200,30,30],[176,20,20],[220,38,38],[247,201,201],[158,22,22]],
  breach: [[232,89,12],[168,65,10]],
  notice: [[194,135,10],[125,86,6],[239,224,192]],
  ok: [[21,128,61],[195,230,209],[15,92,44]],
};

const ESTADO = Object.values(FAMILIA).flat();
const ajenos = (mia) => Object.entries(FAMILIA).filter(([k]) => k !== mia).flatMap(([, v]) => v);

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ⚠️⚠️ LA LISTA DE COLORES SEMÁNTICOS ESTABA **INCOMPLETA**, Y ESE ERA EL AGUJERO ENTERO.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * La paleta se protegía de las TRES GRAVEDADES (rojo, naranja, ámbar) y del verde. Y nadie la había
 * medido nunca contra **los cuatro estados de la TIRA DE COBERTURA** — que se pinta A DOS PÍXELES
 * de las barras, justo debajo.
 *
 * Resultado: el exceso («sobra 1») estaba pintado con **la marca** (#7F77DD / #534AB7), que es un
 * índigo… y la zona fría es justo donde viven las personas, porque el rojo, el naranja, el ámbar y
 * el verde están reservados. **#534AB7 estaba a ΔE 2,2 de la persona 5 (#5844BC).** El «+1» se
 * pintaba con el color de alguien.
 *
 * El exceso ya no es índigo (pasó al ámbar del aviso: ver app.css). Pero la lección es la lista:
 *
 *     UN COLOR SEMÁNTICO ES **CUALQUIER COLOR QUE SIGNIFIQUE ALGO**, NO SOLO UNA GRAVEDAD.
 *
 * Y estos NO tienen familia —ninguna persona debe parecerse a ellos, jamás—, así que se excluyen
 * SIEMPRE, sin la excepción de «su propia gravedad».
 */
const SIEMPRE = [
  [239, 238, 244],   // «no se pide a nadie», relleno   ← ES un estado de la tira
  [201, 198, 214],   // «no se pide a nadie», borde
  [215, 212, 226],   // rayado del puesto sin candidato ← ES un estado de la tira
];

/**
 * ⚠️ LA MARCA VA APARTE, Y CON UN UMBRAL MÁS BAJO. Y ESO **NO ES RELAJAR: ES QUE LA PREGUNTA ES OTRA.**
 *
 * Meterla en `SIEMPRE` a ΔE 24 parecía lo riguroso, y HUNDE LA PALETA: de 50.641 candidatos quedan
 * 6.769 (`node tests/Visual/techo.mjs`), y las doce personas salen a **ΔE 2,5 unas de otras** — doce
 * cianes iguales. Peor que el bug que se venía a arreglar.
 *
 * La razón es geométrica: #7F77DD es un índigo medio-claro que cae **en el centro exacto de la zona
 * fría**, que es la única zona que les queda a las personas (el rojo, el naranja, el ámbar y el
 * verde son del estado). Ella sola se come el 84 % del espacio.
 *
 * Y el umbral de 24 existe para una pregunta muy concreta:
 *
 *     «¿PUEDE ESTA BARRA CONFUNDIRSE CON UN ESTADO DEL CUADRANTE?»
 *
 * **La marca no es un estado.** Está escrito desde hace tandas: *«la marca nunca se usa para estado,
 * y el estado nunca se usa para adornar»*. No compite con una barra por significar algo: no aparece
 * en la parrilla diciendo qué le pasa a nadie. El peligro real —el exceso pintado con `brand-600`,
 * a ΔE 2,2 de una persona— era **la ley rota**, no la paleta mal generada. Y ya está cortado.
 *
 * Lo único que sí hay que impedir es que una persona sea **INDISTINGUIBLE** de la marca (ΔE < 12):
 * un avatar del color exacto de un botón es una confusión de otro tipo, y esa sí es real.
 *
 * Dos umbrales, dos preguntas. Y los dos medidos, no elegidos a ojo.
 */
const MARCA = [
  [127, 119, 221],   // brand-300
  [ 83,  74, 183],   // brand-600
  [ 60,  52, 137],   // brand-800

  /*
   * ⚠️ Y LA ESTRUCTURA VA AQUÍ, NO EN `SIEMPRE`. POR EL MISMO MOTIVO Y CON LA MISMA MEDIDA.
   *
   * La pista, la celda alterna y la línea de sección son **FONDOS**. No significan nada del
   * cuadrante: no dicen si un turno incumple ni si falta gente. Exigirles ΔE 24 —el umbral de «no
   * puedes SONAR a un estado»— es contestar una pregunta que nadie ha hecho, y sale carísimo: con
   * ellos dentro de `SIEMPRE`, las doce personas caen a **ΔE 11,3 unas de otras**, o sea por debajo
   * del umbral de INDISTINGUIBLE. Se cambiaba un bug por otro.
   *
   * De un fondo lo que importa es que **la barra no DESAPAREZCA encima** — y eso ya se mide aparte,
   * y con su propio número: «lo más cerca que queda un color de su PISTA». Aquí basta con que ningún
   * color de persona sea INDISTINGUIBLE de un fondo.
   */
  [231, 229, 240],   // el fondo hundido de la pista
  [247, 246, 252],   // la celda alterna
  [195, 191, 214],   // la línea de sección
];

const NO_IGUAL = 8;   // «prácticamente el mismo color». Ver la tabla del bloque MARCA.

/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA GEOMETRÍA REAL DE LA BARRA (ver PersonLane.vue y useMatrizVisual.js).
 *
 * Aquí van SIETE errores de modelo, y cada uno costó una pasada. Todos tenían la misma forma —una
 * constante metida en el modelo que solo era cierta en el caso en que nació— y todos daban VERDE.
 * El que venga detrás no tiene por qué repetirlos.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ERROR 1 — EL ANILLO SOLO SE PESABA ARRIBA Y ABAJO. El modelo decía 2w/(ALTO+2w). Falso entonces:
 * un `outline` rodea la barra por LOS CUATRO LADOS.
 *
 * ERROR 2 — LA TRAMA NO ENTRABA. La barra imposible es TRAMADA: su relleno real lleva la trama
 * encima. Compararla contra el color PURO castigaba a la trama por hacer su trabajo.
 *
 * ERROR 3 — SE COMPARABA CONTRA SU PROPIA GRAVEDAD. Una barra imposible SE TIENE QUE parecer a un
 * rojo. Ver FAMILIA, arriba.
 *
 * ERROR 4 — EL MODELO USABA UN ANCHO FIJO DE 50 px. Al corregir el error 1, el peso del anillo pasó
 * a depender del ANCHO, y yo metí el de un turno de 8 h como si fuera "el ancho". La paleta SOLO
 * ERA CIERTA A ESE ANCHO: en un turno de UNA hora el anillo pesaba el 67 % y el peor color quedaba
 * a ΔE 5,8 de una gravedad ajena — un aviso ámbar se veía MARRÓN. La solución no fue otra paleta:
 * fue que EL ANILLO DEJE DE RODEAR (dos franjas, peso 2w/(ALTO+2w), independiente del ancho).
 *
 * ⚠️ ERROR 5 — LA TRAMA ERA UNA TINTA FIJA, Y ESO ES EL ERROR 4 OTRA VEZ, EN OTRO CANAL.
 *
 * La trama se pintaba con `rgba(44,38,67,.30)` — un índigo oscuro. Ese número se eligió cuando la
 * paleta era TODA índigo, así que se fundía con el relleno. Pero la paleta de hoy va del azul al
 * rosa y al turquesa, y sobre esos colores un índigo fijo ES UN COLOR AJENO. Medido:
 *
 *     la raya de Iker (rosa)  salía #AA589F  →  el color de BEA,   a ΔE 5
 *     la raya de Bea          salía #804892  →  el color de MARCO, a ΔE 7
 *     la raya de Nuria        salía #8087BC  →  el color de DIEGO, a ΔE 7
 *     la raya de Leo          salía #4987BC  →  el color de ANA,   a ΔE 6
 *
 * O sea: LA TRAMA PINTABA, DENTRO DE LA BARRA DE UNA PERSONA, EL COLOR DE OTRA. El canal de la
 * DENSIDAD estaba escribiendo en el canal de la IDENTIDAD — la ley 0, rota en el sitio donde nadie
 * miraba. Y en Marco, además, la raya quedaba a ΔE 4,4 de su propio relleno: INVISIBLE. Su barra
 * imposible parecía sólida, o sea "cubre el puesto", que es justo lo contrario de lo que es.
 *
 * Ahora la trama es LA SOMBRA DE LA PROPIA PERSONA: su color con L* − 22, mismo tono y mismo croma.
 * El canal de densidad ya no puede meter un color que la identidad no haya puesto — POR
 * CONSTRUCCIÓN, no por elegir bien la tinta.
 *
 * ⚠️ ERROR 6 — LA TRAMA SOLO ENTRABA EN EL MODELO PARA EL IMPOSIBLE. Y un CONCEPTO que computa
 * también va tramado (la hora extra de Iker). Su identidad no se medía en ningún sitio: pixeles.mjs
 * excluía las barras tramadas de la comparación entre personas "porque ya se miden en la ley 0" —
 * y la ley 0 pregunta por GRAVEDADES, no por PERSONAS. Un descarte con coartada sigue siendo un
 * descarte.
 *
 * ⚠️ ERROR 7 — LA PISTA NO ESTABA EN EL MODELO. Una barra se pinta SOBRE su pista (#E7E5F0), y
 * nadie comprobaba que se distinguiera de ella. Los dos colores más claros de la paleta anterior
 * quedaban a ΔE 20 del fondo sobre el que se pintan.
 */
const ALTO = 16;
const ANILLOS = [['notice', [194,135,10], 2], ['breach', [232,89,12], 3], ['impossible', [200,30,30], 4]];

// EL ANILLO SON DOS FRANJAS, ARRIBA Y ABAJO. No rodea, así que su peso NO depende del ancho.
const peso = (w) => (2*w) / (ALTO + 2*w);

const mezcla = (c, ring, f) => c.map((v,i) => v*(1-f) + ring[i]*f);

/**
 * LA SOMBRA: el color de la persona con L* − 22. MISMO TONO.
 *
 * ⚠️ Y SI NO CABE EN sRGB, SE LE BAJA EL CROMA — NO SE RECORTA. Recortar los canales a 0 MUEVE EL
 * TONO, que es justo lo que la trama no puede hacer. Lo cazó pixeles.mjs sobre la implementación
 * real: la raya de un teal oscuro se desviaba 16° de su relleno. Escalar a y b conserva el ángulo.
 *
 * El generador tiene que modelar ESTO, y no la versión ingenua: si el modelo y la página no hacen
 * la misma cuenta, la paleta está calculada para una app que no existe.
 */
const BAJADA = 22;

const sombra = (c) => {
  const [L, A, B] = lab(c);
  const objetivo = Math.max(0, L - BAJADA);

  if (cabe([objetivo, A, B])) return rgbDeLab([objetivo, A, B]);

  let dentro = 0, fuera = 1;
  for (let i = 0; i < 20; i++) {
    const k = (dentro + fuera) / 2;
    if (cabe([objetivo, A*k, B*k])) dentro = k; else fuera = k;
  }

  return rgbDeLab([objetivo, A*dentro, B*dentro]);
};

// La trama: 2 px de raya cada 8. El área rayada es 2/8 del relleno.
const AREA_TRAMA = 2/8;
const tramada = (c) => mezcla(c, sombra(c), AREA_TRAMA);

/** El fondo sobre el que se pinta toda barra: --color-sunken. */
const PISTA = [231, 229, 240];

/**
 * ⚠️ LA PRUEBA QUE ANTES NO SE HACÍA, Y ES LA ÚNICA QUE IMPORTA.
 *
 * El criterio original era "ningún color de persona a menos de ΔE 28 de un color de estado", y lo
 * cumplían los doce. Y la barra de Marco se veía MARRÓN igual, porque ese ΔE compara DOS PARCHES
 * AISLADOS y en una parrilla nada está aislado: una barra lleva PEGADO su anillo de gravedad, y el
 * ojo integra los dos.
 *
 * Así que se mide LO QUE SE VE —la barra con su anillo— y se exige un UMBRAL ABSOLUTO:
 *
 *     NINGUNA BARRA PUEDE QUEDAR A MENOS DE ΔE 20 DE UNA GRAVEDAD QUE NO ES LA SUYA.
 *
 * ⚠️ Y absoluto, NO relativo. La primera versión pedía que la barra se pareciera "más a su persona
 * que a una gravedad ajena", y eso acusaba a un inocente: una barra teal con anillo rojo queda a
 * ΔE 29,6 del naranja —lejísimos, no se confunde con nada— pero también lejos del teal, así que el
 * margen salía negativo. El umbral absoluto caza los tres casos reales (el marrón de Marco a
 * ΔE 11, el verde de Iker a 10,2, el magenta que se vuelve rojo a 17,2) y no acusa al que no.
 *
 * ⚠️ Y EL GENERADOR EXIGE 24, NO 20. Porque un mínimo no es un colchón: el modelo no sabe de
 * esquinas redondeadas, ni de antialiasing, ni del subpíxel. Cuando el generador daba justo 20,0,
 * la imagen medía 19,1 y la ley se rompía. Un generador que apunta al aprobado suspende.
 */
const UMBRAL = 24;

const sonarA = (c) => Math.min(
  // (a) La barra CON su anillo, contra las gravedades AJENAS. Una barra imposible se tiene que
  //     parecer a un rojo: lo que no puede es parecerse a un naranja.
  ...ANILLOS.map(([g, ring, w]) => {
    // La barra imposible es TRAMADA; las otras dos, lisas. Se mide cada una como se pinta.
    const base = g === 'impossible' ? tramada(c) : c;

    return Math.min(...ajenos(g).map((e) => dE(mezcla(base, ring, peso(w)), e)));
  }),

  /*
   * (b) ⚠️ Y CONTRA TODO LO DEMÁS QUE SIGNIFICA ALGO. Esto NO ESTABA, y es el agujero.
   *
   * La marca, los grises de «no se pide a nadie», el fondo hundido de la pista. Ninguna persona
   * puede parecerse a ninguno de ellos, **con anillo o sin él** — la barra LIMPIA (que no lleva
   * anillo) es justo la que más cerca está de la tira que tiene debajo.
   */
  ...SIEMPRE.map((e) => Math.min(dE(c, e), dE(tramada(c), e))),
);

/**
 * EL RADIO DE UNA PERSONA: lo MÁS que se aleja su barra de su propio color, pintándose como se
 * pinte. Hoy la única forma que mueve el relleno es la trama; el anillo va POR FUERA y no lo toca.
 *
 * Si mañana aparece otra —un alfa, un degradado, un patrón— ENTRA AQUÍ. Y si no entra, la garantía
 * R < D/2 deja de valer sin que nadie se entere, que es exactamente cómo llegamos hasta aquí.
 */
const radio = (c) => dE(tramada(c), c);

/*
 * LOS CANDIDATOS: toda la zona FRÍA (azul → cian → índigo → violeta → ciruela).
 *
 * Nada de rojo, naranja, ámbar ni verde: eso es del ESTADO, y el estado no se toca. La caja de tono
 * (186–350) es tosca a propósito y NO es la que vigila —quien vigila es sonarA(), que mide lo que
 * de verdad se ve—; está para que ninguna persona pueda salir de un color RESERVADO, que es una
 * regla del producto y no una consecuencia de un número.
 */
const cand = [];
for (let r = 8; r <= 248; r += 4)
for (let g = 8; g <= 248; g += 4)
for (let b = 40; b <= 252; b += 4) {
  const [L, A, B] = lab([r,g,b]);
  const C = Math.hypot(A,B);
  let h = Math.atan2(B,A) * 180/Math.PI; if (h < 0) h += 360;

  // La luminosidad es la señal que MÁS sobrevive a una barra de 16 px, así que se le da todo el
  // recorrido que el resto de las reglas permita.
  if (L < 30 || L > 78) continue;

  // ⚠️ EL CROMA MÍNIMO ES 30. Con C ≥ 20 entraban #5C4460 (ciruela apagado, C 22) y #927496 (gris
  // violeta, C 20): colores SIN COLOR PROPIO. Un color de croma bajo no se defiende — adopta el
  // del vecino, y con un anillo ámbar al lado se vuelve marrón.
  if (C < 30 || C > 75) continue;

  if (h < 186 || h > 350) continue;

  // Ni el color pelado ni la barra vista pueden sonar a un estado.
  if (Math.min(...ESTADO.map((e) => dE([r,g,b], e))) < 28) continue;
  if (sonarA([r,g,b]) < UMBRAL) continue;

  // ⚠️ Y NINGUNA PERSONA PUEDE SER **INDISTINGUIBLE** DE LA MARCA. Otra pregunta, otro umbral: ver
  // el bloque de MARCA arriba. A ΔE 24 esto hunde la paleta a doce cianes iguales; a ΔE 12 impide
  // lo único que de verdad confunde —un avatar del color exacto de un botón— y deja sitio.
  if (Math.min(...MARCA.map((e) => Math.min(dE([r,g,b], e), dE(tramada([r,g,b]), e)))) < NO_IGUAL) continue;

  // ⚠️ Y LA BARRA SE PINTA SOBRE LA PISTA. Un lavanda pálido sobre un fondo lavanda pálido es una
  // barra que no está.
  if (dE([r,g,b], PISTA) < 26) continue;

  // ⚠️ Y LA RAYA DE LA TRAMA TIENE QUE VERSE SOBRE SU PROPIO RELLENO. Si no, la trama no dice nada
  // y un bloque que NO CUBRE EL PUESTO se lee como sólido — un silencio falso. El umbral de la
  // imagen es 10; aquí se pide 14, porque un generador que apunta al aprobado suspende.
  if (dE(sombra([r,g,b]), [r,g,b]) < 14) continue;

  cand.push([r,g,b]);
}

/* ── Maximizar D (el ΔE mínimo entre dos personas cualesquiera) ─────────────────── */

const N = 12;

const minimoDe = (el) => {
  let m = Infinity, par = null;
  for (let i = 0; i < el.length; i++) for (let j = i+1; j < el.length; j++) {
    const d = dE(el[i], el[j]);
    if (d < m) { m = d; par = [i, j]; }
  }
  return { m, par };
};

// Punto más lejano, con MUCHAS semillas: el voraz depende de por dónde empiece. La métrica es el
// ΔE MÍNIMO — una paleta vale exactamente lo que valga su par más parecido.
const construir = (semilla) => {
  const el = [semilla];
  while (el.length < N) {
    let mejor = null, mejorD = -1;
    for (const c of cand) {
      const d = Math.min(...el.map((e) => dE(c, e)));
      if (d > mejorD) { mejorD = d; mejor = c; }
    }
    el.push(mejor);
  }
  return { el, m: minimoDe(el).m };
};

let best = null;
for (let i = 0; i < cand.length; i += Math.max(1, Math.floor(cand.length / 60))) {
  const r = construir(cand[i]);
  if (!best || r.m > best.m) best = r;
}

/**
 * ⚠️ Y AHORA SE MEJORA A MANO, PORQUE EL VORAZ NO ES ÓPTIMO.
 *
 * El punto-más-lejano elige bien los primeros y se queda sin sitio para los últimos. Búsqueda
 * local: se coge el color que participa en el PAR PEOR y se prueba a cambiarlo por cada candidato.
 * Si alguno sube el mínimo, se cambia. Se repite hasta que ninguno lo suba.
 */
let el = best.el.slice();
let { m: peor, par } = minimoDe(el);

for (let vuelta = 0; vuelta < 400; vuelta++) {
  let mejoro = false;

  for (const idx of par) {
    for (const c of cand) {
      const prueba = el.slice();
      prueba[idx] = c;
      const { m } = minimoDe(prueba);

      if (m > peor + 1e-9) { el = prueba; peor = m; mejoro = true; }
    }
  }

  ({ par } = minimoDe(el));
  if (!mejoro) break;
}

// Orden estable: por tono. El reparto es por id, así que dos personas seguidas cogen colores
// vecinos en el círculo — y son los que más se parecen. Se BARAJA en zigzag para separarlos.
const porTono = el.slice().sort((a, b) => {
  const t = (c) => { const [, A, B] = lab(c); let h = Math.atan2(B, A) * 180 / Math.PI; return h < 0 ? h + 360 : h; };
  return t(a) - t(b);
});

const elegidos = [];
for (let i = 0; i < N; i += 2) elegidos.push(porTono[i]);
for (let i = 1; i < N; i += 2) elegidos.push(porTono[i]);

/* ── El veredicto ──────────────────────────────────────────────────────────────── */

const hex = ([r,g,b]) => '#' + [r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
const lum = ([r,g,b]) => 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
const contra = (c, w) => { const a=lum(c), b= w? 1 : 0.0148; const [x,y]=[Math.max(a,b),Math.min(a,b)]; return (x+0.05)/(y+0.05); };

const D = peor;
const R = Math.max(...elegidos.map(radio));
const peorSonido = Math.min(...elegidos.map(sonarA));
const peorPista = Math.min(...elegidos.map((c) => dE(c, PISTA)));
const peorRaya = Math.min(...elegidos.map((c) => dE(sombra(c), c)));

console.log();
console.log(`candidatos: ${cand.length}`);
console.log();
console.log(`  D = ${D.toFixed(1)}   ΔE mínimo entre dos personas`);
console.log(`  R = ${R.toFixed(1)}   lo más que una barra se aleja de su propio color (hoy: la trama)`);
console.log();
console.log(`  ¿R < D/2?  ${R.toFixed(1)} < ${(D/2).toFixed(1)}  →  ${R < D/2 ? '✅ SÍ' : '❌ NO'}`);
console.log('     Si se cumple, NINGUNA barra —lisa o tramada— puede parecerse más a otra persona');
console.log('     que a la suya. No por suerte: por desigualdad triangular.');
console.log();
console.log(`  lo más cerca que queda una barra de una gravedad AJENA: ${peorSonido.toFixed(1)}  (umbral ${UMBRAL})`);
console.log(`  lo más cerca que queda un color de su PISTA (#E7E5F0):  ${peorPista.toFixed(1)}`);
console.log(`  la raya de la trama MENOS visible sobre su relleno:     ${peorRaya.toFixed(1)}`);
console.log();

for (const c of elegidos) {
  const blanco = contra(c, true), negro = contra(c, false);
  console.log(`'${hex(c)}',  // L*${lab(c)[0].toFixed(0).padStart(2)}  C${Math.hypot(lab(c)[1],lab(c)[2]).toFixed(0).padStart(2)}  ajena ${sonarA(c).toFixed(0).padStart(2)}  R ${radio(c).toFixed(1)}  → inicial en ${blanco >= negro ? 'BLANCO' : 'TINTA'}`);
}

console.log();

if (R >= D/2) {
  console.log('❌ LA GARANTÍA NO SE CUMPLE. Con este R, hay barras que se parecen más a otra persona');
  console.log('   que a la suya. O sube D, o baja R (menos área de trama, o una sombra más suave).');
  process.exit(1);
}
