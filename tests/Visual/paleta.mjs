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

// Los colores del ESTADO: ninguna persona puede parecerse a ellos.
const ESTADO = [[200,30,30],[232,89,12],[194,135,10],[21,128,61],[220,38,38]];

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
  if (C < 20 || C > 62) continue;
  if (h < 222 || h > 346) continue;
  if (Math.min(...ESTADO.map((e) => dE([r,g,b], e))) < 28) continue;
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

const elegidos = best.el;
const peor = best.m;

const hex = ([r,g,b]) => '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
// Luminancia relativa, para decidir si la inicial va en blanco o en negro.
const lum = ([r,g,b]) => 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
const contra = (c, w) => { const a=lum(c), b= w? 1 : 0.0148; const [x,y]=[Math.max(a,b),Math.min(a,b)]; return (x+0.05)/(y+0.05); };

console.log('candidatos:', cand.length, '· ΔE mínimo de la paleta:', peor.toFixed(1));
console.log();
for (const c of elegidos) {
  const blanco = contra(c, true), negro = contra(c, false);
  console.log(`'${hex(c)}',  // L*${lab(c)[0].toFixed(0).padStart(2)}  blanco ${blanco.toFixed(1)}:1  tinta ${negro.toFixed(1)}:1 → ${blanco >= negro ? 'BLANCO' : 'TINTA'}`);
}
