// Genera una paleta de personas con separación perceptual REAL. Ver docs/COTEJO-VISUAL.md.
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
  impossible: [[200,30,30],[176,20,20],[220,38,38]],
  breach: [[232,89,12],[168,65,10]],
  notice: [[194,135,10],[125,86,6]],
  ok: [[21,128,61]],
};

const ESTADO = Object.values(FAMILIA).flat();
const ajenos = (mia) => Object.entries(FAMILIA).filter(([k]) => k !== mia).flatMap(([, v]) => v);

/*
 * LA GEOMETRÍA REAL DE LA BARRA (ver PersonLane.vue). Aquí van CUATRO errores de modelo, y cada
 * uno costó una pasada: el que venga detrás no tiene por qué repetirlos.
 *
 * ERROR 1 — EL ANILLO SOLO SE PESABA ARRIBA Y ABAJO. El modelo decía 2w/(ALTO+2w). Falso: un
 * `outline` rodea la barra por LOS CUATRO LADOS.
 *
 * ERROR 2 — LA TRAMA NO ENTRABA. La barra imposible es TRAMADA: su relleno real lleva la trama
 * encima. Compararla contra el color PURO castigaba a la trama por hacer su trabajo.
 *
 * ERROR 3 — SE COMPARABA CONTRA SU PROPIA GRAVEDAD. Una barra imposible SE TIENE QUE parecer a un
 * rojo. Ver FAMILIA, arriba.
 *
 * ⚠️ ERROR 4 — Y ESTE ES EL GORDO: EL MODELO USABA UN ANCHO FIJO DE 50 px.
 *
 * Al corregir el error 1, el peso del anillo pasó a depender del ANCHO de la barra. Y yo metí el
 * ancho de un turno de 8 horas (50 px) como si fuera "el ancho". Resultado: LA PALETA SOLO
 * FUNCIONABA A ESE ANCHO EXACTO. Medido sobre la imagen, con el anillo rodeando:
 *
 *     barra de  5 px (1 h) → el anillo pesa 67 %  → el peor color queda a ΔE  5,8   ❌
 *     barra de 29 px (6 h) → pesa 40 %            → ΔE 17,5                         ❌
 *     barra de 50 px (8 h) → pesa 35 %            → ΔE 20,1                         ✅
 *     barra de 80 px       → pesa 32 %            → ΔE 19,9                         ❌
 *
 * Un turno de una hora con un aviso ámbar se veía MARRÓN. El bug de Marco, reencarnado — y esta
 * vez la causa no era el color: era que EL ANILLO CAMBIA DE PESO CON LA GEOMETRÍA, y un canal que
 * cambia de significado según lo ancha que sea la barra no es un canal: es una lotería.
 *
 * ⚠️ LA SOLUCIÓN NO ES OTRA PALETA: ES QUE EL ANILLO NO RODEE.
 *
 * Dos franjas, arriba y abajo, POR FUERA de la barra (box-shadow, que no come relleno). Su peso es
 * 2w/(ALTO+2w) y NO DEPENDE DEL ANCHO — 20 % / 27 % / 33 %, siempre. El problema del turno corto
 * desaparece POR CONSTRUCCIÓN, no por ajuste. Y de paso contamina MENOS que el anillo que rodeaba,
 * incluso en las barras anchas.
 *
 * El alto de la barra sigue siendo el parámetro que reparte el sitio: 8 → 10 → 12 → 16.
 */
const ALTO = 16;
const ANILLOS = [['notice', [194,135,10], 2], ['breach', [232,89,12], 3], ['impossible', [200,30,30], 4]];

// EL ANILLO SON DOS FRANJAS, ARRIBA Y ABAJO. No rodea, así que su peso NO depende del ancho.
const peso = (w) => (2*w) / (ALTO + 2*w);

// La trama del imposible: rgba(44,38,67,.30) con 3 px de raya cada 7.
const TRAMA = [44,38,67];
const PESO_TRAMA = 0.30 * 3/7;

const mezcla = (c, ring, f) => c.map((v,i) => v*(1-f) + ring[i]*f);

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
 */
/*
 * ⚠️ Y EL GENERADOR EXIGE 24, NO 20. Porque un mínimo no es un colchón.
 *
 * El umbral REAL de la ley 0 es 20 (lo comprueba pixeles.mjs sobre la imagen). Pero el modelo no
 * es exacto: no sabe de esquinas redondeadas, ni de antialiasing, ni del subpíxel. Cuando el
 * generador daba justo 20,0, la imagen medía 19,1 y la ley se rompía.
 *
 * Un generador que apunta al aprobado suspende. Se le pide 24 para que la imagen dé ≥ 20.
 */
const UMBRAL = 24;

const sonarA = (c) => Math.min(...ANILLOS.map(([g, ring, w]) => {
  const base = g === 'impossible' ? mezcla(c, TRAMA, PESO_TRAMA) : c;

  return Math.min(...ajenos(g).map((e) => dE(mezcla(base, ring, peso(w)), e)));
}));

// Candidatos: toda la zona FRÍA (azul → cian → índigo → violeta → ciruela), con luminosidad y
// croma variados. Nada de rojo/naranja/ámbar/verde: eso es del estado, y el estado no se toca.
const cand = [];
for (let r = 20; r <= 230; r += 6)
for (let g = 20; g <= 230; g += 6)
for (let b = 60; b <= 245; b += 6) {
  const [L, A, B] = lab([r,g,b]);
  const C = Math.hypot(A,B);
  let h = Math.atan2(B,A) * 180/Math.PI; if (h < 0) h += 360;
  if (L < 32 || L > 74) continue;

  // ⚠️ EL CROMA MÍNIMO SUBE DE 20 A 30. Con C ≥ 20 entraban #5C4460 (ciruela apagado, C 22) y
  // #927496 (gris violeta, C 20): colores SIN COLOR PROPIO. Un color de croma bajo no se
  // defiende — adopta el del vecino, y con un anillo ámbar al lado se vuelve marrón.
  if (C < 30 || C > 62) continue;

  // ⚠️ LA CAJA DE TONO SE ABRE, Y NO ES UNA RENDICIÓN: ES QUE YA NO HACE FALTA.
  //
  // Estaba en 222–346 (azul → magenta) como forma TOSCA de decir "no te acerques al rojo ni al
  // verde". Pero un recorte por tono no sabe nada de luminosidad ni de croma: dejaba entrar
  // ciruelas apagados que sí se confunden, y dejaba fuera cianes y verdeazules que no. Y encima
  // apretaba tanto la zona que los doce colores no cabían con holgura (ΔE mínimo 13,7, a un pelo
  // del umbral de "indistinguible").
  //
  // Ahora quien vigila es el MARGEN, que mide lo que de verdad pasa —la barra con su anillo— en
  // vez de dónde cae el tono. Con un policía que sabe medir, la caja puede ser grande.
  if (h < 186 || h > 350) continue;
  if (Math.min(...ESTADO.map((e) => dE([r,g,b], e))) < 28) continue;
  if (sonarA([r,g,b]) < UMBRAL) continue;
  cand.push([r,g,b]);
}

// Punto más lejano, con MUCHAS semillas: el voraz depende de por dónde empiece, así que se
// arranca desde muchos candidatos y se queda la mejor paleta. La métrica es el ΔE MÍNIMO: una
// paleta vale exactamente lo que valga su par más parecido.
const N = 12;

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
  let m = Infinity;
  for (let i=0;i<el.length;i++) for (let j=i+1;j<el.length;j++) m = Math.min(m, dE(el[i], el[j]));
  return { el, m };
};

let best = null;
for (let i = 0; i < cand.length; i += 89) {
  const r = construir(cand[i]);
  if (!best || r.m > best.m) best = r;
}

/**
 * ⚠️ Y AHORA SE MEJORA A MANO, PORQUE EL VORAZ NO ES ÓPTIMO.
 *
 * El punto-más-lejano elige bien los primeros y se queda sin sitio para los últimos: daba un ΔE
 * mínimo de 13,4 y el umbral de "indistinguible" está en 12. Un margen de 1,4 no es un margen.
 *
 * Búsqueda local: se coge el color que participa en el PAR PEOR y se prueba a cambiarlo por cada
 * candidato. Si alguno sube el mínimo, se cambia. Se repite hasta que ninguno lo suba. Es la
 * métrica correcta —una paleta vale lo que valga su par más parecido— optimizada de verdad.
 */
const minimoDe = (el) => {
  let m = Infinity, par = null;
  for (let i = 0; i < el.length; i++) for (let j = i+1; j < el.length; j++) {
    const d = dE(el[i], el[j]);
    if (d < m) { m = d; par = [i, j]; }
  }
  return { m, par };
};

let el = best.el.slice();
let { m: peor, par } = minimoDe(el);

for (let vuelta = 0; vuelta < 400; vuelta++) {
  let mejoro = false;

  for (const idx of par) {
    for (const c of cand) {
      const prueba = el.slice();
      prueba[idx] = c;
      const { m } = minimoDe(prueba);

      if (m > peor + 1e-9) {
        el = prueba;
        peor = m;
        mejoro = true;
      }
    }
  }

  ({ par } = minimoDe(el));
  if (!mejoro) break;
}

const elegidos = el;

const hex = ([r,g,b]) => '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
// Luminancia relativa, para decidir si la inicial va en blanco o en negro.
const lum = ([r,g,b]) => 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
const contra = (c, w) => { const a=lum(c), b= w? 1 : 0.0148; const [x,y]=[Math.max(a,b),Math.min(a,b)]; return (x+0.05)/(y+0.05); };

const peorSonido = Math.min(...elegidos.map(sonarA));

console.log('candidatos:', cand.length, '· ΔE mínimo entre personas:', peor.toFixed(1),
  '· lo más cerca que queda una barra de una gravedad AJENA:', peorSonido.toFixed(1));
console.log();
for (const c of elegidos) {
  const blanco = contra(c, true), negro = contra(c, false);
  console.log(`'${hex(c)}',  // L*${lab(c)[0].toFixed(0).padStart(2)}  C${Math.hypot(lab(c)[1],lab(c)[2]).toFixed(0).padStart(2)}  ajena ${sonarA(c).toFixed(0).padStart(2)}  → inicial en ${blanco >= negro ? 'BLANCO' : 'TINTA'}`);
}
