
import * as THREE from '../vendor/three/build/three.module.js';
import { EffectComposer } from '../vendor/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../vendor/three/examples/jsm/postprocessing/ShaderPass.js';

const PC=window.PARK_CONTENT;
const LANG=window.PARK_LANG||'en';
const L=(zh,en)=>LANG==='zh'?zh:en;

/* ============================================================
   0 · CONSTANTS, PALETTE, CAPABILITY
   ============================================================ */
const C = {
  cream:0xf2e9d8, parchment:0xfbf6ea, paper:0xf1e7d2,
  sage:0x9dad8a, moss:0x748c66, forest:0x4d6b4c, deepforest:0x3a5340,
  red:0xb45248, redDark:0x8e3f38, blue:0x7b93a9, blueDark:0x5c7288,
  butter:0xe6c876, terracotta:0xbd7355, brass:0xa9884d, brassDark:0x7d6534,
  ink:0x2a2520, stone:0xbdb2a0, water:0x6d8698, sand:0xd8c9a8,
  burgundy:0x6b2e32, amber:0xeaa94e
};
const MOBILE = matchMedia('(max-width:900px), (pointer:coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
const FORCE_LITE = new URLSearchParams(location.search).get('lite3d')==='1';
const DEVICE_LITE = (navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||(navigator.deviceMemory&&navigator.deviceMemory<=4);
let COMPAT_3D = FORCE_LITE||DEVICE_LITE||REDUCED;
window.__parkDiagnostics={
  forceLite:FORCE_LITE,deviceLite:!!DEVICE_LITE,reducedMotion:REDUCED,mobile:MOBILE,
  hardwareConcurrency:navigator.hardwareConcurrency||null,deviceMemory:navigator.deviceMemory||null,
  devicePixelRatio:window.devicePixelRatio||1,userAgent:navigator.userAgent
};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const easeOutCubic=t=>1-Math.pow(1-t,3);
const easeInOut=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

/* ============================================================
   1 · RENDERER, SCENE, CAMERA
   ============================================================ */
const stage=document.getElementById('stage');
let renderer, rendererAttempt='quality';
function createParkRenderer(lite){
  const canvas=document.createElement('canvas');
  const options=lite
    ? {canvas,antialias:false,alpha:false,powerPreference:'default',precision:'mediump',failIfMajorPerformanceCaveat:false}
    : {canvas,antialias:!MOBILE,alpha:false,powerPreference:'high-performance',failIfMajorPerformanceCaveat:false};
  return new THREE.WebGLRenderer(options);
}
try{
  rendererAttempt=COMPAT_3D?'compatibility':'quality';
  renderer=createParkRenderer(COMPAT_3D);
}catch(primaryError){
  if(!COMPAT_3D){
    try{
      COMPAT_3D=true; rendererAttempt='compatibility-after-quality-failure';
      renderer=createParkRenderer(true);
    }catch(compatError){
      window.__parkShowFailure('webgl',compatError?.message||primaryError?.message||'renderer creation failed');
      throw compatError;
    }
  }else{
    window.__parkShowFailure('webgl',primaryError?.message||'renderer creation failed');
    throw primaryError;
  }
}
renderer.setPixelRatio(COMPAT_3D?1:Math.min(devicePixelRatio,MOBILE?1.35:1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=!COMPAT_3D;
renderer.shadowMap.type=MOBILE?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.domElement.addEventListener('webglcontextlost',e=>{
  e.preventDefault(); window.__parkShowFailure('context-lost','GPU context lost while rendering');
},{once:true});
stage.appendChild(renderer.domElement);
window.__parkRendererReady=true;
window.__parkRenderMode=COMPAT_3D?'compatibility':'quality';
Object.assign(window.__parkDiagnostics,{rendererAttempt,renderMode:window.__parkRenderMode,rendererReady:true});

const scene=new THREE.Scene();
scene.fog=new THREE.Fog(C.cream,210,720);

const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.5,3000);

/* --- controlled orbit rig: the visitor may lean and turn, never wander --- */
const rig={
  // current + target spherical coords around a target point
  az:0, azT:0, pol:0.86, polT:0.86, dist:96, distT:96,
  tgt:new THREE.Vector3(0,5,0), tgtT:new THREE.Vector3(0,5,0),
  azMin:-0.85, azMax:0.85, polMin:0.52, polMax:1.20, distMin:46, distMax:230,
  free:false
};
const OVERVIEW={az:0.12, pol:1.09, dist:MOBILE?250:215, tgt:new THREE.Vector3(2,16,2)};
// where the intro actually lands you: close enough to read the park, not the whole valley
const ARRIVAL={az:0.20, pol:1.22, dist:MOBILE?112:84, tgt:new THREE.Vector3(9,7,14)};
// how far the look-at point may roam from park centre while panning
const PAN_LIMIT=MOBILE?70:96;
function setRigLimits(o){ Object.assign(rig,o); }
function applyRig(){
  const sp=new THREE.Spherical(rig.dist, rig.pol, rig.az);
  const p=new THREE.Vector3().setFromSpherical(sp).add(rig.tgt);
  camera.position.copy(p);
  camera.lookAt(rig.tgt);
}

/* ============================================================
   2 · SKY, SUN, WORLD STATES
   ============================================================ */
const skyUniforms={
  topColor:{value:new THREE.Color(0xa9c3d6)},
  midColor:{value:new THREE.Color(0xf0e6d2)},
  botColor:{value:new THREE.Color(0xe8dcc4)},
  offset:{value:.055}, exponent:{value:.66},
  // stars and aurora live in the dome itself, so they are visible from any camera angle
  uStars:{value:0}, uDream:{value:0}, uTime:{value:0},
  aurA:{value:new THREE.Color(0x8ee6d0)}, aurB:{value:new THREE.Color(0xc79ae8)}
};
const sky=new THREE.Mesh(
  new THREE.SphereGeometry(1200,96,48),
  new THREE.ShaderMaterial({
    uniforms:skyUniforms, side:THREE.BackSide, depthWrite:false,
    vertexShader:`varying vec3 vW; void main(){ vW=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`
      uniform vec3 topColor,midColor,botColor,aurA,aurB;
      uniform float offset,exponent,uStars,uDream,uTime;
      varying vec3 vW;
      float hash(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){
        float h=vW.y*.5+.5;
        float t=pow(clamp((h-offset)/(1.-offset),0.,1.),exponent);
        float b=pow(clamp((offset-h)/offset,0.,1.),.8);
        vec3 col=mix(midColor,topColor,t);
        col=mix(col,botColor,b);

        vec3 d=normalize(vW);
        // wherever this dome pixel survives depth testing it reads as sky, so no horizon mask
        float above=1.;

        // ---- stars: two densities of hashed points across the dome ----
        if(uStars>.001){
          float sAll=0.; float glow=0.;
          for(int L=0;L<3;L++){
            float fl=float(L);
            // rotate each shell so the cubic lattice never reads as aligned blocks
            float ca=cos(.7+fl*1.3), sa=sin(.7+fl*1.3);
            vec3 dr=vec3(d.x*ca-d.z*sa, d.y, d.x*sa+d.z*ca);
            dr=vec3(dr.x, dr.y*ca-dr.z*sa, dr.y*sa+dr.z*ca);
            float sc = L==0 ? 132. : (L==1 ? 208. : 320.);
            float thr= L==0 ? .74 : (L==1 ? .82 : .89);
            float rad= L==0 ? .17 : (L==1 ? .14 : .11);
            float amp= L==0 ? 1.  : (L==1 ? .70 : .46);
            vec3 sp=dr*sc; vec3 cell=floor(sp); vec3 fr=fract(sp);
            vec3 c=vec3(hash(cell),hash(cell+7.13),hash(cell+13.77));
            float pick=step(thr,hash(cell+3.71));
            float dd=length(fr-c);
            float tw=.66+.34*sin(uTime*1.5+hash(cell+21.3)*30.);
            float core=pow(smoothstep(rad,0.,dd),1.5);
            sAll+=core*pick*tw*amp;
            glow+=pow(smoothstep(rad*1.7,0.,dd),2.4)*pick*tw*amp*.26;
          }
          vec3 sc2=mix(vec3(.99,.99,1.),vec3(.85,.90,1.),.4);
          col+=sc2*(sAll*2.5+glow)*uStars*(1.+uDream*.85)*above;
        }

        col+=(hash(d*911.7)-.5)*(2.2/255.);   // dither away gradient banding
        gl_FragColor=vec4(col,1.);
      }`
  })
);
sky.renderOrder=-1; scene.add(sky);

const hemi=new THREE.HemisphereLight(0xdfeaf2,0x6d7a5e,.9); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff0d6,2.1);
sun.position.set(-46,60,42);
sun.castShadow=true;
const SM=MOBILE?1024:2048;
sun.shadow.mapSize.set(SM,SM);
sun.shadow.camera.left=-72; sun.shadow.camera.right=72;
sun.shadow.camera.top=72; sun.shadow.camera.bottom=-72;
sun.shadow.camera.near=1; sun.shadow.camera.far=200;
sun.shadow.bias=-0.0012; sun.shadow.normalBias=0.03;
scene.add(sun);
const ambient=new THREE.AmbientLight(0xfff3dd,.3); scene.add(ambient);
const fill=new THREE.DirectionalLight(0xcadcea,.32); fill.position.set(40,26,-38); scene.add(fill);
const moonGlow=new THREE.PointLight(0xffd79a,0,0); // becomes the ferris wheel's spill at night
moonGlow.position.set(-13,17,-27); scene.add(moonGlow);
// a soft skydome fill so the park never becomes a black hole at night
const nightFill=new THREE.HemisphereLight(0x6f86bb,0x3d4657,0); scene.add(nightFill);
const circusGlow=new THREE.PointLight(0xffc98a,0,0); circusGlow.position.set(-25,7,-4); scene.add(circusGlow);
const gateGlow=new THREE.PointLight(0xffcb85,0,0); gateGlow.position.set(0,7,25); scene.add(gateGlow);
/* one warm pool per outer zone: at night a lit place should light its own ground */
const zoneGlows=[
  {light:new THREE.PointLight(0xffcf92,0,0), pos:[26,7,18],   zone:'buildings', mul:60, dist:51}, // carousel
  {light:new THREE.PointLight(0xffd09a,0,0), pos:[-40,6,32],  zone:'buildings', mul:45, dist:45}, // garden
  {light:new THREE.PointLight(0xffd4a4,0,0), pos:[44,8,36],   zone:'buildings', mul:42, dist:42}, // globe
  {light:new THREE.PointLight(0xfff0cc,0,0), pos:[66,8,12],   zone:'circus',    mul:60, dist:51}, // futureland
  {light:new THREE.PointLight(0x9fe8c4,0,0), pos:[-46,5,4],   zone:'buildings', mul:48, dist:42}, // arcade CRTs
  {light:new THREE.PointLight(0xffc98a,0,0), pos:[-24,5,-29], zone:'buildings', mul:42, dist:39}, // prizes
  {light:new THREE.PointLight(0xffe6bd,0,0), pos:[-33,6,58],  zone:'buildings', mul:45, dist:45}, // gallery
  {light:new THREE.PointLight(0xffd9a8,0,0), pos:[50,6,-26],  zone:'coaster',   mul:36, dist:39}  // graveyard
];
zoneGlows.forEach(g=>{ g.light.position.set(...g.pos); scene.add(g.light); });

const STATES={
  day:{
    top:0x5fa8de, mid:0x9fd0f2, bot:0xf6e9d8,
    fog:0xe4eef6, fogNear:280, fogFar:900,   // crisper ridgeline, less grey haze
    sunPos:[-38,74,52], sunColor:0xfff2d2, sunI:2.5,
    hemiSky:0xe4eff7, hemiGround:0x9fa894, hemiI:1.45,
    fillI:.42, exposure:1.18, bloom:.22, bulb:.06, star:0, vig:.18, sat:1.10
  },
  sunset:{
    top:0x6f7fa8, mid:0xf0a878, bot:0xf3c58e,
    fog:0xe8bd9a, fogNear:185, fogFar:680,
    sunPos:[-70,17,26], sunColor:0xffb877, sunI:2.4,
    hemiSky:0xf3cba6, hemiGround:0x7d6a54, hemiI:1.05,
    fillI:.32, exposure:1.16, bloom:.46, bulb:.55, star:.12, vig:.3, sat:1.05
  },
  night:{
    top:0x141d3d, mid:0x28376b, bot:0x4a5486,
    fog:0x24304c, fogNear:170, fogFar:640,
    sunPos:[38,58,-24], sunColor:0xb2c4e6, sunI:1.42,
    hemiSky:0x5d73a4, hemiGround:0x3a4356, hemiI:1.25,
    fillI:.42, exposure:1.28, bloom:.9, bulb:1, star:1, vig:.4, sat:.96
  }
};

/* ==== part3_terrain ==== */
/* ============================================================
   3 · MATERIAL LIBRARY — painted wood, aged brass, canvas, paper
   Tiny imperfections come from a shared procedural blemish map.
   ============================================================ */
function noiseTexture(size, amount, tint){
  const cv=document.createElement('canvas'); cv.width=cv.height=size;
  const ctx=cv.getContext('2d');
  ctx.fillStyle=tint||'#ffffff'; ctx.fillRect(0,0,size,size);
  const img=ctx.getImageData(0,0,size,size), d=img.data;
  for(let i=0;i<d.length;i+=4){
    const n=(Math.random()-.5)*amount;
    d[i]=clamp(d[i]+n,0,255); d[i+1]=clamp(d[i+1]+n,0,255); d[i+2]=clamp(d[i+2]+n,0,255);
  }
  ctx.putImageData(img,0,0);
  // a few faint scuffs
  ctx.globalAlpha=.05; ctx.strokeStyle='#000';
  for(let i=0;i<26;i++){
    ctx.beginPath();
    ctx.moveTo(Math.random()*size,Math.random()*size);
    ctx.lineTo(Math.random()*size,Math.random()*size);
    ctx.lineWidth=Math.random()*1.6; ctx.stroke();
  }
  const t=new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
const grainTex=noiseTexture(128,26,'#ffffff'); grainTex.repeat.set(3,3);
const canvasTex=(()=>{ const t=noiseTexture(128,34,'#ffffff'); t.repeat.set(2,2); return t; })();

function mat(hex,opts={}){
  return new THREE.MeshStandardMaterial({
    color:hex, roughness:opts.rough??.82, metalness:opts.metal??0,
    map:opts.map!==false?grainTex:null,
    flatShading:!!opts.flat,
    side:opts.side||THREE.FrontSide,
    transparent:!!opts.transparent, opacity:opts.opacity??1
  });
}
const M={
  woodCream:mat(C.cream,{rough:.86}),
  woodPaper:mat(C.paper,{rough:.88}),
  woodRed:mat(C.red,{rough:.8}),
  woodRedDark:mat(C.redDark,{rough:.82}),
  woodBlue:mat(C.blue,{rough:.8}),
  woodBlueDark:mat(C.blueDark,{rough:.8}),
  woodGreen:mat(C.forest,{rough:.84}),
  woodMoss:mat(C.moss,{rough:.86}),
  woodSage:mat(C.sage,{rough:.86}),
  terracotta:mat(C.terracotta,{rough:.84}),
  brass:mat(C.brass,{rough:.42,metal:.72}),
  brassDark:mat(C.brassDark,{rough:.5,metal:.68}),
  ironDark:mat(0x3d3a34,{rough:.6,metal:.4}),
  stone:mat(C.stone,{rough:.9}),
  ink:mat(C.ink,{rough:.7}),
  grass:mat(0x6f8358,{rough:.95}),
  grassDark:mat(0x6a7d57,{rough:.95}),
  pathSand:mat(C.sand,{rough:.95}),
  burgundy:mat(C.burgundy,{rough:.8}),
  butter:mat(C.butter,{rough:.74}),
  canvasWhite:new THREE.MeshStandardMaterial({color:C.parchment,roughness:.94,map:canvasTex}),
  canvasRed:new THREE.MeshStandardMaterial({color:C.red,roughness:.92,map:canvasTex}),
  canvasBlue:new THREE.MeshStandardMaterial({color:C.blue,roughness:.92,map:canvasTex}),
  canvasSage:new THREE.MeshStandardMaterial({color:C.sage,roughness:.92,map:canvasTex}),
  wool:mat(0xf6f1e4,{rough:.96,flat:true}),
  water:new THREE.MeshStandardMaterial({color:C.water,roughness:.16,metalness:.34,transparent:true,opacity:.9})
};

/* emissive things (bulbs, signs, windows) register here so LIGHTS ON can
   cascade through the park in a real sequence instead of a CSS filter */
const LAMPS=[]; // {mesh, mat, color, intensity, zone, order}
function emissive(color,intensity,size,zone,order,shape){
  const m=new THREE.MeshStandardMaterial({
    color:0xfff6e0, emissive:new THREE.Color(color), emissiveIntensity:0,
    roughness:.35, metalness:0, toneMapped:true
  });
  const geo=shape==='box'?new THREE.BoxGeometry(size,size*.6,size*.15)
    :shape==='tube'?new THREE.CylinderGeometry(size*.4,size*.4,size*2.4,7)
    :new THREE.SphereGeometry(size,7,6);
  const mesh=new THREE.Mesh(geo,m);
  LAMPS.push({mesh,mat:m,color:new THREE.Color(color),intensity,zone:zone||'misc',order:order||0,lit:0});
  return mesh;
}

/* ============================================================
   4 · GROUND — a diorama base plate, not an infinite plane
   ============================================================ */
const world=new THREE.Group(); scene.add(world);

// gentle rolling terrain, sculpted with a few sine hills
const GW=170, GS=MOBILE?54:82;
/* The park disc and the outer skirt meet along one shared edge. They must chord
   the SAME curve at the SAME rate: with different segment counts each polyline
   approximates the wobble differently, the skirt's edge pokes outside the disc's,
   and the slit between them shows the sky through the ground as a blue seam.
   One segment count and one wobble function for both, so the join is watertight. */
const SEAM_SEG=MOBILE?72:128;
const seamWobble=th=>1+(Math.sin(th*3.1)*.030+Math.sin(th*5.7+1.3)*.018+Math.sin(th*8.3)*.010);
const groundGeo=new THREE.CircleGeometry(GW*.60,SEAM_SEG,1,0,Math.PI*2);
// subdivide the disc so terrain sculpting has vertices to work with
(function tessellate(){
  const rings=MOBILE?16:26, seg=SEAM_SEG;
  const verts=[],idx=[],uvs=[];
  for(let r=0;r<=rings;r++){
    const rt=r/rings, rad=rt*GW*.60;
    for(let a=0;a<=seg;a++){
      const th=(a/seg)*Math.PI*2;
      // the rim wanders with the same curve the skirt uses, so they interlock
      const wob=1+(seamWobble(th)-1)*rt*rt;
      const rad2=rad*wob;
      const x=Math.cos(th)*rad2, z=Math.sin(th)*rad2;
      verts.push(x,0,z);
      uvs.push(x/24,z/24);
    }
  }
  for(let r=0;r<rings;r++){
    for(let a=0;a<seg;a++){
      const o=r*(seg+1)+a, o2=(r+1)*(seg+1)+a;
      idx.push(o,o+1,o2, o+1,o2+1,o2);
    }
  }
  groundGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  groundGeo.setIndex(idx);
  groundGeo.deleteAttribute('normal'); groundGeo.deleteAttribute('uv');
  groundGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
})();
const pos=groundGeo.attributes.position;
function terrainH(x,z){
  let h=Math.sin(x*.045)*1.2+Math.cos(z*.052)*1.1+Math.sin((x+z)*.028)*.9;
  h+=Math.sin(x*.13)*.28+Math.cos(z*.17)*.24;
  // flatten the central promenade so paths and buildings sit true
  const spine=Math.exp(-Math.pow((x-0)/26,2))*Math.exp(-Math.pow((z-6)/44,2));
  h*=1-spine*.72;
  // pond basin, south-east
  const d=Math.hypot(x-44,z-40);
  if(d<15) h-=Math.cos(clamp(d/15,0,1)*Math.PI/2)*3.6;
  // the plateau settles toward its rim so the horizon stays level
  const rr=Math.hypot(x,z);
  h*=1-clamp((rr-40)/44,0,1)*.85;
  h-=clamp((rr-62)/40,0,1)*2.2;
  return h;
}
for(let i=0;i<pos.count;i++){
  const x=pos.getX(i), z=pos.getZ(i);
  pos.setY(i, terrainH(x,z));
}
groundGeo.computeVertexNormals();
// paint grass with subtle patchiness via vertex colors
const gcol=[];
for(let i=0;i<pos.count;i++){
  const x=pos.getX(i), z=pos.getZ(i);
  const p=Math.sin(x*.21)*Math.cos(z*.19)*.5+.5;
  const edge=clamp((Math.hypot(x,z)-52)/72,0,1);   // gentler, never fully dark at the rim
  // two-tone turf: mown promenade lighter, rough grass darker, plus dry patches
  const q=Math.sin(x*.075+z*.06)*.5+.5;
  const c=new THREE.Color().setHSL(
    lerp(.225,.185,p*.6+q*.4), lerp(.17,.11,q), lerp(.44,.55,p*.55+q*.45),
    THREE.SRGBColorSpace);
  c.lerp(new THREE.Color(0x8b9673), edge*.20);
  // faint worn earth where the promenade widens
  const worn=Math.exp(-Math.pow(Math.hypot(x*.9,(z-8)*.42)/17,2));
  c.lerp(new THREE.Color(0xc4b894), worn*.3);
  gcol.push(c.r,c.g,c.b);
}
groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(gcol,3));
const ground=new THREE.Mesh(groundGeo,new THREE.MeshStandardMaterial({
  vertexColors:true, roughness:.96, map:grainTex
}));
ground.receiveShadow=true; world.add(ground);

/* a snow blanket that shares the terrain's silhouette and fades in with the
   weather — cheaper and more controllable than re-tinting vertex colours */
const snowBlanket=new THREE.Mesh(groundGeo.clone(),new THREE.MeshStandardMaterial({
  color:0xeef3f6, roughness:.78, metalness:0,
  transparent:true, opacity:0, depthWrite:true, flatShading:false
}));
snowBlanket.position.y=.05;
snowBlanket.visible=false;
world.add(snowBlanket);

/* 4b · THE WORLD BEYOND — the park is a place in a landscape, not an object
   on a table. Concentric skirts + receding ridgelines carry the eye to the
   horizon so the world reads as continuing past what you can visit. */
const beyond=new THREE.Group(); world.add(beyond);
/* outer world materials, so distant hills/trees react to time & weather like the park does */
const BEYOND_MATS=[];
let SKIRT_SNOW=null;   // outer-country snow blanket, driven with the park's

// outer skirt: continues the turf past the park, falling away gently
{
  /* R0 tucks just inside the disc edge: the rings overlap by a hair rather than
     butting against each other, so nothing can show through between them. */
  const R0=GW*.60*.985, R1=GW*4.4, rings=MOBILE?14:22, seg=SEAM_SEG;
  const pos=[],col=[],idx=[],uvs=[];
  for(let r=0;r<=rings;r++){
    const t=r/rings, rad=lerp(R0,R1,t*t*.85+t*.15);
    for(let a=0;a<=seg;a++){
      const th=(a/seg)*Math.PI*2;
      // break the perfect circle: the join wanders in and out like a real treeline
      const wob=1+(seamWobble(th)-1)*Math.pow(1-t,1.5);
      const rad2=rad*wob;
      const x=Math.cos(th)*rad2, z=Math.sin(th)*rad2;
      // rolling country, sinking slowly so distant land sits below the park
      const roll=Math.sin(th*2.3+rad2*.03)*2.4+Math.sin(th*4.1-rad2*.02)*1.5;
      const ft=Math.max(0,(t-.20)/.80);
      const fall=-ft*ft*168;
      // near the join, sit exactly on the park's own terrain so there is no lip;
      // let go of it gradually as the country takes over
      const joinR=GW*.60;
      const w=1-Math.min(1,Math.max(0,(rad2-joinR*.98)/(joinR*.55)));
      const hTer=terrainH(x,z);
      const country=fall+roll*(1-t*.35)*Math.min(1,Math.max(0,(t-.30)*4.0))-1.2;
      /* The rings overlap by 1.5% of the radius. Where they do, drop the skirt a
         few centimetres so the two surfaces are never coplanar — coplanar faces
         at this distance z-fight into a flickering ring, which reads as exactly
         the hard edge the overlap is meant to remove. Under the disc, so the
         park's own turf is what you see. */
      const tuck=-0.06*Math.min(1,Math.max(0,(w-0.55)/0.45));
      pos.push(x, country*(1-w)+hTer*w+tuck, z);
      // greens desaturate and cool with distance — aerial perspective
      const c=new THREE.Color().setHSL(
        lerp(.200,.265,t), lerp(.17,.075,t), lerp(.475,.64,t), THREE.SRGBColorSpace);
      // match the park's weathered rim colour where the two meet
      c.lerp(new THREE.Color(0x8b9673), w*.42);
      col.push(c.r,c.g,c.b);
      uvs.push(x/24,z/24);
    }
  }
  for(let r=0;r<rings;r++) for(let a=0;a<seg;a++){
    const o=r*(seg+1)+a, o2=(r+1)*(seg+1)+a;
    idx.push(o,o+1,o2, o+1,o2+1,o2);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(idx); g.computeVertexNormals();
  const skirt=new THREE.Mesh(g,new THREE.MeshStandardMaterial({
    vertexColors:true, roughness:.97, metalness:0, map:grainTex}));
  skirt.receiveShadow=false; beyond.add(skirt);
  if(skirt.material){ skirt.material.__base=skirt.material.color?skirt.material.color.clone():null; BEYOND_MATS.push(skirt.material); }
  // a matching blanket over the outer country, so the snow line isn't a hard ring
  const gSnow=g.clone();
  // vertex alpha: full white at the park edge, feathering out into the distance
  {
    const sp=gSnow.attributes.position, sc=[];
    for(let i=0;i<sp.count;i++){
      const rr=Math.hypot(sp.getX(i),sp.getZ(i));
      const k=1-Math.min(1,Math.max(0,(rr-GW*1.5)/(GW*2.2)));
      sc.push(k,k,k);
    }
    gSnow.setAttribute('color',new THREE.Float32BufferAttribute(sc,3));
  }
  const skirtSnow=new THREE.Mesh(gSnow,new THREE.MeshStandardMaterial({
    color:0xeef3f6, roughness:.80, metalness:0, transparent:true, opacity:0,
    depthWrite:true, vertexColors:true}));
  skirtSnow.position.y=.05; skirtSnow.visible=false; beyond.add(skirtSnow);
  SKIRT_SNOW=skirtSnow;
}

// receding ridgelines: four bands of hills, each paler and flatter than the last
{
  const drop=d=>{ const t=(d-GW*.44)/(GW*3.96); const ft=Math.max(0,(t-.20)/.80); return -ft*ft*168-1.2; };
  const bands=[
    {d:GW*1.55, h:26, n:13, c:0x8b9c81, o:1.00},
    {d:GW*2.25, h:40, n:11, c:0x99a891, o:0.92},
    {d:GW*3.10, h:58, n:10, c:0xa6b3a6, o:0.80},
    {d:GW*4.05, h:78, n:9,  c:0xb4bfba, o:0.64}
  ];
  bands.forEach((b,bi)=>{
    const m=new THREE.MeshStandardMaterial({
      color:b.c, roughness:.99, metalness:0, transparent:true, opacity:b.o,
      fog:true, flatShading:true});
    m.__base=m.color.clone(); BEYOND_MATS.push(m);
    for(let i=0;i<b.n;i++){
      const a=(i/b.n)*Math.PI*2 + bi*.42;
      const jitter=(Math.sin(i*12.9+bi*4.7)*.5+.5);
      const dist=b.d*(.86+jitter*.28);
      const hh=b.h*(.62+jitter*.75);
      const rr=hh*(1.5+jitter*1.1);
      const hill=new THREE.Mesh(new THREE.ConeGeometry(rr,hh,MOBILE?6:9,1),m);
      hill.position.set(Math.cos(a)*dist, drop(dist)+hh*.36, Math.sin(a)*dist);
      hill.rotation.y=jitter*3.1;
      hill.scale.set(1,.72+jitter*.4,1.35+jitter*.5);
      beyond.add(hill);
    }
  });
}

// far treeline haze: a soft ring of dark conifers where park meets country
{
  const n=MOBILE?150:420;
  const geo=new THREE.ConeGeometry(1,1,MOBILE?5:7,2);
  const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.98,flatShading:true});
  m.__base=m.color.clone(); BEYOND_MATS.push(m);
  const inst=new THREE.InstancedMesh(geo,m,n);
  const d=new THREE.Object3D(), tc=new THREE.Color();
  for(let i=0;i<n;i++){
    // scattered in depth instead of a single ring, thinning outward
    const a=(i/n)*Math.PI*2+Math.sin(i*7.3)*.22+Math.cos(i*2.1)*.11;
    const depth=Math.pow(Math.abs(Math.sin(i*3.7)),.7);
    const rad=GW*.58+2+depth*GW*1.15;
    const t=Math.min(1,(rad-GW*.58)/(GW*1.15));
    // two silhouettes: slim firs, squatter broadleaf clumps
    const fir=(i%3)!==0;
    const h=lerp(fir?10:7.4,fir?5.2:4.2,t)*(.66+Math.abs(Math.sin(i*5.1))*.66);
    const wd=(fir?.30:.46)*(.85+Math.abs(Math.cos(i*4.3))*.4);
    const joinR=GW*.60;
    const wj=1-Math.min(1,Math.max(0,(rad-joinR*.92)/(joinR*.62)));
    const tt=(rad-GW*.44)/(GW*3.96);
    const ft=Math.max(0,(tt-.20)/.80);
    const country=-ft*ft*168-1.1;
    const gy=terrainH(Math.cos(a)*rad,Math.sin(a)*rad);
    const baseY=country*(1-wj)+gy*wj;
    d.position.set(Math.cos(a)*rad, baseY+h/2-.3, Math.sin(a)*rad);
    d.scale.set(h*wd,h,h*wd);
    // a slight lean so the treeline doesn't look machine-planted
    d.rotation.set(Math.sin(i*1.7)*.05,i*1.7,Math.cos(i*2.3)*.05);
    d.updateMatrix(); inst.setMatrixAt(i,d.matrix);
    // recede in colour with distance so the trees melt into the hills
    tc.setHSL(lerp(.245,.275,Math.abs(Math.sin(i*1.9))*.5+t*.5),
              lerp(.22,.075,t), lerp(.28,.52,t), THREE.SRGBColorSpace);
    inst.setColorAt(i,tc);
  }
  inst.instanceColor && (inst.instanceColor.needsUpdate=true);
  beyond.add(inst);
}

// base plate edge — kept but sunk far below, so the park still has a lip
const plate=new THREE.Mesh(new THREE.CylinderGeometry(GW*.598,GW*.57,7.0,MOBILE?48:96,1,false),
  mat(0xc9b795,{rough:.9}));
plate.position.y=-11.0; plate.visible=false; world.add(plate);
const plateRim=new THREE.Mesh(new THREE.TorusGeometry(GW*.598,.7,8,MOBILE?48:96),M.brassDark);
plateRim.rotation.x=Math.PI/2; plateRim.position.y=-5.4; plateRim.visible=false; world.add(plateRim);

function hAt(x,z){ return terrainH(x,z); }

// perimeter treeline — the park has an edge, but you see woods, not a table
const rim=new THREE.Group(); world.add(rim);
{
  const n=MOBILE?70:130;
  const mid=mat(0x7d8b68,{rough:.95,flat:true});
  const far=mat(0x94a17d,{rough:.95,flat:true});
  [[new THREE.ConeGeometry(3.0,8,6),mid,Math.round(n*.45),58,74,4.0],
   [new THREE.IcosahedronGeometry(3.4,0),far,Math.round(n*.55),62,84,3.2]
  ].forEach(([geo,material,count,r0,r1,lift])=>{
    const im=new THREE.InstancedMesh(geo,material,count);
    const d=new THREE.Object3D();
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2;
      const r=lerp(r0,r1,Math.random());
      const x=Math.cos(a)*r, z=Math.sin(a)*r;
      d.position.set(x,hAt(x,z)+lift*lerp(.8,1.2,Math.random()),z);
      const sc=lerp(.75,1.3,Math.random());
      d.scale.set(sc,sc*lerp(.8,1.15,Math.random()),sc);
      d.rotation.y=Math.random()*3; d.updateMatrix(); im.setMatrixAt(i,d.matrix);
    }
    im.castShadow=false; rim.add(im);
  });
}

/* ---- pond ---- */
const pond=new THREE.Mesh(new THREE.CircleGeometry(13.4,44),M.water);
pond.rotation.x=-Math.PI/2; pond.position.set(44,-1.35,40); world.add(pond);
const pondRing=new THREE.Mesh(new THREE.TorusGeometry(13.6,.5,6,44),M.stone);
pondRing.rotation.x=Math.PI/2; pondRing.position.set(44,-1.0,40); world.add(pondRing);

/* ---- curved paths, laid as ribbons of flagstone ---- */
function pathRibbon(curve, width, material, segments){
  const seg=segments||90;
  const verts=[], idx=[], uvs=[];
  const up=new THREE.Vector3(0,1,0);
  for(let i=0;i<=seg;i++){
    const t=i/seg;
    const p=curve.getPoint(t), tan=curve.getTangent(t).normalize();
    const side=new THREE.Vector3().crossVectors(tan,up).normalize().multiplyScalar(width/2);
    const a=p.clone().sub(side), b=p.clone().add(side);
    a.y=hAt(a.x,a.z)+.16; b.y=hAt(b.x,b.z)+.16;
    verts.push(a.x,a.y,a.z, b.x,b.y,b.z);
    uvs.push(0,t*8, 1,t*8);
  }
  for(let i=0;i<seg;i++){
    const o=i*2;
    idx.push(o,o+1,o+2, o+1,o+3,o+2);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(idx); g.computeVertexNormals();
  const m=new THREE.Mesh(g,material); m.receiveShadow=true; world.add(m);
  return m;
}
const pathMat=mat(0xe7d9ba,{rough:.93});
const mainPath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,0,42), new THREE.Vector3(-1.5,0,30), new THREE.Vector3(1,0,18),
  new THREE.Vector3(-2,0,6), new THREE.Vector3(-6,0,-6), new THREE.Vector3(-11,0,-18),
  new THREE.Vector3(-13,0,-26)
]);
pathRibbon(mainPath,5.6,pathMat,110);
const eastPath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-1,0,10), new THREE.Vector3(10,0,7), new THREE.Vector3(22,0,2),
  new THREE.Vector3(32,0,-4), new THREE.Vector3(38,0,-11)
]);
pathRibbon(eastPath,4.0,pathMat,80);
const westPath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-3,0,8), new THREE.Vector3(-13,0,6), new THREE.Vector3(-22,0,2),
  new THREE.Vector3(-28,0,-2)
]);
pathRibbon(westPath,3.8,pathMat,70);
const pondPath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(6,0,26), new THREE.Vector3(20,0,30), new THREE.Vector3(30,0,36)
]);
pathRibbon(pondPath,3.4,pathMat,50);

/* spurs to the outer zones — every destination must be reachable on foot */
// pond path continues out to the globe
const globePath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(30,0,36), new THREE.Vector3(36,0,37), new THREE.Vector3(41,0,36)
]);
pathRibbon(globePath,3.0,pathMat,34);
// west spur out to the story garden
const gardenPath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-13,0,6), new THREE.Vector3(-22,0,14), new THREE.Vector3(-31,0,24),
  new THREE.Vector3(-36,0,31)
]);
pathRibbon(gardenPath,3.2,pathMat,48);
// west spur down to the arcade
const arcadePath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-22,0,2), new THREE.Vector3(-32,0,3), new THREE.Vector3(-40,0,5)
]);
pathRibbon(arcadePath,3.2,pathMat,36);
// circus side lane to the prize booth
const prizePath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-28,0,-2), new THREE.Vector3(-27,0,-12), new THREE.Vector3(-24,0,-22)
]);
pathRibbon(prizePath,2.8,pathMat,34);
// east path continues past the coaster to futureland
const futurePath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(32,0,-4), new THREE.Vector3(44,0,0), new THREE.Vector3(55,0,6),
  new THREE.Vector3(61,0,10)
]);
pathRibbon(futurePath,3.0,pathMat,44);
// a lane south from the gate to the gallery
const galleryPath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-4,0,44), new THREE.Vector3(-14,0,50), new THREE.Vector3(-25,0,56),
  new THREE.Vector3(-30,0,58)
]);
pathRibbon(galleryPath,3.0,pathMat,42);
// carousel loop off the east path
const carouselPath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(22,0,2), new THREE.Vector3(25,0,8), new THREE.Vector3(26,0,12)
]);
pathRibbon(carouselPath,2.8,pathMat,26);
// kerb stones + clipped hedges lining the promenade
function edging(curve,width,count,builder){
  const up=new THREE.Vector3(0,1,0);
  for(let i=0;i<count;i++){
    const t=(i+.5)/count;
    const p=curve.getPoint(t), tan=curve.getTangent(t).normalize();
    const side=new THREE.Vector3().crossVectors(tan,up).normalize();
    [-1,1].forEach(sgn=>{
      const q=p.clone().addScaledVector(side,sgn*width/2);
      builder(q.x,q.z,Math.atan2(tan.x,tan.z),i,sgn);
    });
  }
}
const kerbGeo=new THREE.BoxGeometry(.9,.22,.36);
const kerbMat=mat(0xd6c9ab,{rough:.95});
const hedgeGeo=new THREE.BoxGeometry(1.1,.62,.78);
const hedgeMat=mat(0x6f7f56,{rough:.96,flat:true});
const kerbs=[], hedges=[];
[[mainPath,5.6,60],[eastPath,4.0,36],[westPath,3.8,30],[pondPath,3.4,24],
 [globePath,3.0,14],[gardenPath,3.2,22],[arcadePath,3.2,16],[prizePath,2.8,15],
 [futurePath,3.0,20],[galleryPath,3.0,19],[carouselPath,2.8,11]].forEach(([c,w,n])=>{
  edging(c,w,n,(x,z,ry,i)=>{ kerbs.push([x,z,ry]); if(i%5===2) hedges.push([x,z,ry]); });
});
(function place(list,geo,material,lift,arr){
  const im=new THREE.InstancedMesh(geo,material,list.length);
  const d=new THREE.Object3D();
  list.forEach(([x,z,ry],i)=>{
    d.position.set(x,hAt(x,z)+lift,z); d.rotation.set(0,ry,0);
    d.scale.setScalar(lerp(.9,1.12,Math.random())); d.updateMatrix(); im.setMatrixAt(i,d.matrix);
  });
  im.castShadow=true; im.receiveShadow=true; world.add(im);
})(kerbs,kerbGeo,kerbMat,.16);
(function place(list,geo,material,lift){
  const im=new THREE.InstancedMesh(geo,material,list.length);
  const d=new THREE.Object3D();
  list.forEach(([x,z,ry],i)=>{
    d.position.set(x,hAt(x,z)+lift,z); d.rotation.set(0,ry+(Math.random()-.5)*.1,0);
    d.scale.set(lerp(.85,1.2,Math.random()),lerp(.8,1.15,Math.random()),lerp(.85,1.15,Math.random()));
    d.updateMatrix(); im.setMatrixAt(i,d.matrix);
  });
  im.castShadow=true; im.receiveShadow=true; world.add(im);
})(hedges,hedgeGeo,hedgeMat,.32);

// low picket fences enclosing the lawns between attractions
{
  const postGeo=new THREE.BoxGeometry(.14,1.1,.14);
  const railGeo=new THREE.BoxGeometry(2.0,.12,.09);
  const fenceMat=mat(C.cream,{rough:.9});
  const LAWNS=[[[-6,14],[-16,16],[-22,10]],[[12,16],[20,14],[26,8]],[[-2,-14],[6,-18],[14,-20]]];
  const posts=[],rails=[];
  LAWNS.forEach(run=>{
    for(let k=0;k<run.length-1;k++){
      const [x0,z0]=run[k],[x1,z1]=run[k+1];
      const segs=Math.round(Math.hypot(x1-x0,z1-z0)/2);
      for(let i=0;i<=segs;i++){
        const t=i/segs, x=lerp(x0,x1,t), z=lerp(z0,z1,t);
        posts.push([x,z]);
        if(i<segs) rails.push([lerp(x0,x1,(i+.5)/segs),lerp(z0,z1,(i+.5)/segs),Math.atan2(x1-x0,z1-z0)]);
      }
    }
  });
  const pi=new THREE.InstancedMesh(postGeo,fenceMat,posts.length);
  const d=new THREE.Object3D();
  posts.forEach(([x,z],i)=>{ d.position.set(x,hAt(x,z)+.55,z); d.rotation.set(0,0,0); d.updateMatrix(); pi.setMatrixAt(i,d.matrix); });
  pi.castShadow=true; world.add(pi);
  const ri=new THREE.InstancedMesh(railGeo,fenceMat,rails.length*2);
  rails.forEach(([x,z,ry],i)=>{
    [0,1].forEach(k=>{
      d.position.set(x,hAt(x,z)+.42+k*.42,z); d.rotation.set(0,ry+Math.PI/2,0);
      d.updateMatrix(); ri.setMatrixAt(i*2+k,d.matrix);
    });
  });
  ri.castShadow=true; world.add(ri);
}

// hidden trail to the graveyard — narrow, half-grown-over
const gravePath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(34,0,-8), new THREE.Vector3(41,0,-14), new THREE.Vector3(46,0,-22)
]);
pathRibbon(gravePath,2.6,mat(0xd9cca9,{rough:.96}),40);

/* ---- vegetation: instanced, hand-shaped, never a game asset pack ---- */
function makeTree(kind){
  const g=new THREE.Group();
  const trunkH=kind==='poplar'?7.5:kind==='old'?4.6:5.4;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.42,trunkH,6),mat(0x7a6349,{rough:.92,flat:true}));
  trunk.position.y=trunkH/2; trunk.castShadow=true; g.add(trunk);
  const foliageMat=kind==='old'?M.woodMoss:new THREE.MeshStandardMaterial({
    color:new THREE.Color().setHSL(.245,.17,lerp(.28,.40,Math.random()),THREE.SRGBColorSpace),
    roughness:.94, flatShading:true, map:grainTex
  });
  if(kind==='poplar'){
    for(let i=0;i<3;i++){
      const c=new THREE.Mesh(new THREE.ConeGeometry(2.1-i*.45,4.4-i*.6,7),foliageMat);
      c.position.y=trunkH*.62+i*2.4; c.castShadow=true; g.add(c);
    }
  }else if(kind==='old'){
    for(let i=0;i<4;i++){
      const s=new THREE.Mesh(new THREE.IcosahedronGeometry(lerp(1.9,3.1,Math.random()),0),foliageMat);
      s.position.set((Math.random()-.5)*3.4, trunkH+.6+Math.random()*2.2, (Math.random()-.5)*3.4);
      s.scale.y=.72; s.castShadow=true; g.add(s);
    }
  }else{
    for(let i=0;i<3;i++){
      const s=new THREE.Mesh(new THREE.IcosahedronGeometry(lerp(1.7,2.6,Math.random()),0),foliageMat);
      s.position.set((Math.random()-.5)*2.2, trunkH*.9+i*1.5, (Math.random()-.5)*2.2);
      s.scale.y=.82; s.castShadow=true; g.add(s);
    }
  }
  return g;
}
const trees=new THREE.Group(); world.add(trees);
const TREE_SPOTS=[
  [-30,26,'poplar'],[-34,14,'round'],[-40,-4,'old'],[-36,-16,'poplar'],
  [-4,-36,'round'],[10,-32,'old'],
  [30,-18,'round'],[38,-2,'old'],[24,44,'poplar'],
  [12,44,'round'],[-2,48,'poplar'],[-14,44,'round'],[18,18,'round'],
  [-20,20,'old'],[52,-30,'old'],
  [-48,-24,'round'],[-10,-22,'round'],
  [-34,-36,'old'],[58,4,'poplar'],[-56,6,'round'],[6,-46,'poplar'],[36,46,'poplar'],
  [-56,30,'poplar'],[8,-20,'round'],[-8,26,'poplar'],[60,-20,'round'],[-60,-8,'old']
];
// keep a clearance radius around every zone so nothing grows through a building
const ZONE_CLEAR=[[-40,34,15],[44,36,11],[66,12,15],[-46,2,12],[-24,-30,10],
                  [-33,60,14],[26,18,9],[0,34,10]];
TREE_SPOTS.forEach(([x,z,k])=>{
  if(ZONE_CLEAR.some(([cx,cz,r])=>Math.hypot(x-cx,z-cz)<r)) return;
  const t=makeTree(k);
  t.position.set(x,hAt(x,z)-.1,z);
  t.rotation.y=Math.random()*Math.PI*2;
  const s=lerp(.8,1.25,Math.random()); t.scale.setScalar(s);
  t.userData.sway=Math.random()*Math.PI*2;
  trees.add(t);
});

// shrubs & flower clumps — instanced for cheapness
const bushGeo=new THREE.IcosahedronGeometry(1,0);
const bushes=new THREE.InstancedMesh(bushGeo,mat(0x93a37c,{rough:.94,flat:true}),MOBILE?60:105);
bushes.castShadow=true; bushes.receiveShadow=true;
{
  const d=new THREE.Object3D();
  for(let i=0;i<bushes.count;i++){
    let a=Math.random()*Math.PI*2, r=lerp(12,72,Math.sqrt(Math.random()));
    let x=Math.cos(a)*r, z=Math.sin(a)*r;
    // nudge out of any zone footprint rather than dropping the instance
    for(let g=0;g<6;g++){
      const hit=ZONE_CLEAR.find(([cx,cz,rr])=>Math.hypot(x-cx,z-cz)<rr+1.5);
      if(!hit) break;
      a=Math.random()*Math.PI*2; r=lerp(12,72,Math.sqrt(Math.random()));
      x=Math.cos(a)*r; z=Math.sin(a)*r;
    }
    d.position.set(x,hAt(x,z)+.3,z);
    d.scale.set(lerp(.6,1.5,Math.random()),lerp(.5,.9,Math.random()),lerp(.6,1.5,Math.random()));
    d.rotation.y=Math.random()*3;
    d.updateMatrix(); bushes.setMatrixAt(i,d.matrix);
  }
}
world.add(bushes);

const petalGeo=new THREE.SphereGeometry(.17,5,4);
const FLOWER_BEDS=[[0,38],[-4,28],[2,16],[-7,4],[-11,-10],[10,8],[20,3],[30,-3],[-16,6],[-24,3],[8,28],[20,30],[-20,32],[-32,22],[26,20],[42,-14]];
[[C.red,54],[C.butter,46],[0xd9a7bd,40]].forEach(([col,n])=>{
  const im=new THREE.InstancedMesh(petalGeo,mat(col,{rough:.8,map:false}),n);
  const d=new THREE.Object3D();
  for(let i=0;i<n;i++){
    const bed=FLOWER_BEDS[i%FLOWER_BEDS.length];
    const a=Math.random()*Math.PI*2, r=lerp(1.6,4.6,Math.random());
    const x=bed[0]+Math.cos(a)*r, z=bed[1]+Math.sin(a)*r;
    d.position.set(x,hAt(x,z)+.32,z); d.updateMatrix(); im.setMatrixAt(i,d.matrix);
  }
  world.add(im);
});


/* seam planting: low scrub straddling the park edge, so the eye never finds a
   clean boundary between the disc and the country beyond. Sparse and clumped —
   an even hedge of blobs looks worse than the seam it hides. */
{
  const n=MOBILE?54:126;
  // a squashed sphere reads as a leafy bush; the icosahedron looked like rubble
  const geo=new THREE.SphereGeometry(1,7,5);
  // NOTE: deliberately NO vertexColors. This geometry has no colour attribute,
  // and requesting vertex colours made every instance render dead black.
  const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.94,flatShading:true});
  const inst=new THREE.InstancedMesh(geo,m,n);
  const d=new THREE.Object3D(), cc=new THREE.Color();
  const joinR=GW*.60;
  let put=0;
  for(let i=0;i<n*4 && put<n;i++){
    // loose clumps of three rather than an even sprinkle
    const clump=Math.floor(i/3);
    const a2=(clump*2.399963+Math.sin(clump*7.1)*.5)%(Math.PI*2)+(i%3)*.05;
    const band=(Math.sin(clump*4.7)*.5+.5);
    const rad=joinR*(.87+band*.32)+Math.sin(i*9.1)*5.0;
    const x=Math.cos(a2)*rad+Math.sin(i*3.7)*2.8;
    const z=Math.sin(a2)*rad+Math.cos(i*4.1)*2.8;
    let blocked=false;
    if(typeof ZONE_CLEAR!=='undefined')
      for(const [zx,zz,zr] of ZONE_CLEAR) if(Math.hypot(x-zx,z-zz)<zr+3) { blocked=true; break; }
    if(blocked) continue;
    // low and wide: scrub, never tall enough to read as a lump
    const sc=1.5+Math.abs(Math.sin(i*3.3))*1.6;
    d.position.set(x, terrainH(x,z)+sc*.28, z);
    d.scale.set(sc*(1.05+Math.abs(Math.cos(i*2.7))*.45),
                sc*(.50+band*.28),
                sc*(.95+Math.sin(i*1.9)*.2));
    d.rotation.set(0, i*2.1, 0);
    d.updateMatrix(); inst.setMatrixAt(put,d.matrix);
    // sunlit sage, keyed to the park turf instead of the dark forest
    cc.setHSL(lerp(.212,.258,band), lerp(.24,.16,band), lerp(.46,.56,band),
              THREE.SRGBColorSpace);
    inst.setColorAt(put,cc);
    put++;
  }
  inst.count=put;
  inst.instanceColor && (inst.instanceColor.needsUpdate=true);
  m.__base=m.color.clone(); BEYOND_MATS.push(m);
  beyond.add(inst);
}

/* ==== part4_attractions ==== */
/* ============================================================
   5 · CLICKABLE REGISTRY
   ============================================================ */
const HOT=[]; // {obj, id, label, focus:{az,pol,dist,tgt}, onPick}
function hotspot(obj,id,label,focus,extra){
  obj.traverse(o=>{ o.userData.hotId=id; });
  HOT.push(Object.assign({obj,id,label,focus},extra||{}));
  return obj;
}

/* ============================================================
   5b · CURIOS — the park's small print
   Secondary props (benches, lamps, signs, stalls…) get a light
   interaction: pointer + name tooltip on hover, a one-line
   caption as a toast on click. The full #sheet panel stays
   reserved for the main attractions above.
   Hit-testing raycasts only the CURIOS array — never the
   whole scene — and only on pointer events, not per frame.
   ============================================================ */
const CURIOS=[]; // {obj,label,cap}
function curio(obj,label,cap){
  const i=CURIOS.length;
  obj.traverse(o=>{ if(o.userData.curio===undefined) o.userData.curio=i; });
  CURIOS.push({obj,label,cap});
  return obj;
}
const curioRay=new THREE.Raycaster();
const curioPtr=new THREE.Vector2(-9,-9);
let curioHover=null, curioDown=null, curioTipEl=null;
function curioHit(cx,cy){
  /* One ordered raycast over the world: whichever the ray touches first —
     a curio or a main attraction — owns the pointer. Curios nested inside
     an attraction (ticket booths, station, arch) are checked per-node
     before the ancestor hotId, so they still win their own clicks. */
  curioPtr.x=(cx/innerWidth)*2-1;
  curioPtr.y=-(cy/innerHeight)*2+1;
  curioRay.setFromCamera(curioPtr,camera);
  const hits=curioRay.intersectObjects(world.children,true);
  for(const h of hits){
    let o=h.object;
    while(o){
      if(o.userData.curio!==undefined) return CURIOS[o.userData.curio];
      if(o.userData.hotId) return null; // an attraction owns this ray
      o=o.parent;
    }
  }
  return null;
}
function curioTipSet(text){
  if(!curioTipEl){
    curioTipEl=document.createElement('div');
    curioTipEl.setAttribute('aria-hidden','true');
    curioTipEl.style.cssText=
      'position:fixed;z-index:6;pointer-events:none;padding:5px 9px;border-radius:2px;'+
      'background:rgba(24,20,14,.82);color:#f2e9d8;font-size:9.5px;letter-spacing:.2em;'+
      'text-transform:uppercase;opacity:0;transform:translate(-50%,26px);'+
      'transition:opacity .2s ease;white-space:nowrap;';
    document.body.appendChild(curioTipEl);
  }
  if(text){ curioTipEl.textContent=text; curioTipEl.classList.add('curio-on'); curioTipEl.style.opacity='1'; }
  else{ curioTipEl.style.opacity='0'; }
}
/* hover: pointer cursor + small name label that rides under the pointer */
addEventListener('mousemove',e=>{
  if(!introDone){ if(curioHover){ curioHover=null; curioTipSet(null); } return; }
  curioTipEl&&(curioTipEl.style.left=e.clientX+'px',curioTipEl.style.top=e.clientY+'px');
  const c=curioDown?null:curioHit(e.clientX,e.clientY);
  if(c!==curioHover){
    curioHover=c;
    if(c){
      curioTipSet(c.label);
      stage.classList.add('pointing');
      // keep the attraction tooltip out of the way while a curio owns the pointer
      const t=document.getElementById('tip'); t&&t.classList.remove('show');
    }else{
      curioTipSet(null);
      stage.classList.remove('pointing');
    }
  }else if(curioHover){
    const t=document.getElementById('tip'); t&&t.classList.remove('show');
  }
},{passive:true});
/* click: a curio answers with its caption, and swallows the event so the
   main-attraction picker never mistakes it for empty ground */
addEventListener('mousedown',e=>{ curioDown=[e.clientX,e.clientY]; },true);
function curioPick(cx,cy){
  const c=curioHit(cx,cy);
  if(!c) return false;
  toast(c.label+' — '+c.cap);
  return true;
}
addEventListener('mouseup',e=>{
  const d=curioDown; curioDown=null;
  if(!d) return;
  if(Math.hypot(e.clientX-d[0],e.clientY-d[1])>9) return;
  if(e.target.closest&&e.target.closest('.hud,#mapcard,#sheet,#dolly,#back,#intro,#skip')) return;
  if(curioPick(e.clientX,e.clientY)){
    // stopPropagation alone leaves sibling listeners on this node running,
    // and the attraction picker would clear the curio's toast
    e.stopImmediatePropagation(); e.stopPropagation();
    // the orbit handler never saw this mouseup; release its drag state
    dragging=false; stage.classList.remove('grabbing');
  }
},true);
addEventListener('touchend',e=>{
  const t=e.changedTouches&&e.changedTouches[0];
  if(!t) return;
  if(e.target.closest&&e.target.closest('.hud,#mapcard,#sheet,#dolly,#back,#intro,#skip')) return;
  if(curioPick(t.clientX,t.clientY)){
    e.stopImmediatePropagation(); e.stopPropagation();
    dragging=false; stage.classList.remove('grabbing');
  }
},true);

/* ============================================================
   5c · FAIRGROUND VOCABULARY — shared Belle-Époque ornament
   Slender ironwork, dentil courses, scalloped valances, globe
   lamps. All procedural, all instanced where repeated, all
   reading by silhouette rather than polygon count.
   ============================================================ */
const PAR_zinc=mat(0x878e94,{rough:.5,metal:.35});          // zinc / slate roofs
const PAR_valG=mat(C.forest,{rough:.84,side:THREE.DoubleSide});   // green valance
const PAR_valR=mat(C.burgundy,{rough:.8,side:THREE.DoubleSide});  // burgundy valance
/* small tooth course under an eave — one InstancedMesh per run */
function dentilRun(parent,w,y,z,n,ry){
  const im=new THREE.InstancedMesh(new THREE.BoxGeometry(w/n*.5,.2,.16),M.paper,n);
  const d=new THREE.Object3D();
  for(let i=0;i<n;i++){
    d.position.set(-w/2+w*(i+.5)/n,y,z);
    d.rotation.set(0,ry||0,0); d.updateMatrix(); im.setMatrixAt(i,d.matrix);
  }
  parent.add(im); return im;
}
/* scalloped valance hem — instanced half-discs hanging from a fascia */
function valanceRun(parent,w,y,z,ry,m){
  const n=Math.max(5,Math.round(w/0.85));
  const im=new THREE.InstancedMesh(new THREE.CircleGeometry(w/n*.55,10,0,Math.PI),m,n);
  const d=new THREE.Object3D();
  for(let i=0;i<n;i++){
    d.position.set(-w/2+w*(i+.5)/n,y,z);
    d.rotation.set(0,ry||0,Math.PI); d.updateMatrix(); im.setMatrixAt(i,d.matrix);
  }
  parent.add(im); return im;
}
/* opal globe lamp on a curved iron bracket — the fairground signature */
function globeLamp(parent,x,y,z,zone,order){
  const q=new THREE.Mesh(new THREE.TorusGeometry(.5,.045,5,10,Math.PI/2),M.ironDark);
  q.position.set(x,y,z); q.rotation.z=Math.PI; parent.add(q);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.4,5),M.ironDark);
  stem.position.set(x,y-.2,z); parent.add(stem);
  const ball=emissive(0xfff2dd,1.5,.26,zone||'buildings',order??1);
  ball.position.set(x,y+.5,z); parent.add(ball);
  return ball;
}
/* slender column with capital + base rings — ironwork by silhouette */
function fairgroundColumn(parent,x,y,z,h,r,ry){
  const c=new THREE.Mesh(new THREE.CylinderGeometry(r*.8,r,h,7),M.ironDark);
  c.position.set(x,y,z); c.castShadow=true; parent.add(c);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(r*1.25,r*.85,.18,8),M.brass);
  cap.position.set(x,y+h/2,z); parent.add(cap);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(r*1.2,r*.85,.16,8),M.brassDark);
  base.position.set(x,y-h/2,z); parent.add(base);
  return c;
}

/* ============================================================
   6 · ENTRANCE GATE
   ============================================================ */
const gate=new THREE.Group(); gate.position.set(0,hAt(0,34),34); world.add(gate);
{
  // two brick-and-plaster pylons
  [-5.6,5.6].forEach(sx=>{
    const base=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.2,2.6),M.stone);
    base.position.set(sx,.6,0); base.castShadow=base.receiveShadow=true; gate.add(base);
    const col=new THREE.Mesh(new THREE.BoxGeometry(2.1,8.4,2.1),M.woodCream);
    col.position.set(sx,5.2,0); col.castShadow=true; gate.add(col);
    // framed inset panels on each face — panelled facade vocabulary
    for(let f=0;f<4;f++){
      const ry=f*Math.PI/2, off=1.06;
      for(let p=0;p<3;p++){
        const py=2.6+p*2.2;
        const inset=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.5,.1),M.woodGreen);
        inset.position.set(sx+Math.sin(ry)*off,py,Math.cos(ry)*off);
        inset.rotation.y=ry; gate.add(inset);
        const frame=new THREE.Mesh(new THREE.BoxGeometry(1.3,1.7,.05),M.burgundy);
        frame.position.set(sx+Math.sin(ry)*off,py,Math.cos(ry)*off);
        frame.rotation.y=ry; gate.add(frame);
      }
    }
    const band=new THREE.Mesh(new THREE.BoxGeometry(2.35,.5,2.35),M.burgundy);
    band.position.set(sx,7.2,0); gate.add(band);
    // dentil course under the cap
    dentilRun(gate,2.3,7.48,1.14,6);
    dentilRun(gate,2.3,7.48,-1.14,6);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(2.7,.55,2.7),M.brassDark);
    cap.position.set(sx,9.6,0); cap.castShadow=true; gate.add(cap);
    const finial=new THREE.Mesh(new THREE.SphereGeometry(.62,12,10),M.brass);
    finial.position.set(sx,10.3,0); gate.add(finial);
    // pylon bulbs
    for(let i=0;i<4;i++){
      const b=emissive(C.butter,1.5,.19,'gate',0);
      b.position.set(sx,2.4+i*1.9,1.12); gate.add(b);
      const b2=b.clone(); b2.material=b.material; b2.position.set(sx,2.4+i*1.9,-1.12); gate.add(b2);
    }
  });
  // arch — a shallow curved beam
  const archPts=[];
  for(let i=0;i<=24;i++){
    const t=i/24, x=lerp(-5.6,5.6,t);
    archPts.push(new THREE.Vector3(x, 6.5+Math.sin(t*Math.PI)*2.1, .9));
  }
  const arch=new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts),36,.34,7,false),M.woodCream);
  arch.castShadow=true; gate.add(arch);
  // arch bulbs, the first thing that lights up
  for(let i=0;i<=13;i++){
    const t=i/13, x=lerp(-5.2,5.2,t);
    const b=emissive(C.butter,1.9,.2,'gate',0);
    b.position.set(x, 6.95+Math.sin(t*Math.PI)*2.1, .9); gate.add(b);
  }
  // signboard
  const board=new THREE.Mesh(new THREE.BoxGeometry(9.6,2.5,.36),M.woodGreen);
  board.position.set(0,11.4,0); board.castShadow=true; gate.add(board);
  const boardEdge=new THREE.Mesh(new THREE.BoxGeometry(9.9,.22,.5),M.brass);
  boardEdge.position.set(0,12.72,0); gate.add(boardEdge);
  const boardEdge2=boardEdge.clone(); boardEdge2.position.y=10.1; gate.add(boardEdge2);
  // painted sign face using a canvas texture (enamel signage)
  const signCv=document.createElement('canvas'); signCv.width=1024; signCv.height=256;
  const sctx=signCv.getContext('2d');
  sctx.fillStyle='#33473a'; sctx.fillRect(0,0,1024,256);
  sctx.strokeStyle='rgba(233,220,196,.5)'; sctx.lineWidth=4;
  sctx.strokeRect(18,18,988,220);
  sctx.fillStyle='#f2e9d8'; sctx.textAlign='center'; sctx.textBaseline='middle';
  // shrink to fit: letter-spacing pushed the wordmark past the canvas edge
  const fitText=(text,maxW,startPx,tracking,weight,fam)=>{
    let px=startPx;
    for(let i=0;i<40;i++){
      sctx.letterSpacing=tracking+'px';
      sctx.font=`${weight} ${px}px ${fam}`;
      if(sctx.measureText(text).width<=maxW) break;
      px-=2;
    }
    return px;
  };
  fitText('LUOYING’S THEME PARK',940,104,16,'500','"Cormorant Garamond", Georgia, serif');
  sctx.fillText('LUOYING’S THEME PARK',512,120);
  sctx.fillStyle='rgba(242,233,216,.72)';
  fitText('MOSTLY OPEN',760,34,10,'400','Inter, sans-serif');
  sctx.fillText('MOSTLY OPEN',512,204);
  const signTex=new THREE.CanvasTexture(signCv); signTex.colorSpace=THREE.SRGBColorSpace;
  const signFace=new THREE.Mesh(new THREE.PlaneGeometry(9.4,2.34),
    new THREE.MeshStandardMaterial({map:signTex,roughness:.7,
      emissive:new THREE.Color(C.butter),emissiveMap:signTex,emissiveIntensity:0}));
  signFace.position.set(0,11.4,.2); gate.add(signFace);
  LAMPS.push({mesh:signFace,mat:signFace.material,color:new THREE.Color(C.butter),intensity:.5,zone:'gate',order:0,lit:0});

  // the two gate doors that swing open in the intro
  const doorMatL=M.brassDark;
  const doorL=new THREE.Group(); doorL.position.set(-4.5,0,0); gate.add(doorL);
  const doorR=new THREE.Group(); doorR.position.set(4.5,0,0); gate.add(doorR);
  [[doorL,1],[doorR,-1]].forEach(([grp,dir])=>{
    for(let i=0;i<7;i++){
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,7.4,5),doorMatL);
      bar.position.set(dir*(.5+i*.62),3.7,0); grp.add(bar);
    }
    const top=new THREE.Mesh(new THREE.BoxGeometry(4.3,.18,.18),doorMatL);
    top.position.set(dir*2.4,7.3,0); grp.add(top);
    const mid=top.clone(); mid.position.y=3.6; grp.add(mid);
  });
  world.userData.doorL=doorL; world.userData.doorR=doorR;

  // flags on poles beside the gate
  const flagGroup=new THREE.Group(); gate.add(flagGroup);
  [[-9,C.red],[9,C.blue],[-12.5,C.butter],[12.5,C.sage]].forEach(([x,col])=>{
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,10,6),M.woodCream);
    pole.position.set(x,5,-1); pole.castShadow=true; flagGroup.add(pole);
    const fg=new THREE.PlaneGeometry(3,1.8,10,4);
    const flag=new THREE.Mesh(fg,new THREE.MeshStandardMaterial({
      color:col,roughness:.92,side:THREE.DoubleSide,map:canvasTex}));
    flag.position.set(x+1.5,9,-1); flag.userData.flag=true;
    flag.userData.base=fg.attributes.position.array.slice();
    flagGroup.add(flag);
  });
  world.userData.flags=flagGroup;
  curio(flagGroup,'The Gate Flags','Six chapters, five featured projects, and a park built to connect them.');

  // ticket booths flanking the entry
  [[-9.5,'Ticket Booth','Start with projects, experience, learning or travel.'],
   [9.5,'Admit One','Dolly can turn the whole park into a three-minute route.']].forEach(([x,label,cap])=>{
    const b=new THREE.Group(); b.position.set(x,0,4.5); gate.add(b);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.8,3.2,8),M.woodGreen);
    body.position.y=1.6; body.castShadow=true; b.add(body);
    const wainscot=new THREE.Mesh(new THREE.CylinderGeometry(1.74,1.82,.9,8),M.burgundy);
    wainscot.position.y=.55; b.add(wainscot);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(2.6,1.5,8),M.burgundy);
    roof.position.y=4; roof.castShadow=true; b.add(roof);
    // scalloped valance ringing the booth under the roof
    for(let s=0;s<8;s++){
      const a=s/8*Math.PI*2+Math.PI/8;
      const sc=new THREE.Mesh(new THREE.CircleGeometry(.42,7,0,Math.PI),PAR_valR);
      sc.position.set(Math.cos(a)*1.95,3.18,Math.sin(a)*1.95);
      sc.rotation.set(0,-a+Math.PI/2,Math.PI); b.add(sc);
    }
    const ball=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),M.brass);
    ball.position.y=4.9; b.add(ball);
    const win=emissive(0xffd9a0,.9,.9,'gate',0,'box');
    win.position.set(0,2.1,1.75); win.scale.set(1.4,1.5,1); b.add(win);
    // small enamel plaque under the window
    const plq=new THREE.Mesh(new THREE.BoxGeometry(.7,.28,.05),M.paper);
    plq.position.set(0,1.2,1.72); b.add(plq);
    curio(b,label,cap);
  });
}
hotspot(gate,'gate','Entrance Gate',{az:.05,pol:.92,dist:38,tgt:new THREE.Vector3(0,7,30)});

/* ============================================================
   7 · FERRIS WHEEL OF TIME — the landmark
   ============================================================ */
const CAB_DATA=PC.timeline;
const ferris=new THREE.Group();
const FERRIS_POS=new THREE.Vector3(-13,0,-27);
ferris.position.set(FERRIS_POS.x,hAt(FERRIS_POS.x,FERRIS_POS.z),FERRIS_POS.z);
world.add(ferris);
const wheel=new THREE.Group(); wheel.position.y=17.5; ferris.add(wheel);
const CAB_N=CAB_DATA.length*2; // twelve cabins, six of them carry chapters
const R=13.4;
{
  // masonry footing
  const foot=new THREE.Mesh(new THREE.BoxGeometry(13,1.2,7),M.stone);
  foot.position.y=.55; foot.receiveShadow=true; ferris.add(foot);
  // A-frame legs
  [-1,1].forEach(sz=>{
    [-1,1].forEach(sx=>{
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.32,.52,18.6,7),M.woodCream);
      leg.position.set(sx*4.4,9.3,sz*2.3);
      leg.rotation.z=-sx*.216; leg.rotation.x=-sz*.115;
      leg.castShadow=true; ferris.add(leg);
    });
  });
  const cross=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,9,6),M.brassDark);
  cross.rotation.z=Math.PI/2; cross.position.y=9; ferris.add(cross);
  const hubHouse=new THREE.Mesh(new THREE.BoxGeometry(3.2,2.4,5.4),M.woodGreen);
  hubHouse.position.y=17.5; hubHouse.castShadow=true; ferris.add(hubHouse);
  const axle=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,6.4,10),M.brass);
  axle.rotation.x=Math.PI/2; axle.position.y=17.5; ferris.add(axle);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,1.1,14),M.brass);
  hub.rotation.x=Math.PI/2; wheel.add(hub);

  // twin rims + spokes
  [-1.5,1.5].forEach(z=>{
    const rim=new THREE.Mesh(new THREE.TorusGeometry(R,.22,7,64),M.woodCream);
    rim.position.z=z; rim.castShadow=true; wheel.add(rim);
    const inner=new THREE.Mesh(new THREE.TorusGeometry(R*.52,.13,6,48),M.brassDark);
    inner.position.z=z; wheel.add(inner);
  });
  for(let i=0;i<CAB_N;i++){
    const a=(i/CAB_N)*Math.PI*2;
    [-1.5,1.5].forEach(z=>{
      const sp=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,R*2,5),
        i%2?M.brassDark:M.woodCream);
      sp.position.z=z; sp.rotation.z=a; wheel.add(sp);
    });
    // cross-bracing between rims
    const br=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,3,4),M.brassDark);
    br.rotation.x=Math.PI/2;
    br.position.set(Math.cos(a)*R,Math.sin(a)*R,0); wheel.add(br);
  }
  // bulbs along the rim — the finale of the lights cascade
  for(let i=0;i<40;i++){
    const a=(i/40)*Math.PI*2;
    [-1.85,1.85].forEach(z=>{
      const b=emissive(C.butter,2.2,.22,'ferris',4);
      b.position.set(Math.cos(a)*R,Math.sin(a)*R,z); wheel.add(b);
    });
  }
  // cabins
  const CABS=[];
  for(let i=0;i<CAB_N;i++){
    const a=(i/CAB_N)*Math.PI*2;
    const arm=new THREE.Group();
    arm.position.set(Math.cos(a)*R,Math.sin(a)*R,0);
    wheel.add(arm);
    const cab=new THREE.Group(); arm.add(cab);
    const isChapter=i%2===0;
    const di=i/2;
    const isRecent=isChapter&&di===CAB_DATA.length-1;
    const bodyMat=(i%4===0)?M.burgundy:(i%4===2?M.woodGreen:M.woodCream);
    const hanger=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1.5,5),M.brassDark);
    hanger.position.y=-.75; cab.add(hanger);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(1.05,.88,1.5,8),bodyMat);
    body.position.y=-2.2; body.castShadow=true; cab.add(body);
    const seatBand=new THREE.Mesh(new THREE.TorusGeometry(1.0,.09,5,10),M.woodCream);
    seatBand.rotation.x=Math.PI/2; seatBand.position.y=-1.65; cab.add(seatBand);
    const canopy=new THREE.Mesh(new THREE.ConeGeometry(1.35,.72,8),
      i%4===0?M.woodCream:M.burgundy);
    canopy.position.y=-1.2; canopy.castShadow=true; cab.add(canopy);
    const tip=new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),M.brass);
    tip.position.y=-.85; cab.add(tip);
    if(isChapter){
      const lamp=emissive(isRecent?C.amber:0xffd9a0,1.1,.15,'ferris',4);
      lamp.position.y=-2.0; cab.add(lamp);
    }
    CABS.push({arm,cab,angle:a,index:i,chapter:isChapter?di:-1});
  }
  ferris.userData.cabs=CABS;
  ferris.userData.wheel=wheel;
}
hotspot(ferris,'ferris','Ferris Wheel of Time',
  {az:-.30,pol:.88,dist:44,tgt:new THREE.Vector3(-13,13,-24)});

/* ============================================================
   8 · PROJECT COASTER — elegant, slightly wild
   ============================================================ */
const RIDES=PC.projects.featuredIds.map(id=>PC.projects.items.find(p=>p.slug===id)).filter(Boolean);
const coaster=new THREE.Group();
const CO=new THREE.Vector3(34,0,-9);
coaster.position.set(CO.x,hAt(CO.x,CO.z),CO.z); world.add(coaster);
{
  // sculptural track: a closed curve that dips through the park
  const trackPts=[
    new THREE.Vector3(-8,1.4,10), new THREE.Vector3(3,3.2,12.5), new THREE.Vector3(11,12,7),
    new THREE.Vector3(13,22,-3), new THREE.Vector3(5,24,-13), new THREE.Vector3(-6,13,-16),
    new THREE.Vector3(-13,4,-9), new THREE.Vector3(-17,14,1), new THREE.Vector3(-11,5.4,9),
    new THREE.Vector3(-8,1.4,10)
  ];
  const track=new THREE.CatmullRomCurve3(trackPts,true,'catmullrom',.35);
  coaster.userData.track=track;
  const railGeoA=new THREE.TubeGeometry(track,MOBILE?150:240,.13,6,true);
  const rails=[];
  [-0.55,0.55].forEach(off=>{
    // offset rails by shifting the tube along its binormal-ish axis
    const pts=[];
    for(let i=0;i<=180;i++){
      const t=i/180, p=track.getPoint(t), tan=track.getTangent(t);
      const side=new THREE.Vector3().crossVectors(tan,new THREE.Vector3(0,1,0)).normalize();
      pts.push(p.clone().addScaledVector(side,off));
    }
    const c=new THREE.CatmullRomCurve3(pts,true);
    const railMat=new THREE.MeshStandardMaterial({
      color:C.parchment,roughness:.5,metalness:.3,
      emissive:new THREE.Color(C.amber),emissiveIntensity:0
    });
    const r=new THREE.Mesh(new THREE.TubeGeometry(c,MOBILE?140:220,.12,5,true),railMat);
    r.castShadow=true; coaster.add(r);
    rails.push(r);
    LAMPS.push({mesh:r,mat:railMat,color:new THREE.Color(C.amber),intensity:.42,zone:'coaster',order:3,lit:0});
  });
  // sleepers + support columns
  const sleeperGeo=new THREE.BoxGeometry(1.5,.1,.22);
  const sleepers=new THREE.InstancedMesh(sleeperGeo,M.woodRedDark,120);
  const d=new THREE.Object3D();
  for(let i=0;i<120;i++){
    const t=i/120, p=track.getPoint(t), tan=track.getTangent(t);
    d.position.copy(p);
    d.lookAt(p.clone().add(tan)); d.rotateY(Math.PI/2);
    d.updateMatrix(); sleepers.setMatrixAt(i,d.matrix);
  }
  sleepers.castShadow=true; coaster.add(sleepers);
  for(let i=0;i<26;i++){
    const t=i/26, p=track.getPoint(t);
    const gy=hAt(CO.x+p.x,CO.z+p.z)-coaster.position.y;
    const h=p.y-gy;
    if(h<2.2) continue;
    const col=new THREE.Mesh(new THREE.CylinderGeometry(.11,.17,h-.5,5),M.woodCream);
    col.position.set(p.x,gy+(h-.5)/2,p.z); col.castShadow=true; coaster.add(col);
    if(h>6){
      const brace=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,1.6),M.brassDark);
      brace.position.set(p.x,gy+h*.55,p.z); brace.rotation.y=Math.random(); coaster.add(brace);
    }
  }
  // vintage station house
  const st=new THREE.Group(); st.position.set(-8,0,11.5); coaster.add(st);
  const plat=new THREE.Mesh(new THREE.BoxGeometry(9,1.1,5),M.stone);
  plat.position.y=.55; plat.receiveShadow=true; st.add(plat);
  const walls=new THREE.Mesh(new THREE.BoxGeometry(7.4,3.4,3.6),M.woodCream);
  walls.position.y=2.8; walls.castShadow=true; st.add(walls);
  // green pilasters + framed cream panels on the platform front
  [-3.4,-1.15,1.15,3.4].forEach(px=>{
    const pil=new THREE.Mesh(new THREE.BoxGeometry(.42,3.4,.14),M.woodGreen);
    pil.position.set(px,2.8,1.83); st.add(pil);
    const capl=new THREE.Mesh(new THREE.BoxGeometry(.56,.16,.2),M.brass);
    capl.position.set(px,4.4,1.85); st.add(capl);
  });
  for(let p=0;p<3;p++){
    const pan=new THREE.Mesh(new THREE.BoxGeometry(1.7,2.2,.08),M.burgundy);
    pan.position.set(-2.275+p*2.275,2.75,1.84); st.add(pan);
  }
  const roof=new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.1,8.2,10,1,false,0,Math.PI),PAR_zinc);
  roof.rotation.z=Math.PI/2; roof.rotation.y=Math.PI/2; roof.position.y=4.6;
  roof.castShadow=true; st.add(roof);
  const trim=new THREE.Mesh(new THREE.BoxGeometry(8.6,.3,4.4),M.woodGreen);
  trim.position.y=4.5; st.add(trim);
  dentilRun(st,8.4,4.32,2.18,14);
  // scalloped burgundy valance along the platform edge
  valanceRun(st,8.8,1.12,2.5,0,PAR_valR);
  // finial + pennant on the ridge
  const fin=new THREE.Mesh(new THREE.SphereGeometry(.22,8,7),M.brass);
  fin.position.set(3.6,4.8,0); st.add(fin);
  const pen=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.6,6,2),
    new THREE.MeshStandardMaterial({color:C.butter,side:THREE.DoubleSide,roughness:.9,map:canvasTex}));
  pen.position.set(4.3,4.95,0); pen.userData.flag=true;
  pen.userData.base=pen.geometry.attributes.position.array.slice();
  st.add(pen);
  // station sign
  const stCv=document.createElement('canvas'); stCv.width=512; stCv.height=128;
  const stx=stCv.getContext('2d');
  stx.fillStyle='#f2e9d8'; stx.fillRect(0,0,512,128);
  stx.fillStyle='#b45248'; stx.fillRect(0,0,512,8); stx.fillRect(0,120,512,8);
  stx.fillStyle='#2a2520'; stx.textAlign='center'; stx.textBaseline='middle';
  stx.font='500 62px "Cormorant Garamond", Georgia, serif'; stx.letterSpacing='10px';
  stx.fillText('PROJECTS',256,66);
  const stTex=new THREE.CanvasTexture(stCv); stTex.colorSpace=THREE.SRGBColorSpace;
  const stSign=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.35),
    new THREE.MeshStandardMaterial({map:stTex,roughness:.7,
      emissive:new THREE.Color(C.butter),emissiveMap:stTex,emissiveIntensity:0}));
  stSign.position.set(0,3.3,1.85); st.add(stSign);
  LAMPS.push({mesh:stSign,mat:stSign.material,color:new THREE.Color(C.butter),intensity:.45,zone:'coaster',order:3,lit:0});
  for(let i=0;i<6;i++){
    const b=emissive(C.butter,1.3,.18,'coaster',3);
    b.position.set(-3.4+i*1.36,4.9,1.9); st.add(b);
  }
  curio(st,'Projects Station','All aboard. Mind the gap between the idea and the ship.');
  // the little train of cars
  const cars=new THREE.Group(); coaster.add(cars);
  for(let i=0;i<3;i++){
    const car=new THREE.Group();
    const b=new THREE.Mesh(new THREE.BoxGeometry(1.15,.72,1.75),i===0?M.woodRed:M.woodBlue);
    b.castShadow=true; car.add(b);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.55,.9,7),M.brass);
    nose.rotation.x=-Math.PI/2; nose.position.z=1.2; if(i===0) car.add(nose);
    const lamp=emissive(0xffe0a8,1.1,.14,'coaster',3);
    lamp.position.set(0,.34,.9); if(i===0) car.add(lamp);
    cars.add(car);
  }
  coaster.userData.cars=cars;
}
hotspot(coaster,'coaster','Project Coaster',
  {az:.42,pol:.86,dist:42,tgt:new THREE.Vector3(34,9,-8)});

/* ============================================================
   9 · IDEA CIRCUS — where physics is a suggestion
   ============================================================ */
const TENTS=PC.aiLab.gallery.map((item,i)=>({
  name:item.title,
  kind:item.model||L('生成式视觉实验','Generative visual study'),
  text:item.goal||item.prompt||'',
  color:[C.red,C.blue,C.butter,C.sage][i%4],
  image:contentPath(item.thumbnail||item.image)
}));
const circus=new THREE.Group();
const CI=new THREE.Vector3(-28,0,-3);
circus.position.set(CI.x,hAt(CI.x,CI.z),CI.z); world.add(circus);
{
  const TENT_CFG=[
    {p:[0,0,4],   s:1.0, mode:'float',  matA:M.canvasRed,  matB:M.canvasWhite},
    {p:[-9,0,-3], s:.85, mode:'flip',   matA:M.canvasBlue, matB:M.canvasWhite},
    {p:[6,0,-6],  s:.72, mode:'shrink', matA:M.canvasSage, matB:M.canvasWhite},
    {p:[-4,0,-11],s:.9,  mode:'orbit',  matA:M.canvasWhite,matB:M.canvasRed}
  ];
  const tentObjs=[];
  TENT_CFG.forEach((cfg,i)=>{
    const g=new THREE.Group();
    g.position.set(cfg.p[0],0,cfg.p[2]);
    g.scale.setScalar(cfg.s);
    // striped conical canvas
    const stripes=12;
    for(let s=0;s<stripes;s++){
      const a0=(s/stripes)*Math.PI*2;
      const cone=new THREE.Mesh(
        new THREE.ConeGeometry(4.2,6.4,3,1,true,a0,(Math.PI*2)/stripes),
        s%2?cfg.matA:cfg.matB);
      cone.position.y=5.4; cone.castShadow=true; g.add(cone);
    }
    const drum=new THREE.Mesh(new THREE.CylinderGeometry(4.2,4.2,2.4,14,1,true),cfg.matB);
    drum.position.y=1.2; drum.castShadow=true; g.add(drum);
    const doorway=new THREE.Mesh(new THREE.BoxGeometry(2.1,2.3,.16),M.ink);
    doorway.position.set(0,1.15,4.2); g.add(doorway);
    const glow=emissive(C.amber,1.0,.6,'circus',2);
    glow.position.set(0,1.3,4.05); glow.scale.set(2.6,3.2,.4); g.add(glow);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,2.4,5),M.brass);
    pole.position.y=9.4; g.add(pole);
    const pennant=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.9,6,2),
      new THREE.MeshStandardMaterial({color:i%2?C.butter:C.red,side:THREE.DoubleSide,roughness:.9,map:canvasTex}));
    pennant.position.set(.95,10.2,0); pennant.userData.flag=true;
    pennant.userData.base=pennant.geometry.attributes.position.array.slice();
    pennant.userData.against=true; g.add(pennant);
    // bulbs strung round the drum
    for(let b=0;b<10;b++){
      const a=(b/10)*Math.PI*2;
      const bulb=emissive(C.butter,1.6,.2,'circus',2);
      bulb.position.set(Math.cos(a)*4.3,2.6,Math.sin(a)*4.3); g.add(bulb);
    }
    if(cfg.mode==='orbit'){
      const orb=new THREE.Group(); orb.position.y=6.4; g.add(orb);
      for(let k=0;k<5;k++){
        const shape=k%2?new THREE.TetrahedronGeometry(.42):new THREE.BoxGeometry(.5,.5,.5);
        const o=new THREE.Mesh(shape,k%2?M.brass:M.woodRed);
        o.position.set(Math.cos(k*1.4)*5.4,Math.sin(k*.9)*1.6,Math.sin(k*1.4)*5.4);
        orb.add(o);
      }
      g.userData.orb=orb;
    }
    g.userData.mode=cfg.mode; g.userData.i=i; g.userData.baseY=0;
    circus.add(g); tentObjs.push(g);
  });
  circus.userData.tents=tentObjs;

  // entrance arch with the two signs
  const arch=new THREE.Group(); arch.position.set(0,0,10.5); circus.add(arch);
  [-4,4].forEach(x=>{
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.22,.28,7,6),M.woodGreen);
    p.position.set(x,3.5,0); p.castShadow=true; arch.add(p);
    const capA=new THREE.Mesh(new THREE.CylinderGeometry(.34,.24,.3,8),M.brass);
    capA.position.set(x,6.85,0); arch.add(capA);
    const baseA=new THREE.Mesh(new THREE.CylinderGeometry(.32,.22,.26,8),M.brassDark);
    baseA.position.set(x,.2,0); arch.add(baseA);
  });
  const beam=new THREE.Mesh(new THREE.BoxGeometry(8.8,.4,.4),M.woodGreen);
  beam.position.y=7; arch.add(beam);
  valanceRun(arch,8.6,6.78,.24,0,PAR_valR);
  function signPlank(text,sub,w,h,y,bg,fg){
    const cv=document.createElement('canvas'); cv.width=640; cv.height=sub?200:120;
    const x=cv.getContext('2d');
    x.fillStyle=bg; x.fillRect(0,0,cv.width,cv.height);
    x.strokeStyle='rgba(0,0,0,.18)'; x.lineWidth=6; x.strokeRect(8,8,cv.width-16,cv.height-16);
    x.fillStyle=fg; x.textAlign='center'; x.textBaseline='middle';
    x.font='500 56px "Cormorant Garamond", Georgia, serif'; x.letterSpacing='7px';
    x.fillText(text,cv.width/2,sub?76:60);
    if(sub){ x.font='400 27px Inter, sans-serif'; x.letterSpacing='5px';
      x.globalAlpha=.7; x.fillText(sub,cv.width/2,140); }
    const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.MeshStandardMaterial({map:t,roughness:.75,side:THREE.DoubleSide,
      emissive:new THREE.Color(C.butter),emissiveMap:t,emissiveIntensity:0});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);
    mesh.position.y=y; arch.add(mesh);
    LAMPS.push({mesh,mat:m,color:new THREE.Color(C.butter),intensity:.42,zone:'circus',order:2,lit:0});
    return mesh;
  }
  signPlank('WEIRD IDEAS WELCOME','NO BUSINESS CASE REQUIRED',8.4,2.6,7.9,'#b45248','#f7f0df');
  for(let i=0;i<9;i++){
    const b=emissive(C.butter,1.4,.19,'circus',2);
    b.position.set(-4+i, 7.35, .3); arch.add(b);
  }
  curio(arch,'The Circus Arch','Four featured visuals lead to fourteen experiments and eight product ideas.');
}
hotspot(circus,'circus','Idea Circus',
  {az:-.62,pol:.84,dist:40,tgt:new THREE.Vector3(-27,5,-2)});

/* ==== part5_props ==== */
/* ============================================================
   10 · DOLLY + INFORMATION BOOTH
   ============================================================ */
const booth=new THREE.Group();
const BO=new THREE.Vector3(11,0,26);
booth.position.set(BO.x,hAt(BO.x,BO.z),BO.z); world.add(booth);
{
  const base=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.6,.5,10),M.stone);
  base.position.y=.25; base.receiveShadow=true; booth.add(base);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.1,3.1,10),M.woodCream);
  body.position.y=2.05; body.castShadow=true; booth.add(body);
  const counter=new THREE.Mesh(new THREE.CylinderGeometry(2.45,2.45,.2,10),M.woodGreen);
  counter.position.y=2.4; booth.add(counter);
  // striped awning
  const stripes=10;
  for(let s=0;s<stripes;s++){
    const a0=(s/stripes)*Math.PI*2;
    const c=new THREE.Mesh(
      new THREE.ConeGeometry(3.1,1.5,3,1,true,a0,(Math.PI*2)/stripes),
      s%2?M.canvasRed:M.canvasWhite);
    c.position.y=4.4; c.castShadow=true; booth.add(c);
  }
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),M.brass);
  knob.position.y=5.3; booth.add(knob);
  const win=emissive(0xffdca6,1.0,.9,'gate',0,'box');
  win.position.set(0,2.9,2.05); win.scale.set(2.2,1.6,.5); booth.add(win);
  // INFORMATION sign
  const cv=document.createElement('canvas'); cv.width=512; cv.height=160;
  const x=cv.getContext('2d');
  x.fillStyle='#33473a'; x.fillRect(0,0,512,160);
  x.fillStyle='#f2e9d8'; x.textAlign='center'; x.textBaseline='middle';
  x.font='500 48px "Cormorant Garamond", Georgia, serif'; x.letterSpacing='9px';
  x.fillText('INFORMATION',256,58);
  x.font='400 26px Inter, sans-serif'; x.letterSpacing='6px'; x.globalAlpha=.75;
  x.fillText('ASK DOLLY',256,116);
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.4,1.38),
    new THREE.MeshStandardMaterial({map:tex,roughness:.7,side:THREE.DoubleSide,
      emissive:new THREE.Color(C.butter),emissiveMap:tex,emissiveIntensity:0}));
  sign.position.set(0,6.1,0); booth.add(sign);
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,1.6,5),M.brass);
  post.position.y=5.5; booth.add(post);
  LAMPS.push({mesh:sign,mat:sign.material,color:new THREE.Color(C.butter),intensity:.5,zone:'gate',order:0,lit:0});
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2;
    const b=emissive(C.butter,1.3,.17,'gate',0);
    b.position.set(Math.cos(a)*3.0,3.75,Math.sin(a)*3.0); booth.add(b);
  }
}

// Dolly herself — a small sheep, built from soft lumps
const dolly=new THREE.Group();
dolly.position.set(BO.x+3.6,hAt(BO.x+3.6,BO.z+2.4),BO.z+2.4);
world.add(dolly);
{
  const bodyG=new THREE.Group(); bodyG.position.y=.95; dolly.add(bodyG);
  // fleece: overlapping lumps, flat-shaded, slightly off-white
  const lumps=[[0,0,0,1.0],[.55,.18,.1,.72],[-.55,.16,-.05,.74],[.16,.5,.3,.6],[-.2,.48,-.25,.58],[0,.2,.55,.6],[0,.24,-.55,.6]];
  lumps.forEach(([lx,ly,lz,s])=>{
    const m=new THREE.Mesh(new THREE.IcosahedronGeometry(s,0),M.wool);
    m.position.set(lx,ly,lz); m.castShadow=true; bodyG.add(m);
  });
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.46,0),mat(0x3b3630,{rough:.85,flat:true}));
  head.position.set(0,.62,1.16); head.scale.set(.85,1,1.15); head.castShadow=true; bodyG.add(head);
  const headG=new THREE.Group(); headG.position.copy(head.position); bodyG.add(headG);
  head.position.set(0,0,0); headG.add(head);
  [[-.34,.16,.1],[.34,.16,.1]].forEach(([ex,ey,ez])=>{
    const ear=new THREE.Mesh(new THREE.IcosahedronGeometry(.19,0),mat(0x2f2b26,{rough:.86,flat:true}));
    ear.position.set(ex,ey,ez); ear.scale.set(.6,.5,1.1); headG.add(ear);
  });
  const eyeMat=new THREE.MeshStandardMaterial({color:0x14110e,roughness:.28});
  const eyes=[];
  [[-.19,.08,.42],[.19,.08,.42]].forEach(([ex,ey,ez])=>{
    const e=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),eyeMat);
    e.position.set(ex,ey,ez); headG.add(e); eyes.push(e);
  });
  const tuft=new THREE.Mesh(new THREE.IcosahedronGeometry(.3,0),M.wool);
  tuft.position.set(0,.34,.14); headG.add(tuft);
  [[-.42,-.9,.42],[.42,-.9,.42],[-.42,-.9,-.42],[.42,-.9,-.42]].forEach(([lx,ly,lz])=>{
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.11,.09,.95,5),mat(0x3b3630,{rough:.86}));
    leg.position.set(lx,ly,lz); leg.castShadow=true; bodyG.add(leg);
  });
  const tail=new THREE.Mesh(new THREE.IcosahedronGeometry(.24,0),M.wool);
  tail.position.set(0,.2,-1.05); bodyG.add(tail);
  dolly.userData={bodyG,headG,eyes,state:'idle',t:0,walkTarget:null,home:dolly.position.clone()};
}
/* Dolly is not furniture: these are the places she wanders between.
   Must live at module scope — a block-scoped const is invisible to the loop. */
const DOLLY_STOPS=[[BO.x,BO.z+3],[2,2],[-40,34],[44,36],[66,12],[-46,2],[-24,-30],[-33,60],[26,18],[0,34],[18,-16],[-14,14]];
hotspot(booth,'dolly','Ask Dolly',
  {az:.16,pol:.9,dist:26,tgt:new THREE.Vector3(12,3,25)});
hotspot(dolly,'dolly','Ask Dolly',
  {az:.16,pol:.9,dist:26,tgt:new THREE.Vector3(12,3,25)});

/* ============================================================
   11 · THE GRAVEYARD — not on the map
   ============================================================ */
const GRAVES=[...PC.failures,
  {title:'',meta:'',detail:''},{title:'',meta:'',detail:''},{title:'',meta:'',detail:''}
].map(g=>({a:g.title,b:g.meta,c:'',d:g.detail}));
const graveyard=new THREE.Group();
const GY=new THREE.Vector3(48,0,-25);
graveyard.position.set(GY.x,hAt(GY.x,GY.z),GY.z); world.add(graveyard);
{
  // low iron fence, gate ajar
  for(let i=0;i<16;i++){
    const a=(i/16)*Math.PI*2;
    if(a>2.4&&a<3.2) continue; // gap where you walk in
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,1.5,4),M.ironDark);
    p.position.set(Math.cos(a)*7.2,.7,Math.sin(a)*7.2); graveyard.add(p);
  }
  const ring=new THREE.Mesh(new THREE.TorusGeometry(7.2,.045,4,40,5.0),M.ironDark);
  ring.rotation.x=Math.PI/2; ring.position.y=1.3; graveyard.add(ring);
  GRAVES.forEach((g,i)=>{
    // rows laid out across the visitor's line of sight
    const col=i%3, row=Math.floor(i/3);
    const u=-3.6+col*3.6, v=-2.2+row*4.0;
    const ca=Math.cos(0.66), sa=Math.sin(0.66);
    const gx=u*ca+v*sa+(Math.random()-.5)*.5;
    const gz=-u*sa+v*ca+(Math.random()-.5)*.5;
    const st=new THREE.Group();
    st.position.set(gx,0,gz);
    st.rotation.y=0.66+(Math.random()-.5)*.3;  // faces the arriving visitor
    st.rotation.z=(Math.random()-.5)*.14; // crooked
    graveyard.add(st);
    // engraved face
    const ecv=document.createElement('canvas'); ecv.width=256; ecv.height=320;
    const ex=ecv.getContext('2d');
    ex.fillStyle='#c3b9a6'; ex.fillRect(0,0,256,320);
    ex.globalAlpha=.10; ex.fillStyle='#5e7355';
    for(let k=0;k<70;k++) ex.fillRect(Math.random()*256,Math.random()*320,Math.random()*22,Math.random()*5);
    ex.globalAlpha=1;
    ex.fillStyle='#6b6355'; ex.textAlign='center';
    ex.font='500 34px "Cormorant Garamond", Georgia, serif';
    ex.fillText('RIP',128,72);
    ex.font='500 25px "Cormorant Garamond", Georgia, serif';
    ex.fillStyle='#544d42';
    const wrap=(txt,y)=>{ txt.split(' ').reduce((line,w)=>{
      const test=line?line+' '+w:w;
      if(ex.measureText(test).width>210){ ex.fillText(line,128,y.v); y.v+=30; return w; }
      return test;
    },'')&&0; };
    let yy={v:132};
    [g.a,g.b].forEach(part=>{
      const words=part.split(' '); let line='';
      words.forEach(w=>{
        const test=line?line+' '+w:w;
        if(ex.measureText(test).width>212){ ex.fillText(line,128,yy.v); yy.v+=29; line=w; }
        else line=test;
      });
      if(line){ ex.fillText(line,128,yy.v); yy.v+=34; }
    });
    ex.font='400 16px Inter, sans-serif'; ex.fillStyle='#7a7264';
    ex.fillText(g.c,128,286);
    const etex=new THREE.CanvasTexture(ecv); etex.colorSpace=THREE.SRGBColorSpace;
    const stoneMat=new THREE.MeshStandardMaterial({map:etex,roughness:.94});

    const shape=i%3;
    const stone=shape===0
      ? new THREE.Mesh(new THREE.BoxGeometry(1.5,1.9,.24),[M.stone,M.stone,M.stone,M.stone,stoneMat,M.stone])
      : shape===1
        ? new THREE.Mesh(new THREE.CylinderGeometry(.78,.78,1.85,12,1,false,0,Math.PI),[stoneMat,M.stone,M.stone])
        : new THREE.Mesh(new THREE.BoxGeometry(1.3,1.65,.22),[M.stone,M.stone,M.stone,M.stone,stoneMat,M.stone]);
    if(shape===1){ stone.rotation.y=-Math.PI/2; }
    stone.position.y=1.0; stone.castShadow=true; stone.receiveShadow=true; st.add(stone);
    const moss=new THREE.Mesh(new THREE.IcosahedronGeometry(.34,0),M.woodMoss);
    moss.position.set(.4,.2,.1); moss.scale.set(1,.5,1); st.add(moss);
    // tiny candle
    if(i%2===0){
      const c=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.3,6),M.canvasWhite);
      c.position.set(-.5,.16,.5); st.add(c);
      const fl=emissive(C.amber,1.5,.075,'graveyard',5);
      fl.position.set(-.5,.36,.5); st.add(fl);
    }
    // flowers
    for(let f=0;f<3;f++){
      const fl=new THREE.Mesh(new THREE.SphereGeometry(.11,5,4),mat(f%2?C.red:C.butter,{map:false}));
      fl.position.set((Math.random()-.5)*1.2,.14,.7+Math.random()*.45); st.add(fl);
    }
  });
  // small crooked sign
  const cv=document.createElement('canvas'); cv.width=384; cv.height=128;
  const x=cv.getContext('2d');
  x.fillStyle='#5e7355'; x.fillRect(0,0,384,128);
  x.fillStyle='#f2e9d8'; x.textAlign='center'; x.textBaseline='middle';
  x.font='500 40px "Cormorant Garamond", Georgia, serif'; x.letterSpacing='6px';
  x.fillText('IDEAS AT REST',192,52);
  x.font='400 20px Inter, sans-serif'; x.letterSpacing='4px'; x.globalAlpha=.75;
  x.fillText('PLEASE DO NOT REVIVE',192,94);
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.07),
    new THREE.MeshStandardMaterial({map:tex,roughness:.8,side:THREE.DoubleSide}));
  sign.position.set(-5.0,2.1,5.2); sign.rotation.y=.85; sign.rotation.z=-.06;
  graveyard.add(sign);
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.2,5),M.woodMoss);
  sp.position.set(-5.0,1.1,5.2); sp.rotation.z=-.06; graveyard.add(sp);
  // an old tree leaning over the plot
  const t=makeTree('old'); t.position.set(6.2,-.2,-4.4); t.scale.setScalar(1.4);
  t.rotation.z=.1; graveyard.add(t);
}
hotspot(graveyard,'graveyard','?',
  {az:.66,pol:.86,dist:22,tgt:new THREE.Vector3(48,1.6,-25)});

/* ============================================================
   12 · BACKGROUND ARCHITECTURE & PROPS
   ============================================================ */
// carousel — a proper galloper: carved animals, painted rounding boards, mirrors
const carousel=new THREE.Group();
{
  const P=new THREE.Vector3(26,0,18);
  carousel.position.set(P.x,hAt(P.x,P.z),P.z); world.add(carousel);

  // stepped stone base with a boarding edge
  const base=new THREE.Mesh(new THREE.CylinderGeometry(6.0,6.3,.55,28),M.stone);
  base.position.y=.28; base.receiveShadow=true; carousel.add(base);
  const step=new THREE.Mesh(new THREE.CylinderGeometry(5.5,5.7,.3,28),M.stone);
  step.position.y=.68; step.receiveShadow=true; carousel.add(step);
  const kerbRing=new THREE.Mesh(new THREE.TorusGeometry(6.02,.11,7,36),M.brassDark);
  kerbRing.rotation.x=Math.PI/2; kerbRing.position.y=.56; carousel.add(kerbRing);

  const spin=new THREE.Group(); spin.position.y=.86; carousel.add(spin);

  // rotating deck with painted radial planks
  const deck=new THREE.Mesh(new THREE.CylinderGeometry(5.1,5.1,.22,32),M.woodPaper);
  deck.position.y=.11; deck.receiveShadow=true; spin.add(deck);
  for(let i=0;i<16;i++){
    const a=(i/16)*Math.PI*2;
    const plank=new THREE.Mesh(new THREE.BoxGeometry(4.9,.03,.34),
      i%2?M.woodCream:M.woodRed);
    plank.position.set(Math.cos(a)*2.5,.235,Math.sin(a)*2.5);
    plank.rotation.y=-a; spin.add(plank);
  }

  // central drum: painted panels with mirrors between them
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.25,4.6,16),M.woodCream);
  drum.position.y=2.5; drum.castShadow=true; spin.add(drum);
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2;
    // painted panel
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.86,2.9,.07),
      [M.canvasRed,M.canvasBlue,M.canvasSage,M.terracotta][i%4]);
    panel.position.set(Math.cos(a)*1.28,2.5,Math.sin(a)*1.28);
    panel.rotation.y=-a+Math.PI/2; spin.add(panel);
    // brass mirror strip
    const mir=new THREE.Mesh(new THREE.BoxGeometry(.2,3.3,.05),
      mat(0xd9d3c4,{rough:.16,metal:.5}));
    const a2=a+Math.PI/8;
    mir.position.set(Math.cos(a2)*1.3,2.5,Math.sin(a2)*1.3);
    mir.rotation.y=-a2+Math.PI/2; spin.add(mir);
  }
  const drumCap=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.35,.3,16),M.brass);
  drumCap.position.y=4.9; spin.add(drumCap);

  // twelve brass poles, each with a carved animal
  const ANIMALS=['horse','horse','swan','horse','rabbit','horse',
                 'horse','swan','horse','rooster','horse','rabbit'];
  const animals=[];
  ANIMALS.forEach((kind,i)=>{
    const a=(i/12)*Math.PI*2;
    const R=4.15;
    const px=Math.cos(a)*R, pz=Math.sin(a)*R;
    // twisted brass pole
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,4.5,7),M.brass);
    pole.position.set(px,2.35,pz); spin.add(pole);
    const collar=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.1,8),M.brassDark);
    collar.position.set(px,4.35,pz); spin.add(collar);

    const g=new THREE.Group();
    g.position.set(px,1.55,pz);
    g.rotation.y=-a+Math.PI/2;     // face the direction of travel
    g.userData.bob=i; g.userData.baseY=1.55;
    spin.add(g); animals.push(g);

    const bodyMat=[M.woodCream,M.woodRed,M.woodBlue,M.canvasWhite,M.terracotta][i%5];
    const trimMat=[M.canvasRed,M.brass,M.canvasBlue,M.woodGreen][i%4];

    if(kind==='horse'){
      // barrel body
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.95,6,10),bodyMat);
      body.rotation.z=Math.PI/2; body.position.y=.05; body.castShadow=true; g.add(body);
      // neck and head, angled up
      const neck=new THREE.Mesh(new THREE.CylinderGeometry(.19,.25,.72,8),bodyMat);
      neck.position.set(.55,.36,0); neck.rotation.z=-.62; g.add(neck);
      const head=new THREE.Mesh(new THREE.BoxGeometry(.5,.26,.24),bodyMat);
      head.position.set(.94,.6,0); head.rotation.z=-.2; g.add(head);
      const muzzle=new THREE.Mesh(new THREE.BoxGeometry(.2,.18,.2),bodyMat);
      muzzle.position.set(1.16,.55,0); g.add(muzzle);
      [-.1,.1].forEach(ez=>{
        const ear=new THREE.Mesh(new THREE.ConeGeometry(.06,.18,5),bodyMat);
        ear.position.set(.82,.76,ez); ear.rotation.z=-.2; g.add(ear);
        const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,6,6),M.ink);
        eye.position.set(1.0,.63,ez*1.6); g.add(eye);
      });
      // mane and tail
      for(let m=0;m<5;m++){
        const tuft=new THREE.Mesh(new THREE.BoxGeometry(.1,.2,.16),trimMat);
        tuft.position.set(.72-m*.13,.62-m*.05,0); tuft.rotation.z=-.5; g.add(tuft);
      }
      const tail=new THREE.Mesh(new THREE.ConeGeometry(.14,.62,6),trimMat);
      tail.position.set(-.74,.2,0); tail.rotation.z=1.25; g.add(tail);
      // four legs, mid-gallop
      [[-.42,-.24,.5],[-.32,.24,-.35],[.36,-.24,-.55],[.44,.24,.45]].forEach(([lx,lz,rot])=>{
        const leg=new THREE.Mesh(new THREE.CylinderGeometry(.07,.05,.78,6),bodyMat);
        leg.position.set(lx,-.34,lz*.62); leg.rotation.x=rot*.4; leg.rotation.z=rot*.5;
        g.add(leg);
        const hoof=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.12,6),M.brassDark);
        hoof.position.set(lx-rot*.14,-.7,lz*.62+rot*.1); g.add(hoof);
      });
      // saddle and bridle
      const saddle=new THREE.Mesh(new THREE.BoxGeometry(.46,.14,.5),trimMat);
      saddle.position.set(-.02,.34,0); g.add(saddle);
      const strap=new THREE.Mesh(new THREE.TorusGeometry(.3,.03,5,12),M.brass);
      strap.position.set(-.02,.05,0); strap.rotation.y=Math.PI/2; g.add(strap);
    } else if(kind==='swan'){
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.7,6,10),M.canvasWhite);
      body.rotation.z=Math.PI/2; body.castShadow=true; g.add(body);
      const neck=new THREE.Mesh(new THREE.CylinderGeometry(.11,.15,1.0,8),M.canvasWhite);
      neck.position.set(.5,.5,0); neck.rotation.z=-.36; g.add(neck);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),M.canvasWhite);
      head.position.set(.78,.94,0); g.add(head);
      const beak=new THREE.Mesh(new THREE.ConeGeometry(.07,.24,6),M.brass);
      beak.position.set(.96,.92,0); beak.rotation.z=-Math.PI/2; g.add(beak);
      [-1,1].forEach(sd=>{
        const wing=new THREE.Mesh(new THREE.SphereGeometry(.38,10,8),M.canvasWhite);
        wing.position.set(-.05,.14,sd*.34); wing.scale.set(1.1,.5,.42); g.add(wing);
      });
      const seat=new THREE.Mesh(new THREE.BoxGeometry(.5,.12,.46),trimMat);
      seat.position.set(-.3,.42,0); g.add(seat);
    } else if(kind==='rabbit'){
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.33,.6,6,10),bodyMat);
      body.rotation.z=Math.PI/2.4; body.castShadow=true; g.add(body);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),bodyMat);
      head.position.set(.6,.42,0); g.add(head);
      [-.12,.12].forEach(ez=>{
        const ear=new THREE.Mesh(new THREE.CapsuleGeometry(.06,.44,4,6),bodyMat);
        ear.position.set(.54,.86,ez); ear.rotation.z=-.16; g.add(ear);
        const eye=new THREE.Mesh(new THREE.SphereGeometry(.04,6,6),M.ink);
        eye.position.set(.78,.46,ez*1.5); g.add(eye);
      });
      const tail=new THREE.Mesh(new THREE.SphereGeometry(.15,8,7),M.canvasWhite);
      tail.position.set(-.62,.2,0); g.add(tail);
      [[-.3,-.3],[-.3,.3],[.3,-.28],[.3,.28]].forEach(([lx,lz])=>{
        const leg=new THREE.Mesh(new THREE.CylinderGeometry(.075,.06,.6,6),bodyMat);
        leg.position.set(lx,-.3,lz); g.add(leg);
      });
      const seat=new THREE.Mesh(new THREE.BoxGeometry(.44,.12,.44),trimMat);
      seat.position.set(-.04,.34,0); g.add(seat);
    } else { // rooster
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.36,.5,6,10),bodyMat);
      body.rotation.z=Math.PI/2.6; body.castShadow=true; g.add(body);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),bodyMat);
      head.position.set(.52,.6,0); g.add(head);
      const comb=new THREE.Mesh(new THREE.BoxGeometry(.08,.2,.16),M.canvasRed);
      comb.position.set(.52,.8,0); g.add(comb);
      const beak=new THREE.Mesh(new THREE.ConeGeometry(.07,.2,5),M.brass);
      beak.position.set(.72,.58,0); beak.rotation.z=-Math.PI/2; g.add(beak);
      for(let t=0;t<4;t++){
        const f=new THREE.Mesh(new THREE.ConeGeometry(.09,.6,5),
          t%2?M.canvasRed:trimMat);
        f.position.set(-.6,.3+t*.1,0); f.rotation.z=1.1+t*.14; g.add(f);
      }
      [[-.2,-.22],[-.2,.22]].forEach(([lx,lz])=>{
        const leg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.045,.58,6),M.brass);
        leg.position.set(lx,-.32,lz); g.add(leg);
      });
      const seat=new THREE.Mesh(new THREE.BoxGeometry(.42,.12,.42),trimMat);
      seat.position.set(-.06,.4,0); g.add(seat);
    }
  });
  carousel.userData.animals=animals;

  // three chariots between the animals, for the ones who do not gallop
  [1.5,5.5,9.5].forEach(slot=>{
    const a=(slot/12)*Math.PI*2, R=4.15;
    const ch=new THREE.Group();
    ch.position.set(Math.cos(a)*R,1.25,Math.sin(a)*R);
    ch.rotation.y=-a+Math.PI/2; spin.add(ch);
    const tub=new THREE.Mesh(new THREE.BoxGeometry(1.5,.62,.9),M.woodBlue);
    tub.castShadow=true; ch.add(tub);
    const bench=new THREE.Mesh(new THREE.BoxGeometry(1.3,.1,.66),M.woodCream);
    bench.position.y=.33; ch.add(bench);
    const scroll=new THREE.Mesh(new THREE.TorusGeometry(.28,.07,6,14,Math.PI),M.brass);
    scroll.position.set(-.78,.22,0); scroll.rotation.set(Math.PI/2,0,0); ch.add(scroll);
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(.26,.05,5,12),M.brassDark);
    wheel.position.set(.5,-.3,.46); ch.add(wheel);
    const wheel2=wheel.clone(); wheel2.position.z=-.46; ch.add(wheel2);
  });

  // canopy: scalloped stripes with a painted rounding board and bulbs
  const stripes=16;
  for(let s2=0;s2<stripes;s2++){
    const a0=(s2/stripes)*Math.PI*2;
    const c=new THREE.Mesh(
      new THREE.ConeGeometry(5.9,2.2,4,1,true,a0,(Math.PI*2)/stripes),
      s2%2?M.canvasRed:M.canvasWhite);
    c.position.y=5.6; c.castShadow=true; spin.add(c);
  }
  // rounding board: a vertical painted ring with lettering
  {
    const rcv=document.createElement('canvas'); rcv.width=1024; rcv.height=96;
    const rc=rcv.getContext('2d');
    rc.fillStyle='#33473a'; rc.fillRect(0,0,1024,96);
    rc.fillStyle='#f2e9d8'; rc.textAlign='center'; rc.textBaseline='middle';
    rc.font='500 46px "Cormorant Garamond", Georgia, serif'; rc.letterSpacing='10px';
    for(let r=0;r<4;r++) rc.fillText('THE GALLOPERS',128+r*256,50);
    const rtex=new THREE.CanvasTexture(rcv); rtex.colorSpace=THREE.SRGBColorSpace;
    rtex.wrapS=THREE.RepeatWrapping;
    const boardMat=new THREE.MeshStandardMaterial({map:rtex,roughness:.72,
      emissive:new THREE.Color(C.butter),emissiveMap:rtex,emissiveIntensity:0,
      side:THREE.DoubleSide});
    const board=new THREE.Mesh(new THREE.CylinderGeometry(5.75,5.75,.85,40,1,true),boardMat);
    board.position.y=4.58; spin.add(board);
    LAMPS.push({mesh:board,mat:boardMat,color:new THREE.Color(C.butter),
      intensity:.5,zone:'buildings',order:0,lit:0});
  }
  // scalloped valance below the board
  for(let i=0;i<24;i++){
    const a=(i/24)*Math.PI*2;
    const sc=new THREE.Mesh(new THREE.SphereGeometry(.42,8,6,0,Math.PI*2,0,Math.PI/2),
      i%2?M.canvasRed:M.canvasWhite);
    sc.position.set(Math.cos(a)*5.7,4.06,Math.sin(a)*5.7);
    sc.rotation.x=Math.PI; spin.add(sc);
  }
  // bulbs around the rim, and a second ring up on the canopy
  for(let i=0;i<20;i++){
    const a=(i/20)*Math.PI*2;
    const b=emissive(C.butter,1.6,.15,'buildings',1);
    b.position.set(Math.cos(a)*5.86,5.06,Math.sin(a)*5.86); spin.add(b);
    if(i%2===0){
      const b2=emissive(C.butter,1.3,.12,'buildings',1);
      b2.position.set(Math.cos(a)*3.4,6.28,Math.sin(a)*3.4); spin.add(b2);
    }
  }
  // crown: tiered finial with a flag
  const tier=new THREE.Mesh(new THREE.ConeGeometry(1.5,.9,12),M.canvasRed);
  tier.position.y=6.9; spin.add(tier);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.36,12,10),M.brass);
  knob.position.y=7.5; spin.add(knob);
  const mastTop=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.1,6),M.brassDark);
  mastTop.position.y=8.1; spin.add(mastTop);
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(.9,.5),
    mat(0xeaa94e,{rough:.9,side:THREE.DoubleSide}));
  flag.position.set(.45,8.42,0); spin.add(flag);
  carousel.userData.crownFlag=flag;

  carousel.userData.spin=spin;

  hotspot(carousel,'carousel','The Gallopers',
    {az:.42,pol:1.09,dist:27,tgt:new THREE.Vector3(P.x,2.6,P.z)});
}

// arcade & pavilion facades to the west — silhouettes that give the park depth
function pavilion(x,z,w,d,h,roofMat,bodyMat,label){
  const g=new THREE.Group();
  g.position.set(x,hAt(x,z),z); world.add(g);
  const plinth=new THREE.Mesh(new THREE.BoxGeometry(w+.9,.6,d+.9),M.stone);
  plinth.position.y=.3; plinth.receiveShadow=true; g.add(plinth);
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),bodyMat);
  body.position.y=h/2+.5; body.castShadow=body.receiveShadow=true; g.add(body);
  // hipped roof from a 4-sided cone, with an overhanging eave board
  const eave=new THREE.Mesh(new THREE.BoxGeometry(w+1.5,.24,d+1.5),roofMat);
  eave.position.y=h+.58; eave.castShadow=true; g.add(eave);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w,d)*.56,h*.62,4),roofMat);
  roof.position.y=h+.7+h*.31; roof.rotation.y=Math.PI/4; roof.castShadow=true; g.add(roof);
  const ridge=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),M.brass);
  ridge.position.y=h+.7+h*.62; g.add(ridge);
  const trim=new THREE.Mesh(new THREE.BoxGeometry(w+.3,.26,d+.3),M.brassDark);
  trim.position.y=h*.5+.5; g.add(trim);
  // corner pilasters give the facade some relief
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
    const p=new THREE.Mesh(new THREE.BoxGeometry(.34,h,.34),M.woodCream);
    p.position.set(sx*w/2,h/2+.5,sz*d/2); g.add(p);
  });
  // lit windows
  const cols=Math.max(2,Math.round(w/2.4));
  for(let i=0;i<cols;i++){
    const win=emissive(0xffd9a0,.85,.7,'buildings',1,'box');
    win.position.set(-w/2+ (i+.5)*(w/cols), h*.5+.5, d/2+.06);
    win.scale.set(1.1,1.5,1); g.add(win);
  }
  if(label){
    const cv=document.createElement('canvas'); cv.width=512; cv.height=110;
    const c=cv.getContext('2d');
    c.fillStyle='#2a2520'; c.fillRect(0,0,512,110);
    c.fillStyle='#e6c876'; c.textAlign='center'; c.textBaseline='middle';
    c.font='500 52px "Cormorant Garamond", Georgia, serif'; c.letterSpacing='10px';
    c.fillText(label,256,58);
    const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.MeshStandardMaterial({map:tex,roughness:.6,
      emissive:new THREE.Color(C.butter),emissiveMap:tex,emissiveIntensity:0});
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(w*.86,w*.86*110/512),m);
    sg.position.set(0,h+.32,d/2+.42); g.add(sg);
    LAMPS.push({mesh:sg,mat:m,color:new THREE.Color(C.butter),intensity:.5,zone:'buildings',order:1,lit:0});
  }
  return g;
}
const PAVILION_COPY=[
  ['The Arcade','AI, product, research and building capabilities.'],
  ['The Prize Stall','Selected awards, outcomes and evidence.'],
  ['The Quiet Pavilion','A place for reflection after building.'],
  ['The Story Garden','Sixteen prompts, methods, notes and readings.'],
  ['Futureland','Recent builds and current directions.'],
  ['The Spare Pavilion','Space deliberately left open.']
];
[[-34,20,9,6,4.4,M.woodRed,M.woodCream],
 [-40,8,7,5,3.6,M.woodBlue,M.woodPaper],
 [20,32,6.5,5,3.4,M.woodRed,M.woodCream],
 [-20,34,7.5,5.5,3.8,M.woodGreen,M.woodPaper],
 [40,-40,8,6,4.0,M.woodBlue,M.woodCream],
 [-46,-14,6,5,3.2,M.terracotta,M.woodPaper]].forEach((a,i)=>{
  const labels=['ARCADE','PRIZES',null,'STORY GARDEN','FUTURELAND',null];
  const g=pavilion(a[0],a[1],a[2],a[3],a[4],a[5],a[6],labels[i]);
  curio(g,PAVILION_COPY[i][0],PAVILION_COPY[i][1]);
});

// scaffolding hint at futureland — the park is never finished
{
  const g=new THREE.Group(); g.position.set(44,hAt(44,-34),-34); world.add(g);
  for(let i=0;i<4;i++){
    for(let j=0;j<3;j++){
      const p=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,6,4),M.brassDark);
      p.position.set(i*1.7-2.5,3,j*1.7-1.7); g.add(p);
    }
  }
  for(let k=0;k<3;k++){
    const b=new THREE.Mesh(new THREE.BoxGeometry(6,.12,4.6),M.brassDark);
    b.position.set(-.4,1.6+k*1.9,-.85); g.add(b);
  }
  const crane=new THREE.Mesh(new THREE.BoxGeometry(.5,9,.5),M.woodRed);
  crane.position.set(-4,4.5,2); g.add(crane);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(7,.4,.4),M.woodRed);
  arm.position.set(-1,8.8,2); g.add(arm);
  const work=emissive(0xfff0c0,1.6,.3,'buildings',1);
  work.position.set(-1,8.4,2); g.add(work);
  curio(g,'The Scaffolding','Futureland, arriving eventually. The crane remains optimistic.');
}

// lamp posts along the paths — the second wave of the cascade
const LAMP_POOLS=[];
/* puddles on the promenade — invisible until it rains */
const PUDDLES=[];
{
  const pmat=()=>new THREE.MeshStandardMaterial({
    color:0x9fb4c2, roughness:.05, metalness:.62,
    transparent:true, opacity:0, depthWrite:false});
  const spots=[];
  [[mainPath,9],[eastPath,5],[westPath,4],[pondPath,3],
   [gardenPath,3],[futurePath,3],[galleryPath,3],[arcadePath,2]].forEach(([c,n])=>{
    for(let i=0;i<n;i++){
      const t=(i+.5)/n;
      const p=c.getPoint(t), tan=c.getTangent(t).normalize();
      const side=new THREE.Vector3().crossVectors(tan,new THREE.Vector3(0,1,0)).normalize();
      const off=(Math.random()-.5)*2.4;
      spots.push([p.x+side.x*off, p.z+side.z*off, Math.atan2(tan.x,tan.z)]);
    }
  });
  spots.forEach(([x,z,ry],i)=>{
    const w=1.6+Math.random()*2.6, h=1.0+Math.random()*1.7;
    const g=new THREE.Mesh(new THREE.CircleGeometry(1,14),pmat());
    g.scale.set(w,h,1);
    g.rotation.x=-Math.PI/2; g.rotation.z=ry;
    g.position.set(x,hAt(x,z)+.045,z);
    g.renderOrder=1; g.visible=false;
    world.add(g); PUDDLES.push(g);
  });
}
function lampPost(x,z,tall){
  const g=new THREE.Group(); g.position.set(x,hAt(x,z),z); world.add(g);
  const h=tall?5.4:4.2;
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.11,.17,h,7),M.ironDark);
  post.position.y=h/2; post.castShadow=true; g.add(post);
  const arm=new THREE.Mesh(new THREE.TorusGeometry(.5,.06,5,10,Math.PI/2),M.ironDark);
  arm.position.y=h; arm.rotation.y=Math.PI/2; g.add(arm);
  const cage=new THREE.Mesh(new THREE.CylinderGeometry(.34,.24,.7,7),
    new THREE.MeshStandardMaterial({color:C.parchment,roughness:.5,transparent:true,opacity:.55}));
  cage.position.set(0,h-.1,.5); g.add(cage);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.4,.3,7),M.brassDark);
  cap.position.set(0,h+.34,.5); g.add(cap);
  const bulb=emissive(C.butter,2.4,.19,'paths',1);
  bulb.position.set(0,h-.12,.5); g.add(bulb);
  // ground pool, faded in with the bulbs
  const poolMat=new THREE.MeshBasicMaterial({color:0xffdba4,transparent:true,
    opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  const pool=new THREE.Mesh(new THREE.CircleGeometry(tall?4.2:3.4,20),poolMat);
  pool.rotation.x=-Math.PI/2; pool.position.set(0,.07,.5); pool.renderOrder=2;
  g.add(pool);
  LAMP_POOLS.push({mat:poolMat,peak:tall?.30:.24});
  return g;
}
const LAMP_SPOTS=[];
[[mainPath,7,4.2],[eastPath,4,3.0],[westPath,3,2.8],[pondPath,3,2.4],
 [gardenPath,3,2.6],[arcadePath,2,2.6],[futurePath,3,2.6],[galleryPath,3,2.6],
 [globePath,2,2.4],[prizePath,2,2.4],[carouselPath,1,2.2]].forEach(([curve,count,off])=>{
  for(let i=0;i<count;i++){
    const t=(i+.5)/count;
    const p=curve.getPoint(t), tan=curve.getTangent(t);
    const side=new THREE.Vector3().crossVectors(tan,new THREE.Vector3(0,1,0)).normalize();
    const s=i%2?1:-1;
    LAMP_SPOTS.push([p.x+side.x*off*s, p.z+side.z*off*s]);
  }
});
const LAMP_CAPTIONS=[
  'Lit at dusk, faithful as regret.',
  'Moths check in. They rarely check out.',
  'Warms the path and nothing else. It knows its job.',
  'Repainted every spring, out of principle.',
  'Buzzes quietly, like it\u2019s thinking.',
  'Leans a little. So do the best ideas.'
];
LAMP_SPOTS.forEach(([x,z],i)=>curio(lampPost(x,z,i%5===0),'Lamp Post',LAMP_CAPTIONS[i%LAMP_CAPTIONS.length]));

// benches, posters, balloons, luggage
function bench(x,z,ry){
  const g=new THREE.Group(); g.position.set(x,hAt(x,z),z); g.rotation.y=ry; world.add(g);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(2.6,.14,.8),M.woodGreen);
  seat.position.y=.62; seat.castShadow=true; g.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(2.6,.7,.12),M.woodGreen);
  back.position.set(0,1.0,-.36); g.add(back);
  [-1.1,1.1].forEach(sx=>{
    const l=new THREE.Mesh(new THREE.BoxGeometry(.14,.62,.7),M.ironDark);
    l.position.set(sx,.31,0); g.add(l);
  });
  return g;
}
const BENCH_CAPTIONS=[
  'Sat on by every visitor who almost had an idea.',
  'Worn in the middle first. Everyone sits in the middle.',
  'Inscribed on the underside: \u201cstay a while\u201d. Nobody has checked.',
  'The view is free, which is the point.',
  'Reserved by nobody, forever.',
  'Colder than it looks. Character-building.'
];
[[7,32,.3],[-8,20,-.5],[14,12,1.2],[-18,10,.9],[30,28,-.7],[-26,30,.2]].forEach((b,i)=>{
  curio(bench(...b),'Park Bench',BENCH_CAPTIONS[i%BENCH_CAPTIONS.length]);
});

// poster boards with faded printing
function poster(x,z,ry,txt,sub,bg){
  const g=new THREE.Group(); g.position.set(x,hAt(x,z),z); g.rotation.y=ry; world.add(g);
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,3.2,5),M.woodCream);
  post.position.y=1.6; g.add(post);
  const cv=document.createElement('canvas'); cv.width=320; cv.height=440;
  const c=cv.getContext('2d');
  c.fillStyle=bg; c.fillRect(0,0,320,440);
  c.strokeStyle='rgba(0,0,0,.2)'; c.lineWidth=8; c.strokeRect(14,14,292,412);
  c.fillStyle='#f7f0df'; c.textAlign='center';
  c.font='500 46px "Cormorant Garamond", Georgia, serif';
  txt.split('\n').forEach((line,i)=>c.fillText(line,160,140+i*52));
  c.font='400 20px Inter, sans-serif'; c.globalAlpha=.8; c.letterSpacing='4px';
  c.fillText(sub,160,360);
  c.globalAlpha=.12; c.fillStyle='#000';
  for(let i=0;i<40;i++) c.fillRect(Math.random()*320,Math.random()*440,Math.random()*30,1);
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const p=new THREE.Mesh(new THREE.PlaneGeometry(1.9,2.6),
    new THREE.MeshStandardMaterial({map:tex,roughness:.9,side:THREE.DoubleSide}));
  p.position.y=2.4; p.rotation.z=(Math.random()-.5)*.04; g.add(p);
  return g;
}
const POSTERS=[
  [6,30,-.4,'TONIGHT\nLIGHTS ON','AT THE FERRIS WHEEL','#b45248','Poster: Lights On','Printed for one evening. Kept out of sentiment.'],
  [-10,12,.8,'WEIRD\nIDEAS','THIS WAY →','#7b93a9','Poster: Weird Ideas','The arrow points at the circus. It always did.'],
  [22,4,-1.2,'FIVE\nRIDES','FEATURED PROJECTS','#5e7355','Poster: Five Rides','Five featured projects; all eighteen wait in the archive.'],
  [-3,40,.2,'MOSTLY\nOPEN','ALL SEASONS','#bd7355','Poster: Mostly Open','The park\u2019s entire legal position, in two words.']
];
POSTERS.forEach(p=>curio(poster(p[0],p[1],p[2],p[3],p[4],p[5]),p[6],p[7]));

// drifting balloons tied near the gate
const balloons=new THREE.Group(); world.add(balloons);
[[C.red,-7,32],[C.butter,-7.4,32.6],[C.blue,-6.6,32.7]].forEach(([col,x,z],i)=>{
  const b=new THREE.Mesh(new THREE.SphereGeometry(.55,12,10),mat(col,{rough:.5,map:false}));
  b.position.set(x,hAt(x,z)+5.4+i*.5,z);
  b.scale.y=1.2; b.userData.i=i; balloons.add(b);
  const str=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,4.6,3),M.ironDark);
  str.position.set(x,hAt(x,z)+2.7+i*.25,z); balloons.add(str);
});
curio(balloons,'The Gate Balloons','Tethered since opening day. Nobody remembers buying them.');

/* ============================================================
   13 · ATMOSPHERE — motes, stars, birds, fireflies
   ============================================================ */
function pointCloud(n,spread,size,color,opacity){
  const g=new THREE.BufferGeometry();
  const p=new Float32Array(n*3), ph=new Float32Array(n);
  for(let i=0;i<n;i++){
    p[i*3]=(Math.random()-.5)*spread;
    p[i*3+1]=Math.random()*38+1;
    p[i*3+2]=(Math.random()-.5)*spread;
    ph[i]=Math.random()*Math.PI*2;
  }
  g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const m=new THREE.PointsMaterial({color,size,transparent:true,opacity,depthWrite:false,
    sizeAttenuation:true,blending:THREE.AdditiveBlending});
  const pts=new THREE.Points(g,m); pts.userData={ph,base:p.slice()};
  world.add(pts); return pts;
}
const motes=pointCloud(MOBILE?90:230,150,.34,0xfff2d4,.5);
const fireflies=pointCloud(MOBILE?40:110,120,.42,0xffe08a,0);

/* Legacy sprite stars removed: the sky dome shader draws the stars now.
   Those Points shells sat at radius 760 with y forced positive, which put them
   above the narrow band of sky the camera frames — they only ever showed up as
   stray specks floating over the horizon. `starLayers` stays as an empty list so
   the existing drivers keep working without branching. */
const starLayers=[];
const stars={material:{opacity:0},userData:{bright:1},
  scale:{setScalar(){}}};

// birds: small V shapes that cross the sky by day
const birds=new THREE.Group(); world.add(birds);
for(let i=0;i<7;i++){
  const bg=new THREE.BufferGeometry();
  bg.setAttribute('position',new THREE.Float32BufferAttribute([-.7,0,0, 0,.22,0, .7,0,0],3));
  const b=new THREE.Line(bg,new THREE.LineBasicMaterial({color:0x4b4a44,transparent:true,opacity:.6}));
  b.userData={t:Math.random(),speed:lerp(.012,.026,Math.random()),y:lerp(26,40,Math.random()),
    z:lerp(-70,50,Math.random()),ph:Math.random()*6};
  birds.add(b);
}

// rain & snow, prepared but idle
/* precipitation volume: wide enough to read as weather over the whole valley,
   and re-centred on the camera each frame so it never runs out at the edges */
const RAIN_SPAN=MOBILE?300:460, RAIN_H=MOBILE?70:86;
const SNOW_SPAN=MOBILE?300:460, SNOW_H=MOBILE?66:80;
const rain=(()=>{
  const n=MOBILE?900:2600;
  const g=new THREE.BufferGeometry();
  const p=new Float32Array(n*6), seed=new Float32Array(n*2);
  for(let i=0;i<n;i++){
    const x=(Math.random()-.5)*RAIN_SPAN, y=Math.random()*RAIN_H, z=(Math.random()-.5)*RAIN_SPAN;
    const len=1.7+Math.random()*2.3;
    p[i*6]=x;   p[i*6+1]=y;      p[i*6+2]=z;      // streak top
    p[i*6+3]=x+.18; p[i*6+4]=y-len; p[i*6+5]=z;   // streak bottom, slight slant
    seed[i*2]=len; seed[i*2+1]=y;
  }
  g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const m=new THREE.LineBasicMaterial({color:0xdCEaF4,transparent:true,opacity:0,depthWrite:false});
  const seg=new THREE.LineSegments(g,m); seg.userData.len=seed; world.add(seg); return seg;
})();
const snow=(()=>{
  const n=MOBILE?600:1800;
  const g=new THREE.BufferGeometry(); const p=new Float32Array(n*3);
  for(let i=0;i<n;i++){ p[i*3]=(Math.random()-.5)*SNOW_SPAN; p[i*3+1]=Math.random()*SNOW_H; p[i*3+2]=(Math.random()-.5)*SNOW_SPAN; }
  g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const m=new THREE.PointsMaterial({color:0xffffff,size:1.15,transparent:true,opacity:0,depthWrite:false});
  const pts=new THREE.Points(g,m); world.add(pts); return pts;
})();


/* ── FIREWORKS ─────────────────────────────────────────────────────────
   Real bursts in world space, above the park. The dome shader can't carry
   them: at the arrival camera the sky is only a few percent of the frame,
   so painted-on sky effects fall outside the picture entirely. */
const FIREWORKS=(()=>{
  const SHELLS=MOBILE?4:7, PER=MOBILE?54:130;
  const N=SHELLS*PER;
  const pos=new Float32Array(N*3), col=new Float32Array(N*3), siz=new Float32Array(N);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  g.setAttribute('size',new THREE.BufferAttribute(siz,1));

  // soft round spark, so particles glow instead of showing square edges
  const cv=document.createElement('canvas'); cv.width=cv.height=64;
  const cx=cv.getContext('2d');
  const rg=cx.createRadialGradient(32,32,0,32,32,32);
  rg.addColorStop(0,'rgba(255,255,255,1)');
  rg.addColorStop(.28,'rgba(255,255,255,.85)');
  rg.addColorStop(.65,'rgba(255,255,255,.22)');
  rg.addColorStop(1,'rgba(255,255,255,0)');
  cx.fillStyle=rg; cx.fillRect(0,0,64,64);
  const tex=new THREE.CanvasTexture(cv);

  const mat=new THREE.ShaderMaterial({
    uniforms:{ uTex:{value:tex}, uOpacity:{value:0}, uScale:{value:innerHeight*.9} },
    transparent:true, depthWrite:false, depthTest:true,
    blending:THREE.AdditiveBlending,
    vertexShader:`
      attribute float size;
      varying vec3 vCol;
      uniform float uScale;
      void main(){
        vCol=color;
        vec4 mv=modelViewMatrix*vec4(position,1.);
        gl_PointSize=clamp(size*16.*uScale/max(1.,-mv.z),2.,30.);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      uniform sampler2D uTex; uniform float uOpacity;
      varying vec3 vCol;
      void main(){
        vec4 t=texture2D(uTex,gl_PointCoord);
        gl_FragColor=vec4(vCol,1.)*t.a*uOpacity*1.0;
      }`,
    vertexColors:true});
  const pts=new THREE.Points(g,mat);
  pts.frustumCulled=false; pts.visible=false; pts.renderOrder=3;
  world.add(pts);

  const PALETTE=[0xffd9e6,0xbfe6ff,0xffe6a8,0xd9c2ff,0xa8ffd6,0xffc2a8];
  // shells ring the park so bursts show wherever the camera is pointed
  const shells=[];
  for(let i=0;i<SHELLS;i++){
    shells.push({
      t:-i*0.85,                       // staggered so they don't fire in unison
      life:2.4+Math.random()*1.3,
      org:new THREE.Vector3(),
      vel:new Array(PER).fill(0).map(()=>new THREE.Vector3()),
      drag:new Float32Array(PER).fill(1.15),
      rise:.7,
      col:new THREE.Color(PALETTE[i%PALETTE.length]),
      spin:Math.random()*6.28
    });
  }
  const _d=new THREE.Vector3(), _o=new THREE.Vector3();
  const arm=sh=>{
    sh.rise=.55+Math.random()*.35;      // climb time before the shell breaks
    camera.getWorldDirection(_d);
    // yaw within the frame, then lift into the thin strip of sky that is visible
    const yaw=(Math.random()-.5)*.52;
    const cy=Math.cos(yaw), sy=Math.sin(yaw);
    const dx=_d.x*cy-_d.z*sy, dz=_d.x*sy+_d.z*cy;
    _o.set(dx,0,dz).normalize();
    const elev=-.075+Math.random()*.055;     // measured visible band
    _o.y=elev; _o.normalize();
    const dist=175+Math.random()*130;
    sh.org.copy(camera.position).addScaledVector(_o,dist);
    if(sh.org.y<14) sh.org.y=14+Math.random()*10;
    sh.col.set(PALETTE[(Math.random()*PALETTE.length)|0]);
    sh.life=2.3+Math.random()*1.4;
    const speed=26+Math.random()*20;
    // two nested shells: a tight core and a wider crown, like a real peony
    for(let k=0;k<PER;k++){
      const y=1-(k+.5)/PER*2, r=Math.sqrt(Math.max(0,1-y*y));
      const th=k*2.399963+sh.spin;
      const inner=(k%3)===0;
      sh.vel[k].set(Math.cos(th)*r,y,Math.sin(th)*r)
        .multiplyScalar(speed*(inner?.42:.86)*(.82+Math.random()*.34));
      sh.drag[k]=inner?1.65:1.05;        // core sparks brake sooner
    }
    sh.t=0;
  };
  // stagger the first volley so a fresh burst is always on screen
  const stagger=sh=>{ sh.t=Math.random()*(sh.rise+sh.life+.7); };
  shells.forEach(sh=>{ arm(sh); stagger(sh); });

  return {pts, mat, shells, PER, arm,
    step(dt,amt){
      pts.visible=amt>.01; mat.uniforms.uOpacity.value=Math.min(1,amt*1.15);
      if(!pts.visible) return;
      const P=g.attributes.position.array, C=g.attributes.color.array,
            S=g.attributes.size.array;
      for(let i=0;i<shells.length;i++){
        const sh=shells[i]; sh.t+=dt;
        if(sh.t>sh.rise+sh.life+.7) arm(sh);
        const k0=i*PER, rise=sh.rise;
        if(sh.t<rise){
          // ── climbing: a single bright comet with a short tail ──
          const u=sh.t/rise, climb=42*u*(1-u*.42);
          for(let k=0;k<PER;k++){
            const j=(k0+k)*3;
            // pack the sparks into a trail behind the rising shell
            const lag=(k/PER)*7.5;
            P[j  ]=sh.org.x*.06+ (sh.org.x*.94);
            P[j+1]=sh.org.y-34+climb-lag;
            P[j+2]=sh.org.z;
            const tail=Math.max(0,1-lag/7.5);
            const g=.55+.45*tail;
            C[j]=g; C[j+1]=g*.86; C[j+2]=g*.55;         // warm ember trail
            S[k0+k]=(k<PER*.18? .34:.12)*tail*(u<.1?u*10:1);
          }
          continue;
        }
        const age=sh.t-rise;
        // brightness: flash on burst, then a slow ember decay
        const fade=age<.05?age/.05:Math.max(0,1-(age-.05)/sh.life);
        for(let k=0;k<PER;k++){
          const j=(k0+k)*3, v=sh.vel[k], dg=sh.drag[k];
          // drag + gravity, so sparks arc over and trail downward
          const dragged=(1-Math.exp(-age*dg))/dg;
          // late crackle: sparks jitter as they burn out
          const cr=Math.max(0,age-sh.life*.45)*1.4;
          const jx=Math.sin(k*12.9+age*9.1)*cr, jz=Math.cos(k*7.7+age*8.3)*cr;
          P[j  ]=sh.org.x+v.x*dragged+jx;
          P[j+1]=sh.org.y+v.y*dragged-8.4*age*age;
          P[j+2]=sh.org.z+v.z*dragged+jz;
          // cores stay white briefly, then take the shell's colour
          const wm=Math.max(0,1-age*3.6);
          C[j  ]=sh.col.r*(1-wm)+wm; C[j+1]=sh.col.g*(1-wm)+wm; C[j+2]=sh.col.b*(1-wm)+wm;
          // twinkle at individual rates so the shell shimmers
          const tw=.66+.34*Math.sin(age*(19+(k%7)*3.1)+k*1.7);
          // size follows the fade directly (squaring it shrank sparks to specks)
          S[k0+k]=Math.max(.18,fade*tw);
          // embers redden as they cool
          const b2=(.42+.58*fade)*tw;
          C[j]*=b2*(1+(1-fade)*.30); C[j+1]*=b2*(1-(1-fade)*.16); C[j+2]*=b2*(1-(1-fade)*.34);
        }
      }
      g.attributes.position.needsUpdate=true;
      g.attributes.color.needsUpdate=true;
      g.attributes.size.needsUpdate=true;
    }};
})();

/* ==== part9_zones ==== */
/* ============================================================
   9 · THE REMAINING ZONES
   Story Garden, Around the World, Futureland, Skill Arcade,
   Prize Corner, and the Polaroid Gallery.

   Each one is a place first and a content surface second: you
   should be able to tell what it is from its silhouette before
   you click anything.
   ============================================================ */

// small shared helper: an enamel sign face on a post
function signPost(text,sub,w,h,px){
  const g=new THREE.Group();
  const cv=document.createElement('canvas'); cv.width=512; cv.height=Math.round(512*h/w);
  const c=cv.getContext('2d');
  c.fillStyle='#33473a'; c.fillRect(0,0,cv.width,cv.height);
  c.strokeStyle='rgba(233,220,196,.45)'; c.lineWidth=5;
  c.strokeRect(12,12,cv.width-24,cv.height-24);
  c.fillStyle='#f2e9d8'; c.textAlign='center'; c.textBaseline='middle';
  c.font='500 '+(px||62)+'px "Cormorant Garamond", Georgia, serif';
  c.letterSpacing='7px';
  c.fillText(text,cv.width/2,cv.height*(sub?.40:.5));
  if(sub){
    c.font='400 26px Inter, sans-serif'; c.fillStyle='rgba(242,233,216,.66)';
    c.letterSpacing='6px'; c.fillText(sub,cv.width/2,cv.height*.72);
  }
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const board=new THREE.Mesh(new THREE.BoxGeometry(w,h,.22),M.woodGreen);
  g.add(board);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(w*.96,h*.92),
    new THREE.MeshStandardMaterial({map:tex,roughness:.72,
      emissive:new THREE.Color(C.butter),emissiveMap:tex,emissiveIntensity:0}));
  face.position.z=.13; g.add(face);
  LAMPS.push({mesh:face,mat:face.material,color:new THREE.Color(C.butter),
    intensity:.34,zone:'buildings',order:1,lit:0});
  return g;
}

/* ------------------------------------------------------------
   9a · STORY GARDEN — writing, essays, research
   A quieter corner: old trees, a fountain, benches, and writing
   left physically lying around.
   ------------------------------------------------------------ */
const WRITING=[
  ...PC.learning.prompts.map(x=>({name:x.title,kind:L('自检提问 · Prompt','Prompt'),where:L('提问架','Prompt shelf'),text:x.useCase||x.fullContent||''})),
  ...PC.learning.methods.map(x=>({name:x.title,kind:L('方法 · Method','Method'),where:L('方法桌','Methods table'),text:x.summary||x.appliesTo||''})),
  ...PC.learning.notes.map(x=>({name:x.title,kind:L('随手记 · Note','Working note'),where:L('笔记墙','Notes wall'),text:x.summary||''})),
  ...PC.learning.readings.map(x=>({name:x.title,kind:L('读书 · Reading','Reading'),where:L('书架','Bookshelf'),text:x.summary||''}))
];
const garden=new THREE.Group();
{
  const P={x:-40,z:34};
  garden.position.set(P.x,hAt(P.x,P.z),P.z); world.add(garden);

  // a low stone terrace so the garden reads as a made place
  const terrace=new THREE.Mesh(new THREE.CylinderGeometry(13,13.4,.5,36),M.stone);
  terrace.position.y=.2; terrace.receiveShadow=true; garden.add(terrace);

  // fountain: three basins, water, a small jet
  const f=new THREE.Group(); f.position.set(0,.45,0); garden.add(f);
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.3,.85,28),M.stone);
  basin.position.y=.42; basin.castShadow=basin.receiveShadow=true; f.add(basin);
  const water=new THREE.Mesh(new THREE.CircleGeometry(2.9,28),M.water);
  water.rotation.x=-Math.PI/2; water.position.y=.78; f.add(water);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.28,.42,1.5,10),M.stone);
  stem.position.y=1.5; f.add(stem);
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(1.15,.5,.34,20),M.stone);
  bowl.position.y=2.36; f.add(bowl);
  const finial=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),M.brass);
  finial.position.y=2.72; f.add(finial);
  // a thin jet of water, animated later
  const jet=new THREE.Mesh(new THREE.CylinderGeometry(.05,.09,1.5,6),
    new THREE.MeshStandardMaterial({color:0xd8e8ee,roughness:.1,metalness:.2,
      transparent:true,opacity:.55}));
  jet.position.y=3.3; f.add(jet);
  garden.userData.jet=jet; garden.userData.water=water;

  // four old trees at the corners, larger and rounder than park trees
  [[-9,-7],[9,-8],[-8,9],[10,7]].forEach(([x,z],i)=>{
    const t=makeTree(i%2?'old':'round');
    t.position.set(x,0,z); t.scale.setScalar(1.35+i*.08); garden.add(t);
  });

  // reading pavilion: open-sided, four posts, a pitched roof
  const pav=new THREE.Group(); pav.position.set(-.5,0,-9.4); garden.add(pav);
  const pdeck=new THREE.Mesh(new THREE.BoxGeometry(6.4,.42,5),M.woodPaper);
  pdeck.position.y=.42; pdeck.receiveShadow=true; pav.add(pdeck);
  [[-2.8,-2.1],[2.8,-2.1],[-2.8,2.1],[2.8,2.1]].forEach(([x,z])=>{
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,3.5,8),M.woodGreen);
    p.position.set(x,2.35,z); p.castShadow=true; pav.add(p);
    const capA=new THREE.Mesh(new THREE.CylinderGeometry(.26,.17,.2,8),M.brass);
    capA.position.set(x,4.05,z); pav.add(capA);
    // curved iron bracket reaching under the eave
    const br=new THREE.Mesh(new THREE.TorusGeometry(.55,.04,5,8,Math.PI/2),M.ironDark);
    br.position.set(x,4.1,z); br.rotation.y=Math.PI/2; pav.add(br);
  });
  const proof=new THREE.Mesh(new THREE.ConeGeometry(5.1,2.1,4),PAR_zinc);
  proof.position.y=5.2; proof.rotation.y=Math.PI/4; proof.castShadow=true; pav.add(proof);
  const peave=new THREE.Mesh(new THREE.BoxGeometry(6.9,.2,5.5),M.woodGreen);
  peave.position.y=4.14; pav.add(peave);
  // brass finial + small pennant on the ridge
  const finP=new THREE.Mesh(new THREE.SphereGeometry(.2,8,7),M.brass);
  finP.position.y=6.4; pav.add(finP);
  const penP=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.5,6,2),
    new THREE.MeshStandardMaterial({color:C.butter,side:THREE.DoubleSide,roughness:.9,map:canvasTex}));
  penP.position.set(.6,6.5,0); penP.userData.flag=true;
  penP.userData.base=penP.geometry.attributes.position.array.slice();
  pav.add(penP);
  // a writing desk and stool inside
  const desk=new THREE.Mesh(new THREE.BoxGeometry(2.4,.16,1.3),M.woodCream);
  desk.position.set(0,1.5,.2); desk.castShadow=true; pav.add(desk);
  [[-1.05,-.5],[1.05,-.5],[-1.05,.85],[1.05,.85]].forEach(([x,z])=>{
    const l=new THREE.Mesh(new THREE.BoxGeometry(.12,1.1,.12),M.woodCream);
    l.position.set(x,.98,z+.2); pav.add(l);
  });
  const stool=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.1,12),M.woodRed);
  stool.position.set(0,1.05,-1.3); pav.add(stool);
  // reading lamp on the desk — lights at night
  const lamp=emissive(C.butter,1.3,.17,'buildings',1);
  lamp.position.set(.85,1.78,.2); pav.add(lamp);
  const lampshade=new THREE.Mesh(new THREE.ConeGeometry(.34,.4,10,1,true),M.brass);
  lampshade.position.set(.85,2.0,.2); pav.add(lampshade);

  // benches facing the fountain
  [[-6.4,3.6,.5],[6.6,3.2,-.6],[0,8.4,Math.PI]].forEach(([x,z,ry])=>{
    const b=new THREE.Group(); b.position.set(x,.45,z); b.rotation.y=ry;
    const seat=new THREE.Mesh(new THREE.BoxGeometry(2.6,.14,.8),M.woodCream);
    seat.position.y=.62; seat.castShadow=true; b.add(seat);
    const back=new THREE.Mesh(new THREE.BoxGeometry(2.6,.7,.12),M.woodCream);
    back.position.set(0,1.0,-.36); b.add(back);
    [-1.1,1.1].forEach(sx=>{
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.14,.62,.7),M.ironDark);
      leg.position.set(sx,.31,0); b.add(leg);
    });
    garden.add(b);
  });

  // the writing itself, physically present: book, notebook, paper, newspaper
  const paperMat=new THREE.MeshStandardMaterial({color:0xf6f1e2,roughness:.95});
  // book open on the first bench
  const book=new THREE.Group(); book.position.set(-6.4,1.14,.5); garden.add(book);
  [-.01,.01].forEach((tilt,i)=>{
    const pg=new THREE.Mesh(new THREE.BoxGeometry(.62,.05,.86),paperMat);
    pg.position.x=i?.32:-.32; pg.rotation.z=i?-.16:.16; book.add(pg);
  });
  const spine=new THREE.Mesh(new THREE.BoxGeometry(.1,.07,.9),M.woodRed);
  book.add(spine);
  // notebook on the desk
  const nb=new THREE.Mesh(new THREE.BoxGeometry(.8,.07,1.05),paperMat);
  nb.position.set(-.55,1.61,.2); nb.rotation.y=.22; pav.add(nb);
  const nbCover=new THREE.Mesh(new THREE.BoxGeometry(.84,.03,1.09),M.woodBlue);
  nbCover.position.set(-.55,1.57,.2); nbCover.rotation.y=.22; pav.add(nbCover);
  // paper pinned to the tree
  const sheet=new THREE.Mesh(new THREE.PlaneGeometry(.9,1.2),paperMat);
  sheet.position.set(-8.2,3.1,9.3); sheet.rotation.set(0,.5,.05);
  sheet.material.side=THREE.DoubleSide; garden.add(sheet);
  garden.userData.sheet=sheet;
  // folded newspaper on the fountain rim
  const news=new THREE.Mesh(new THREE.BoxGeometry(1.0,.08,.7),paperMat);
  news.position.set(2.1,1.34,1.9); news.rotation.set(0,.7,-.06); garden.add(news);

  // a small bookstall by the path
  const stall=new THREE.Group(); stall.position.set(9.6,.45,-3.5);
  stall.rotation.y=-.5; garden.add(stall);
  const stTop=new THREE.Mesh(new THREE.BoxGeometry(3.0,.14,1.5),M.woodCream);
  stTop.position.y=1.1; stTop.castShadow=true; stall.add(stTop);
  [[-1.3,-.6],[1.3,-.6],[-1.3,.6],[1.3,.6]].forEach(([x,z])=>{
    const l=new THREE.Mesh(new THREE.BoxGeometry(.13,1.1,.13),M.woodCream);
    l.position.set(x,.55,z); stall.add(l);
  });
  for(let i=0;i<7;i++){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.44,.12+Math.random()*.1,.6),
      [M.woodRed,M.woodBlue,M.woodGreen,M.terracotta][i%4]);
    b.position.set(-1.1+i*.36,1.24+(i%3)*.02,(i%2?.1:-.12));
    b.rotation.y=(Math.random()-.5)*.3; stall.add(b);
  }
  for(let i=0;i<7;i++){
    const s=new THREE.Mesh(new THREE.BoxGeometry(.47,.09,1.9),i%2?M.canvasRed:M.canvasWhite);
    s.position.set(-1.4+i*.47,1.98,0); s.rotation.x=-.16; s.castShadow=true; stall.add(s);
  }
  valanceRun(stall,3.2,1.9,.92,0,PAR_valR);

  // fireflies gather here at night (registered for the loop)
  const sign=signPost('STORY GARDEN','NOTES · METHODS · PROMPTS',6.6,1.8,58);
  sign.position.set(0,2.4,12.2); sign.rotation.y=.06; garden.add(sign);
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.14,.16,2.4,8),M.woodCream);
  sp.position.set(0,1.2,12.2); garden.add(sp);

  hotspot(garden,'garden','Story Garden',
    {az:-.52,pol:1.05,dist:36,tgt:new THREE.Vector3(P.x,3,P.z)});
}

/* ------------------------------------------------------------
   9b · AROUND THE WORLD — a mechanical globe for travel + education
   An antique instrument for remembering places, not a map widget.
   ------------------------------------------------------------ */
const PLACES=PC.travel.cities;

const globeZone=new THREE.Group();
{
  const P={x:44,z:36};
  globeZone.position.set(P.x,hAt(P.x,P.z),P.z); world.add(globeZone);

  // stone plinth and a brass mechanism
  const dais=new THREE.Mesh(new THREE.CylinderGeometry(7.4,7.9,.6,32),M.stone);
  dais.position.y=.25; dais.receiveShadow=true; globeZone.add(dais);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1.5,2.1,2.6,16),M.woodCream);
  plinth.position.y=1.75; plinth.castShadow=true; globeZone.add(plinth);
  const bandG=new THREE.Mesh(new THREE.CylinderGeometry(1.56,1.66,.5,16),M.woodGreen);
  bandG.position.y=1.15; globeZone.add(bandG);
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,.28,16),M.brass);
  collar.position.y=3.05; globeZone.add(collar);

  // the meridian ring the globe hangs in
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.5,.14,8,44),M.brass);
  ring.position.y=6.3; ring.rotation.x=.34; globeZone.add(ring);
  const ring2=new THREE.Mesh(new THREE.TorusGeometry(3.72,.09,6,44),M.brassDark);
  ring2.position.y=6.3; ring2.rotation.set(.34,0,Math.PI/2); globeZone.add(ring2);
  // the axle
  const axle=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,7.6,8),M.brassDark);
  axle.position.y=6.3; axle.rotation.z=.34; globeZone.add(axle);

  // the sphere: hand-painted continents on a canvas texture
  const gcv=document.createElement('canvas'); gcv.width=1024; gcv.height=512;
  const gx=gcv.getContext('2d');
  gx.fillStyle='#c2d2d2'; gx.fillRect(0,0,1024,512);           // ocean: pale, aged
  // faint graticule
  gx.strokeStyle='rgba(120,132,128,.30)'; gx.lineWidth=1;
  for(let i=1;i<12;i++){ gx.beginPath(); gx.moveTo(i*85,0); gx.lineTo(i*85,512); gx.stroke(); }
  for(let i=1;i<6;i++){ gx.beginPath(); gx.moveTo(0,i*85); gx.lineTo(1024,i*85); gx.stroke(); }
  // continents as loose blobs — impressionistic, not cartographic
  const blob=(cx,cy,pts)=>{
    gx.beginPath();
    pts.forEach((p,i)=>{ const x=cx+p[0],y=cy+p[1]; i?gx.lineTo(x,y):gx.moveTo(x,y); });
    gx.closePath();
    gx.fillStyle='#8a9a76'; gx.fill();
    gx.strokeStyle='rgba(74,84,64,.55)'; gx.lineWidth=2.4; gx.stroke();
  };
  blob(215,150,[[-70,-40],[10,-58],[62,-22],[40,40],[-6,74],[-52,44],[-76,4]]);   // N America
  blob(268,332,[[-30,-52],[26,-40],[34,26],[4,70],[-24,34],[-38,-8]]);            // S America
  blob(516,150,[[-46,-36],[36,-44],[64,-6],[30,26],[-14,34],[-52,8]]);            // Europe
  blob(556,300,[[-40,-54],[38,-46],[52,18],[16,74],[-22,44],[-46,-6]]);           // Africa
  blob(720,168,[[-84,-48],[76,-56],[122,-6],[62,40],[-24,50],[-88,10]]);          // Asia
  blob(830,372,[[-44,-24],[34,-30],[46,14],[2,32],[-40,14]]);                     // Australia
  blob(300,86,[[-46,-16],[24,-26],[52,2],[10,22],[-36,14]]);                     // Greenland
  blob(700,262,[[-26,-20],[20,-24],[30,6],[-4,24],[-26,8]]);                      // India
  blob(792,300,[[-18,-14],[16,-18],[22,6],[-6,16],[-18,4]]);                      // SE Asia
  blob(884,300,[[-10,-10],[10,-12],[12,6],[-4,12],[-12,2]]);                      // islands
  blob(920,410,[[-16,-10],[14,-12],[18,6],[-2,14],[-16,4]]);                      // NZ
  gx.fillStyle='rgba(255,255,255,.55)'; gx.fillRect(0,486,1024,26);               // Antarctica
  // aged varnish speckle
  gx.globalAlpha=.09; gx.fillStyle='#7d6534';
  for(let i=0;i<420;i++) gx.fillRect(Math.random()*1024,Math.random()*512,Math.random()*7,Math.random()*3);
  gx.globalAlpha=1;
  const gtex=new THREE.CanvasTexture(gcv); gtex.colorSpace=THREE.SRGBColorSpace;
  const globe=new THREE.Mesh(new THREE.SphereGeometry(3.1,40,28),
    new THREE.MeshStandardMaterial({map:gtex,roughness:.82,metalness:.05}));
  globe.position.y=6.3; globe.rotation.z=.34; globe.castShadow=true;
  globeZone.add(globe);
  globeZone.userData.globe=globe;

  // Recorded routes, lifted slightly above the sphere so the network remains legible.
  const pointOnGlobe=(pl,r=3.1)=>{
    const phi=(90-pl.lat)*Math.PI/180, th=(pl.lon+180)*Math.PI/180;
    return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(th),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(th));
  };
  const routeMat=new THREE.MeshStandardMaterial({color:C.red,roughness:.72,transparent:true,opacity:.5,depthWrite:false});
  PC.travel.routes.forEach(([fromId,toId])=>{
    const from=PLACES.find(p=>p.id===fromId),to=PLACES.find(p=>p.id===toId);
    if(!from||!to) return;
    const a=pointOnGlobe(from,3.14),b=pointOnGlobe(to,3.14);
    const mid=a.clone().add(b).normalize().multiplyScalar(3.35);
    const curve=new THREE.QuadraticBezierCurve3(a,mid,b);
    globe.add(new THREE.Mesh(new THREE.TubeGeometry(curve,14,.012,4,false),routeMat));
  });

  // visited places: brass pins that glow, seated on the sphere by lat/lon
  const pins=[];
  PLACES.forEach((pl,i)=>{
    const v=pointOnGlobe(pl);
    const pin=new THREE.Group(); pin.position.copy(v);
    pin.lookAt(new THREE.Vector3(0,0,0)); pin.rotateX(Math.PI/2);
    const needle=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.42,6),M.brassDark);
    needle.position.y=.25; pin.add(needle);
    const head=emissive(0xff7a4d,2.4,.115,'buildings',2);
    head.position.y=.55; pin.add(head);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.028,5,12),M.brass);
    ring.position.y=.03; ring.rotation.x=Math.PI/2; pin.add(ring);
    globe.add(pin); pins.push(pin);
  });
  globeZone.userData.pins=pins;

  // the reading desk where the postcards live
  const desk=new THREE.Mesh(new THREE.BoxGeometry(3.4,.16,1.7),M.woodCream);
  desk.position.set(0,1.35,5.1); desk.rotation.y=.1; desk.castShadow=true; globeZone.add(desk);
  globeLamp(globeZone,-2.2,1.9,5.1,'buildings',2);
  globeLamp(globeZone,2.2,1.9,5.1,'buildings',2);
  [[-1.5,-.7],[1.5,-.7],[-1.5,.7],[1.5,.7]].forEach(([x,z])=>{
    const l=new THREE.Mesh(new THREE.BoxGeometry(.13,1.3,.13),M.woodCream);
    l.position.set(x,.7,z+5.1); globeZone.add(l);
  });
  // postcards scattered on it
  for(let i=0;i<5;i++){
    const pc=new THREE.Mesh(new THREE.BoxGeometry(.78,.03,.55),
      new THREE.MeshStandardMaterial({color:0xf4eddc,roughness:.94}));
    pc.position.set(-1.1+i*.55,1.45+i*.012,5.1+(i%2?.24:-.2));
    pc.rotation.y=(Math.random()-.5)*.7; globeZone.add(pc);
  }
  // brass gear detail at the base — it should look like it could be wound
  [[-1.9,0],[1.9,.4]].forEach(([x,rot],i)=>{
    const gear=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.16,i?9:12),M.brassDark);
    gear.position.set(x,1.1,-1.5); gear.rotation.x=Math.PI/2; gear.rotation.z=rot;
    globeZone.add(gear);
    globeZone.userData['gear'+i]=gear;
  });

  const sign=signPost('AROUND THE WORLD','REGIONS · IMAGES · PERSPECTIVES',7.0,1.8,50);
  sign.position.set(0,2.5,7.6); globeZone.add(sign);
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.14,.16,2.5,8),M.woodCream);
  sp.position.set(0,1.25,7.6); globeZone.add(sp);

  hotspot(globeZone,'globe','Around the World',
    {az:-.34,pol:.92,dist:24,tgt:new THREE.Vector3(P.x-3.5,6.4,P.z)});
}

/* ------------------------------------------------------------
   9c · FUTURELAND — a permanent construction site
   Always unfinished, on purpose.
   ------------------------------------------------------------ */
const BUILDING_NOW=PC.buildingNow;
const futureland=new THREE.Group();
{
  const P={x:66,z:12};
  futureland.position.set(P.x,hAt(P.x,P.z),P.z); world.add(futureland);

  // a dirt working yard rather than lawn
  const yard=new THREE.Mesh(new THREE.CircleGeometry(13,32),
    mat(0xb9a888,{rough:.98}));
  yard.rotation.x=-Math.PI/2; yard.position.y=.06; yard.receiveShadow=true;
  futureland.add(yard);

  // scaffolding: a real lattice, half-wrapped in canvas
  const scaff=new THREE.Group(); scaff.position.set(-2,0,-3); futureland.add(scaff);
  const barMat=M.brassDark;
  for(let i=0;i<4;i++) for(let j=0;j<3;j++){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,9.5,6),barMat);
    post.position.set(-3+i*2, 4.75, -2+j*2); post.castShadow=true; scaff.add(post);
  }
  for(let lvl=1;lvl<=4;lvl++){
    const y=lvl*2.1;
    for(let j=0;j<3;j++){
      const rail=new THREE.Mesh(new THREE.BoxGeometry(6.3,.1,.1),barMat);
      rail.position.set(0,y,-2+j*2); scaff.add(rail);
    }
    for(let i=0;i<4;i++){
      const rail=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,4.3),barMat);
      rail.position.set(-3+i*2,y,0); scaff.add(rail);
    }
    // working planks on two levels
    if(lvl===2||lvl===4){
      const plank=new THREE.Mesh(new THREE.BoxGeometry(6.2,.12,1.1),M.woodPaper);
      plank.position.set(0,y+.1,-2+(lvl===2?0:2)); plank.castShadow=true; scaff.add(plank);
    }
  }
  // canvas sheeting, half hung
  const drape=new THREE.Mesh(new THREE.PlaneGeometry(6.4,6.4,6,6),
    new THREE.MeshStandardMaterial({color:0xdfd6c0,roughness:.96,
      side:THREE.DoubleSide,transparent:true,opacity:.9}));
  {
    const pa=drape.geometry.attributes.position;
    for(let i=0;i<pa.count;i++){
      const x=pa.getX(i),y=pa.getY(i);
      pa.setZ(i, Math.sin(x*.9+y*.5)*.28+Math.cos(y*1.1)*.16);
    }
    drape.geometry.computeVertexNormals();
  }
  drape.position.set(-3.2,5.2,0); drape.rotation.y=Math.PI/2; scaff.add(drape);
  futureland.userData.drape=drape;

  // the half-built attraction inside the scaffold: a wheel with missing spokes
  const halfWheel=new THREE.Group(); halfWheel.position.set(-2,5.4,-1); futureland.add(halfWheel);
  const hr=new THREE.Mesh(new THREE.TorusGeometry(2.6,.11,6,28,Math.PI*1.45),M.woodCream);
  halfWheel.add(hr);
  for(let i=0;i<5;i++){
    const a=(i/8)*Math.PI*1.45;
    const sp=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,2.6,5),M.woodCream);
    sp.position.set(Math.cos(a)*1.3,Math.sin(a)*1.3,0); sp.rotation.z=a+Math.PI/2;
    halfWheel.add(sp);
  }
  futureland.userData.halfWheel=halfWheel;

  // a crane: mast, jib, counterweight, hanging hook
  const crane=new THREE.Group(); crane.position.set(6.5,0,2); futureland.add(crane);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,12,7),M.woodRed);
  mast.position.y=6; mast.castShadow=true; crane.add(mast);
  const jib=new THREE.Group(); jib.position.y=11.4; crane.add(jib);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(9,.24,.3),M.woodRed);
  arm.position.x=2.4; jib.add(arm);
  const cw=new THREE.Mesh(new THREE.BoxGeometry(1.1,.9,.7),M.ironDark);
  cw.position.x=-2.4; jib.add(cw);
  const cable=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,4.4,4),M.ironDark);
  cable.position.set(5.6,-2.2,0); jib.add(cable);
  const hook=new THREE.Mesh(new THREE.TorusGeometry(.22,.06,5,10),M.brassDark);
  hook.position.set(5.6,-4.5,0); jib.add(hook);
  // a wooden model dangling from it — an attraction waiting to be born
  const cargo=new THREE.Mesh(new THREE.BoxGeometry(1.3,.9,1.3),M.woodPaper);
  cargo.position.set(5.6,-5.2,0); jib.add(cargo);
  futureland.userData.jib=jib;

  // drawing tables with blueprints
  [[-8.4,3.4,.4],[-6.6,7.2,-.5]].forEach(([x,z,ry],i)=>{
    const t=new THREE.Group(); t.position.set(x,0,z); t.rotation.y=ry; futureland.add(t);
    const top=new THREE.Mesh(new THREE.BoxGeometry(2.8,.12,1.8),M.woodCream);
    top.position.y=1.15; top.rotation.x=-.16; top.castShadow=true; t.add(top);
    [[-1.2,-.7],[1.2,-.7],[-1.2,.7],[1.2,.7]].forEach(([lx,lz])=>{
      const l=new THREE.Mesh(new THREE.BoxGeometry(.11,1.15,.11),M.woodCream);
      l.position.set(lx,.57,lz); t.add(l);
    });
    // blueprint sheet: cyan paper with white lines
    const bcv=document.createElement('canvas'); bcv.width=256; bcv.height=176;
    const bx=bcv.getContext('2d');
    bx.fillStyle=i?'#4a6b86':'#3f6480'; bx.fillRect(0,0,256,176);
    bx.strokeStyle='rgba(255,255,255,.62)'; bx.lineWidth=1.4;
    bx.strokeRect(16,14,224,148);
    for(let k=0;k<6;k++){
      bx.beginPath(); bx.moveTo(28,30+k*22); bx.lineTo(120+((k*37)%110),30+k*22); bx.stroke();
    }
    bx.beginPath(); bx.arc(180,96,34,0,Math.PI*2); bx.stroke();
    bx.beginPath(); bx.arc(180,96,16,0,Math.PI*2); bx.stroke();
    const btex=new THREE.CanvasTexture(bcv); btex.colorSpace=THREE.SRGBColorSpace;
    const bp=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.5),
      new THREE.MeshStandardMaterial({map:btex,roughness:.94}));
    bp.position.y=1.23; bp.rotation.set(-Math.PI/2-.16,0,0); t.add(bp);
  });

  // miniature prototypes on a low bench — tiny buildings under study
  const shelf=new THREE.Mesh(new THREE.BoxGeometry(5.4,.14,1.4),M.woodPaper);
  shelf.position.set(4,.9,-6.4); shelf.castShadow=true; futureland.add(shelf);
  [[-1.9,.9,M.woodRed],[-.5,1.3,M.woodBlue],[.8,.7,M.woodGreen],[2.0,1.1,M.terracotta]]
    .forEach(([x,h,m],i)=>{
      const g=new THREE.Group(); g.position.set(4+x,.97,-6.4); futureland.add(g);
      const body=new THREE.Mesh(new THREE.BoxGeometry(.8,h,.8),M.woodPaper);
      body.position.y=h/2; g.add(body);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(.68,.5,4),m);
      roof.position.y=h+.25; roof.rotation.y=Math.PI/4; g.add(roof);
    });

  // sticky notes on a board — the honest to-do list
  const board=new THREE.Mesh(new THREE.BoxGeometry(3.6,2.4,.14),M.woodCream);
  board.position.set(9.4,2.2,-4.6); board.rotation.y=-.6; board.castShadow=true;
  futureland.add(board);
  const noteCols=[0xf0d98a,0xe8b0a0,0xa9c4d6,0xc8d6a4];
  for(let i=0;i<9;i++){
    const n=new THREE.Mesh(new THREE.PlaneGeometry(.62,.62),
      new THREE.MeshStandardMaterial({color:noteCols[i%4],roughness:.95}));
    n.position.set(9.4+Math.cos(-.6)*(-1.2+(i%3)*1.2)+.03,
      2.9-Math.floor(i/3)*.78, -4.6-Math.sin(-.6)*(-1.2+(i%3)*1.2)+.09);
    n.rotation.set(0,-.6,(Math.random()-.5)*.2);
    futureland.add(n);
  }

  // construction lights on tripods — harsh, temporary, and they turn on at night
  [[-9.5,-4],[7.5,6.5],[0,9]].forEach(([x,z])=>{
    const g=new THREE.Group(); g.position.set(x,0,z); futureland.add(g);
    for(let i=0;i<3;i++){
      const a=(i/3)*Math.PI*2;
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,3.2,5),M.ironDark);
      leg.position.set(Math.cos(a)*.5,1.5,Math.sin(a)*.5);
      leg.rotation.z=Math.cos(a)*.3; leg.rotation.x=-Math.sin(a)*.3; g.add(leg);
    }
    const head=new THREE.Mesh(new THREE.BoxGeometry(.9,.6,.4),M.ironDark);
    head.position.y=3.3; g.add(head);
    const bulb=emissive(0xfff4d8,2.6,.3,'circus',1,'box');
    bulb.position.set(0,3.3,.24); g.add(bulb);
  });

  // signage, deadpan
  const signs=['COMING SOON','MAYBE','UNDER CONSTRUCTION, AS USUAL'];
  signs.forEach((txt,i)=>{
    const cv=document.createElement('canvas'); cv.width=512; cv.height=128;
    const c=cv.getContext('2d');
    c.fillStyle='#e8dcc0'; c.fillRect(0,0,512,128);
    c.strokeStyle='#b45248'; c.lineWidth=6; c.strokeRect(10,10,492,108);
    c.fillStyle='#4a4038'; c.textAlign='center'; c.textBaseline='middle';
    c.font='500 '+(txt.length>18?36:46)+'px Inter, sans-serif';
    c.letterSpacing='3px'; c.fillText(txt,256,64);
    const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
    const p=new THREE.Mesh(new THREE.PlaneGeometry(3.4,.85),
      new THREE.MeshStandardMaterial({map:tex,roughness:.9,side:THREE.DoubleSide}));
    const pos=[[-6,1.9,8.6,.28],[10.5,1.6,3.2,-.9],[2.5,2.2,-9.5,3.3]][i];
    p.position.set(pos[0],pos[1],pos[2]); p.rotation.y=pos[3]; futureland.add(p);
    const st=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,pos[1],6),M.woodCream);
    st.position.set(pos[0],pos[1]/2,pos[2]); futureland.add(st);
  });

  const sign=signPost('FUTURELAND','NEVER FINISHED',6.4,1.8,58);
  sign.position.set(-2,2.6,11.4); sign.rotation.y=.1; futureland.add(sign);
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.15,.17,2.6,8),M.woodCream);
  sp.position.set(-2,1.3,11.4); futureland.add(sp);

  hotspot(futureland,'futureland','Futureland',
    {az:.86,pol:1.10,dist:38,tgt:new THREE.Vector3(P.x,4.6,P.z)});
}

/* ------------------------------------------------------------
   9d · SKILL ARCADE — capabilities discovered through play
   No skill bars. Machines you could imagine putting a coin in.
   ------------------------------------------------------------ */
const MACHINES=PC.skills.map((s,i)=>({name:s.name.toUpperCase(),kind:`cabinet no. ${i+1}`,screen:s.name.toUpperCase(),items:s.items,note:'Evidence appears throughout the projects, research and learning archives.'}));

const arcade=new THREE.Group();
{
  const P={x:-46,z:2};
  arcade.position.set(P.x,hAt(P.x,P.z),P.z); world.add(arcade);

  // a proper pavilion shell: plinth, walls on three sides, deep eave, hipped roof
  const plinth=new THREE.Mesh(new THREE.BoxGeometry(15,.7,11),M.stone);
  plinth.position.y=.35; plinth.receiveShadow=true; arcade.add(plinth);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(14,.16,10),M.woodPaper);
  floor.position.y=.78; floor.receiveShadow=true; arcade.add(floor);
  // back and side walls
  const wallM=M.woodCream;
  const back=new THREE.Mesh(new THREE.BoxGeometry(14,5.4,.3),wallM);
  back.position.set(0,3.5,-4.9); back.castShadow=true; arcade.add(back);
  // panelled back wall: burgundy insets in cream frames, pilasters between
  for(let p=0;p<5;p++){
    const px=-5.6+p*2.8;
    const pan=new THREE.Mesh(new THREE.BoxGeometry(2.1,3.4,.1),M.woodGreen);
    pan.position.set(px,3.4,-4.72); arcade.add(pan);
    const fr=new THREE.Mesh(new THREE.BoxGeometry(2.4,3.7,.06),M.burgundy);
    fr.position.set(px,3.4,-4.75); arcade.add(fr);
  }
  [-6.9,6.9].forEach(sx=>{
    const w=new THREE.Mesh(new THREE.BoxGeometry(.3,5.4,10),wallM);
    w.position.set(sx,3.5,0); w.castShadow=true; arcade.add(w);
    // dentil course + inset panels on the inner faces
    dentilRun(arcade,10,6.1,sx-Math.sign(sx)*.2,16,Math.PI/2);
    for(let p=0;p<3;p++){
      const pan=new THREE.Mesh(new THREE.BoxGeometry(.08,2.6,2.2),M.woodGreen);
      pan.position.set(sx-Math.sign(sx)*.17,3.2,-2.8+p*2.8); arcade.add(pan);
    }
  });
  // front columns — slender ironwork green with gold capitals
  [-5.6,-1.9,1.9,5.6].forEach(x=>{
    const c=new THREE.Mesh(new THREE.CylinderGeometry(.24,.28,5.4,10),M.woodGreen);
    c.position.set(x,3.5,4.7); c.castShadow=true; arcade.add(c);
    const capA=new THREE.Mesh(new THREE.CylinderGeometry(.44,.26,.3,10),M.brass);
    capA.position.set(x,5.9,4.7); arcade.add(capA);
    const baseA=new THREE.Mesh(new THREE.CylinderGeometry(.4,.24,.26,10),M.brassDark);
    baseA.position.set(x,.92,4.7); arcade.add(baseA);
    // opal globe lamp on a curved bracket beside each column
    globeLamp(arcade,x+(x<0?.75:-.75),4.35,4.72,'buildings',0);
  });
  const eave=new THREE.Mesh(new THREE.BoxGeometry(16,.42,12),M.burgundy);
  eave.position.y=6.4; eave.castShadow=true; arcade.add(eave);
  dentilRun(arcade,15.6,6.15,5.9,26);
  valanceRun(arcade,15.2,5.62,6.02,0,PAR_valG);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(10.6,3.1,4),PAR_zinc);
  roof.position.y=8.1; roof.rotation.y=Math.PI/4; roof.castShadow=true; arcade.add(roof);
  const ridge=new THREE.Mesh(new THREE.SphereGeometry(.42,10,8),M.brass);
  ridge.position.y=9.75; arcade.add(ridge);

  // marquee: ARCADE in bulbs
  const marquee=new THREE.Mesh(new THREE.BoxGeometry(9.2,1.7,.34),M.woodGreen);
  marquee.position.set(0,7.2,5.0); arcade.add(marquee);
  valanceRun(arcade,9,6.32,5.16,0,PAR_valR);
  {
    const cv=document.createElement('canvas'); cv.width=768; cv.height=142;
    const c=cv.getContext('2d');
    c.fillStyle='#33473a'; c.fillRect(0,0,768,142);
    c.fillStyle='#f2e9d8'; c.textAlign='center'; c.textBaseline='middle';
    c.font='500 78px "Cormorant Garamond", Georgia, serif'; c.letterSpacing='16px';
    c.fillText('SKILL ARCADE',384,74);
    const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
    const face=new THREE.Mesh(new THREE.PlaneGeometry(9,1.6),
      new THREE.MeshStandardMaterial({map:tex,roughness:.7,
        emissive:new THREE.Color(C.butter),emissiveMap:tex,emissiveIntensity:0}));
    face.position.set(0,7.2,5.19); arcade.add(face);
    LAMPS.push({mesh:face,mat:face.material,color:new THREE.Color(C.butter),
      intensity:.6,zone:'buildings',order:0,lit:0});
  }
  for(let i=0;i<16;i++){
    const b=emissive(C.butter,1.7,.15,'buildings',0);
    b.position.set(-4.4+i*.586,8.2,5.05); arcade.add(b);
  }

  // five cabinets, each with a CRT face
  MACHINES.forEach((mc,i)=>{
    const g=new THREE.Group();
    const x=-5.4+i*2.7;
    g.position.set(x,.86,-2.6+((i%2)?.5:0));
    g.rotation.y=(i-2)*.10;
    arcade.add(g);
    const body=new THREE.Mesh(new THREE.BoxGeometry(2.0,3.4,1.2),
      [M.woodRed,M.woodBlue,M.woodGreen,M.terracotta,M.woodMoss][i]);
    body.position.y=1.7; body.castShadow=true; g.add(body);
    // sloped control deck
    const deck=new THREE.Mesh(new THREE.BoxGeometry(1.9,.5,.8),M.woodPaper);
    deck.position.set(0,1.5,.75); deck.rotation.x=-.42; g.add(deck);
    // joystick + two buttons
    const stick=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,.4,6),M.ironDark);
    stick.position.set(-.5,1.86,.72); stick.rotation.x=-.42; g.add(stick);
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),M.woodRed);
    knob.position.set(-.5,2.04,.65); g.add(knob);
    [[.2,0xb45248],[.55,0xeaa94e]].forEach(([bx,col])=>{
      const btn=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.07,10),
        mat(col,{rough:.6}));
      btn.position.set(bx,1.79,.74); btn.rotation.x=-.42+Math.PI/2; g.add(btn);
    });
    // the screen: a CRT with the machine's name, dark until lit
    const scv=document.createElement('canvas'); scv.width=256; scv.height=192;
    const sx2=scv.getContext('2d');
    sx2.fillStyle='#0d1512'; sx2.fillRect(0,0,256,192);
    sx2.fillStyle='#7fdca8'; sx2.textAlign='center'; sx2.textBaseline='middle';
    sx2.font='500 44px Inter, sans-serif'; sx2.letterSpacing='4px';
    sx2.fillText(mc.name,128,80);
    sx2.font='400 17px Inter, sans-serif'; sx2.fillStyle='rgba(127,220,168,.66)';
    sx2.fillText('INSERT CURIOSITY',128,124);
    // scanlines
    sx2.globalAlpha=.14; sx2.fillStyle='#000';
    for(let y=0;y<192;y+=3) sx2.fillRect(0,y,256,1);
    sx2.globalAlpha=1;
    const stex=new THREE.CanvasTexture(scv); stex.colorSpace=THREE.SRGBColorSpace;
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.12),
      new THREE.MeshStandardMaterial({map:stex,roughness:.42,
        emissive:new THREE.Color(0x6fd79c),emissiveMap:stex,emissiveIntensity:0}));
    screen.position.set(0,2.5,.62); screen.rotation.x=-.12; g.add(screen);
    LAMPS.push({mesh:screen,mat:screen.material,color:new THREE.Color(0x6fd79c),
      intensity:.85,zone:'buildings',order:1,lit:0});
    // a coin slot detail
    const slot=new THREE.Mesh(new THREE.BoxGeometry(.34,.05,.06),M.brassDark);
    slot.position.set(.62,1.24,.61); g.add(slot);
  });

  hotspot(arcade,'arcade','Skill Arcade',
    {az:0.02,pol:1.34,dist:23,tgt:new THREE.Vector3(P.x,2.6,P.z+3)});
}

/* ------------------------------------------------------------
   9e · PRIZE CORNER — achievements, real and absurd, side by side
   ------------------------------------------------------------ */
const PRIZES=PC.awards.map(p=>({t:p.title,c:p.meta,d:p.detail}));

const prizes=new THREE.Group();
{
  const P={x:-24,z:-30};
  prizes.position.set(P.x,hAt(P.x,P.z),P.z); world.add(prizes);

  // a fairground booth: counter, striped awning, shelves of prizes behind
  const plinth=new THREE.Mesh(new THREE.BoxGeometry(11,.6,7),M.stone);
  plinth.position.y=.3; plinth.receiveShadow=true; prizes.add(plinth);
  const back=new THREE.Mesh(new THREE.BoxGeometry(10,4.8,.3),M.woodGreen);
  back.position.set(0,3.0,-3.1); back.castShadow=true; prizes.add(back);
  // framed cream insets behind the shelves — panelled stall frontage
  for(let p=0;p<4;p++){
    const px=-3.6+p*2.4;
    const pan=new THREE.Mesh(new THREE.BoxGeometry(1.9,3.6,.08),M.woodCream);
    pan.position.set(px,2.9,-2.92); prizes.add(pan);
  }
  [-4.85,4.85].forEach(sx=>{
    const w=new THREE.Mesh(new THREE.BoxGeometry(.3,4.8,6),M.woodCream);
    w.position.set(sx,3.0,0); w.castShadow=true; prizes.add(w);
    const pil=new THREE.Mesh(new THREE.BoxGeometry(.42,4.8,.42),M.woodGreen);
    pil.position.set(sx-Math.sign(sx)*.1,3.0,2.9); prizes.add(pil);
  });
  const counter=new THREE.Mesh(new THREE.BoxGeometry(10.4,.9,1.1),M.burgundy);
  counter.position.set(0,1.05,2.6); counter.castShadow=true; prizes.add(counter);
  const counterTop=new THREE.Mesh(new THREE.BoxGeometry(10.8,.16,1.5),M.woodCream);
  counterTop.position.set(0,1.56,2.6); counterTop.castShadow=true; prizes.add(counterTop);
  const goldTrim=new THREE.Mesh(new THREE.BoxGeometry(10.7,.1,.1),M.brass);
  goldTrim.position.set(0,1.02,3.2); prizes.add(goldTrim);

  // striped awning
  for(let i=0;i<11;i++){
    const s=new THREE.Mesh(new THREE.BoxGeometry(.92,.1,3.0),
      i%2?M.canvasRed:M.canvasWhite);
    s.position.set(-4.6+i*.94,5.1,1.5); s.rotation.x=-.2; s.castShadow=true;
    prizes.add(s);
  }
  valanceRun(prizes,10.2,4.72,2.94,0,PAR_valR);
  // opal globe lamps on the counter's end posts
  globeLamp(prizes,-4.9,3.4,2.9,'buildings',0);
  globeLamp(prizes,4.9,3.4,2.9,'buildings',0);

  // three shelves of trophies and nonsense
  const shelfObjs=[];
  for(let r=0;r<3;r++){
    const sh=new THREE.Mesh(new THREE.BoxGeometry(9.4,.12,1.0),M.woodCream);
    sh.position.set(0,1.9+r*1.15,-2.7); prizes.add(sh);
    for(let i=0;i<6;i++){
      const x=-3.9+i*1.56, y=2.0+r*1.15, k=(r*6+i)%9;
      const g=new THREE.Group(); g.position.set(x,y,-2.7); prizes.add(g);
      if(k===0){ // trophy cup
        const cup=new THREE.Mesh(new THREE.CylinderGeometry(.24,.14,.4,12),M.brass);
        cup.position.y=.42; g.add(cup);
        const stem=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.2,8),M.brass);
        stem.position.y=.12; g.add(stem);
        const base=new THREE.Mesh(new THREE.BoxGeometry(.3,.1,.3),M.woodRed);
        base.position.y=.05; g.add(base);
        [-.26,.26].forEach(hx=>{
          const h=new THREE.Mesh(new THREE.TorusGeometry(.09,.025,5,10,Math.PI),M.brass);
          h.position.set(hx,.44,0); h.rotation.z=hx>0?0:Math.PI; g.add(h);
        });
      } else if(k===1){ // oversized ribbon
        const disc=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.05,14),M.canvasRed);
        disc.position.y=.5; disc.rotation.x=Math.PI/2; g.add(disc);
        [-.13,.13].forEach(tx=>{
          const tail=new THREE.Mesh(new THREE.BoxGeometry(.13,.5,.03),M.canvasRed);
          tail.position.set(tx,.2,.02); tail.rotation.z=tx>0?.16:-.16; g.add(tail);
        });
      } else if(k===2){ // coffee cup trophy
        const c=new THREE.Mesh(new THREE.CylinderGeometry(.2,.15,.36,12),M.canvasWhite);
        c.position.y=.2; g.add(c);
        const h=new THREE.Mesh(new THREE.TorusGeometry(.1,.03,5,10,Math.PI),M.canvasWhite);
        h.position.set(.24,.22,0); h.rotation.y=Math.PI/2; g.add(h);
        const plaque=new THREE.Mesh(new THREE.BoxGeometry(.34,.12,.06),M.brass);
        plaque.position.y=.02; g.add(plaque);
      } else if(k===3){ // broken keyboard
        const kb=new THREE.Mesh(new THREE.BoxGeometry(.86,.07,.32),M.ironDark);
        kb.position.y=.06; kb.rotation.z=.1; g.add(kb);
        for(let q=0;q<9;q++){
          const key=new THREE.Mesh(new THREE.BoxGeometry(.07,.04,.07),M.woodPaper);
          key.position.set(-.34+q*.085,.12+(q===4?.06:0),(q%2?.05:-.05));
          key.rotation.z=q===4?.5:0; g.add(key);
        }
      } else if(k===4){ // airplane ticket
        const t=new THREE.Mesh(new THREE.BoxGeometry(.62,.02,.3),
          mat(0xf2e6cf,{rough:.94}));
        t.position.y=.03; t.rotation.y=.3; g.add(t);
        const stripe=new THREE.Mesh(new THREE.BoxGeometry(.1,.03,.3),M.canvasRed);
        stripe.position.set(.22,.04,0); stripe.rotation.y=.3; g.add(stripe);
      } else if(k===5){ // strange plush
        const b=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),M.wool);
        b.position.y=.3; b.scale.set(1,.88,1); g.add(b);
        const hd=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),M.wool);
        hd.position.y=.6; g.add(hd);
        [-.1,.1].forEach(ex=>{
          const e=new THREE.Mesh(new THREE.SphereGeometry(.03,6,6),M.ink);
          e.position.set(ex,.63,.14); g.add(e);
        });
        [-.17,.17].forEach(ax=>{
          const ear=new THREE.Mesh(new THREE.SphereGeometry(.07,7,6),M.wool);
          ear.position.set(ax,.68,0); ear.scale.set(.7,1.2,.6); g.add(ear);
        });
      } else if(k===6){ // bug badge
        const body=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),M.canvasRed);
        body.position.y=.24; body.scale.set(1,.7,1.3); g.add(body);
        for(let L=0;L<3;L++){
          [-1,1].forEach(sd=>{
            const leg=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.2,4),M.ink);
            leg.position.set(sd*.18,.14,-.12+L*.12); leg.rotation.z=sd*.7; g.add(leg);
          });
        }
      } else if(k===7){ // medal
        const m=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.04,14),M.brass);
        m.position.y=.42; m.rotation.x=Math.PI/2; g.add(m);
        const rb=new THREE.Mesh(new THREE.BoxGeometry(.2,.34,.03),M.canvasBlue);
        rb.position.y=.66; g.add(rb);
      } else { // a covered mystery prize
        const cloth=new THREE.Mesh(new THREE.ConeGeometry(.3,.5,10),M.canvasSage);
        cloth.position.y=.26; g.add(cloth);
        const q=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),M.brass);
        q.position.y=.54; g.add(q);
      }
      shelfObjs.push(g);
    }
  }
  prizes.userData.shelf=shelfObjs;

  // warm bulb strand under the awning
  for(let i=0;i<9;i++){
    const b=emissive(C.butter,1.5,.16,'buildings',0);
    b.position.set(-4+i*1.0,4.5,2.86); prizes.add(b);
  }

  const sign=signPost('PRIZE CORNER','AWARDS · OUTCOMES',7.2,1.7,50);
  sign.position.set(0,6.2,2.9); prizes.add(sign);

  hotspot(prizes,'prizes','Prize Corner',
    {az:0.04,pol:1.32,dist:19,tgt:new THREE.Vector3(P.x,2.4,P.z+2.5)});
}

/* ------------------------------------------------------------
   9f · THE GALLERY — photographs, hung like an exhibition
   A long open-air wall of framed prints plus a Polaroid line.
   ------------------------------------------------------------ */
const PHOTOS=PC.photos;

const gallery=new THREE.Group();
{
  const P={x:-33,z:60};
  gallery.position.set(P.x,hAt(P.x,P.z),P.z);
  gallery.rotation.y=-.62; world.add(gallery);

  // a gravel court with a long wall
  const court=new THREE.Mesh(new THREE.BoxGeometry(22,.4,10),M.stone);
  court.position.y=.2; court.receiveShadow=true; gallery.add(court);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(21,5.6,.5),M.woodCream);
  wall.position.set(0,3.2,-4.2); wall.castShadow=true; gallery.add(wall);
  // pilasters between the frames — museum wall rhythm
  for(let p=0;p<6;p++){
    const px=-8.5+p*3.4;
    const pil=new THREE.Mesh(new THREE.BoxGeometry(.5,5.2,.18),M.woodGreen);
    pil.position.set(px,3.2,-3.92); gallery.add(pil);
    const capP=new THREE.Mesh(new THREE.BoxGeometry(.66,.18,.24),M.brass);
    capP.position.set(px,5.75,-3.9); gallery.add(capP);
  }
  const cap=new THREE.Mesh(new THREE.BoxGeometry(21.6,.34,1.0),M.woodGreen);
  cap.position.set(0,6.15,-4.2); gallery.add(cap);
  dentilRun(gallery,21,5.95,-3.66,30);
  // a light shelf that washes the wall at night
  const shelf=new THREE.Mesh(new THREE.BoxGeometry(20.4,.16,.7),M.brassDark);
  shelf.position.set(0,5.9,-3.75); gallery.add(shelf);
  for(let i=0;i<7;i++){
    const b=emissive(0xfff0d0,1.9,.19,'buildings',0);
    b.position.set(-8.4+i*2.8,5.72,-3.62); gallery.add(b);
  }

  // Real photographs on the wall. Image ratios are preserved inside the mounts.
  const frameMats=[M.woodCream,M.brassDark,M.woodRed];
  const photoLoader=new THREE.TextureLoader();
  PHOTOS.slice(0,5).forEach((ph,i)=>{
    const x=-8.6+i*4.3, y=3.55, w=3.0, h=3.1;
    const frame=new THREE.Mesh(new THREE.BoxGeometry(w,h,.14),frameMats[i%3]);
    frame.position.set(x,y,-3.9); frame.castShadow=true; gallery.add(frame);
    const mount=new THREE.Mesh(new THREE.PlaneGeometry(w*.88,h*.86),
      new THREE.MeshStandardMaterial({color:0xf7f2e6,roughness:.95}));
    mount.position.set(x,y,-3.81); gallery.add(mount);
    const printMat=new THREE.MeshStandardMaterial({color:0xe9e0cf,roughness:.86});
    const print=new THREE.Mesh(new THREE.PlaneGeometry(1,1),printMat);
    print.position.set(x,y+h*.04,-3.80); gallery.add(print);
    photoLoader.load(ph.thumb,tex=>{
      tex.colorSpace=THREE.SRGBColorSpace; printMat.map=tex; printMat.color.set(0xffffff); printMat.needsUpdate=true;
      const aspect=tex.image.width/tex.image.height, maxW=w*.72, maxH=h*.68;
      const pw=Math.min(maxW,maxH*aspect), phh=Math.min(maxH,maxW/aspect);
      print.scale.set(pw,phh,1);
    });
    // a museum label plate beneath each frame
    const lp=new THREE.Mesh(new THREE.BoxGeometry(w*.5,.2,.05),M.brass);
    lp.position.set(x,y-h*.62,-3.86); gallery.add(lp);
  });

  // a washing line of polaroids across the court
  const line=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,19,4),M.ironDark);
  line.position.set(0,4.3,1.4); line.rotation.z=Math.PI/2; gallery.add(line);
  const polas=[];
  for(let i=0;i<Math.min(10,Math.max(0,PHOTOS.length-5));i++){
    const g=new THREE.Group();
    g.position.set(-8.5+i*1.9,3.7,1.4);
    const card=new THREE.Mesh(new THREE.BoxGeometry(1.0,1.2,.03),
      mat(0xf8f4e8,{rough:.95}));
    g.add(card);
    const photo=PHOTOS[i+5];
    const imgMat=new THREE.MeshStandardMaterial({color:0xd8cfbe,roughness:.9});
    const img=new THREE.Mesh(new THREE.PlaneGeometry(.84,.84),imgMat);
    img.position.set(0,.13,.02); g.add(img);
    photoLoader.load(photo.thumb,tex=>{
      tex.colorSpace=THREE.SRGBColorSpace;
      const aspect=tex.image.width/tex.image.height;
      if(aspect>1){ tex.repeat.set(1/aspect,1); tex.offset.set((1-1/aspect)/2,0); }
      else { tex.repeat.set(1,aspect); tex.offset.set(0,(1-aspect)/2); }
      imgMat.map=tex; imgMat.color.set(0xffffff); imgMat.needsUpdate=true;
    });
    const clip=new THREE.Mesh(new THREE.BoxGeometry(.1,.16,.06),M.brass);
    clip.position.set(0,.62,0); g.add(clip);
    gallery.add(g); polas.push(g);
  }
  gallery.userData.polas=polas;

  // two benches to view from
  [[-4.6,3.2],[4.6,3.2]].forEach(([x,z])=>{
    const b=new THREE.Group(); b.position.set(x,.4,z); gallery.add(b);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(3.0,.16,.9),M.woodCream);
    seat.position.y=.66; seat.castShadow=true; b.add(seat);
    [-1.3,1.3].forEach(sx=>{
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.16,.66,.8),M.stone);
      leg.position.set(sx,.33,0); b.add(leg);
    });
  });

  const sign=signPost('THE GALLERY','FOURTEEN PHOTOGRAPHS',6.8,1.7,52);
  sign.position.set(-9.6,2.4,4.4); sign.rotation.y=.5; gallery.add(sign);
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.14,.16,2.4,8),M.woodCream);
  sp.position.set(-9.6,1.2,4.4); gallery.add(sp);

  hotspot(gallery,'gallery','The Gallery',
    {az:-.60,pol:1.24,dist:27,tgt:new THREE.Vector3(P.x,3.4,P.z-1)});
}

/* ==== part6_systems ==== */
/* ============================================================
   14 · POST-PROCESSING — restrained bloom + a saturation/vignette pass
   ============================================================ */
const composer=COMPAT_3D?null:new EffectComposer(renderer);
if(composer) composer.addPass(new RenderPass(scene,camera));
const bloom=COMPAT_3D?null:new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.24,.85,.82);
if(composer&&bloom) composer.addPass(bloom);
const gradePass=COMPAT_3D?null:new ShaderPass({
  uniforms:{
    tDiffuse:{value:null}, sat:{value:1.0}, warm:{value:0.0}, vig:{value:.34}
  },
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`
    uniform sampler2D tDiffuse; uniform float sat,warm,vig; varying vec2 vUv;
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      float l=dot(c.rgb,vec3(.2126,.7152,.0722));
      c.rgb=mix(vec3(l),c.rgb,sat);
      c.rgb+=vec3(warm*.05,warm*.018,-warm*.022);
      float d=distance(vUv,vec2(.5));
      c.rgb*=1.0-smoothstep(.34,.92,d)*vig;
      gl_FragColor=c;
    }`
});
if(composer&&gradePass) composer.addPass(gradePass);

/* ============================================================
   15 · WORLD STATE (day / sunset / night) with real transitions
   ============================================================ */
let stateName='day';
const cur={ // animated values
  top:new THREE.Color(STATES.day.top), mid:new THREE.Color(STATES.day.mid), bot:new THREE.Color(STATES.day.bot),
  fog:new THREE.Color(STATES.day.fog), fogNear:STATES.day.fogNear, fogFar:STATES.day.fogFar,
  sunPos:new THREE.Vector3(...STATES.day.sunPos), sunColor:new THREE.Color(STATES.day.sunColor),
  sunI:STATES.day.sunI, hemiSky:new THREE.Color(STATES.day.hemiSky), hemiGround:new THREE.Color(STATES.day.hemiGround),
  hemiI:STATES.day.hemiI, fillI:STATES.day.fillI, exposure:1, bloom:.24, bulb:.06, star:0, vig:.34, sat:1
};
let tween=null;
function setState(name,dur){
  if(stateName===name && tween===null) { /* still re-run to sync UI */ }
  stateName=name;
  const to=STATES[name];
  const from={
    top:cur.top.clone(), mid:cur.mid.clone(), bot:cur.bot.clone(), fog:cur.fog.clone(),
    fogNear:cur.fogNear, fogFar:cur.fogFar, sunPos:cur.sunPos.clone(), sunColor:cur.sunColor.clone(),
    sunI:cur.sunI, hemiSky:cur.hemiSky.clone(), hemiGround:cur.hemiGround.clone(), hemiI:cur.hemiI,
    fillI:cur.fillI, exposure:cur.exposure, bloom:cur.bloom, bulb:cur.bulb, star:cur.star, vig:cur.vig, sat:cur.sat
  };
  tween={t:0,dur:(dur??(REDUCED?400:3000)),from,to};
  document.querySelectorAll('.switchbank .sw[data-state]').forEach(b=>{
    b.setAttribute('aria-pressed', String(b.dataset.state===name));
  });
}
function stepState(dt){
  if(!tween) return;
  tween.t=Math.min(1,tween.t+dt*1000/tween.dur);
  const e=easeInOut(tween.t), f=tween.from, to=tween.to;
  cur.top.copy(f.top).lerp(new THREE.Color(to.top),e);
  cur.mid.copy(f.mid).lerp(new THREE.Color(to.mid),e);
  cur.bot.copy(f.bot).lerp(new THREE.Color(to.bot),e);
  cur.fog.copy(f.fog).lerp(new THREE.Color(to.fog),e);
  cur.fogNear=lerp(f.fogNear,to.fogNear,e); cur.fogFar=lerp(f.fogFar,to.fogFar,e);
  cur.sunPos.copy(f.sunPos).lerp(new THREE.Vector3(...to.sunPos),e);
  cur.sunColor.copy(f.sunColor).lerp(new THREE.Color(to.sunColor),e);
  cur.sunI=lerp(f.sunI,to.sunI,e);
  cur.hemiSky.copy(f.hemiSky).lerp(new THREE.Color(to.hemiSky),e);
  cur.hemiGround.copy(f.hemiGround).lerp(new THREE.Color(to.hemiGround),e);
  cur.hemiI=lerp(f.hemiI,to.hemiI,e);
  cur.fillI=lerp(f.fillI,to.fillI,e);
  cur.exposure=lerp(f.exposure,to.exposure,e);
  cur.bloom=lerp(f.bloom,to.bloom,e);
  cur.bulb=lerp(f.bulb,to.bulb,e);
  cur.star=lerp(f.star,to.star,e);
  cur.vig=lerp(f.vig,to.vig,e);
  cur.sat=lerp(f.sat,to.sat,e);
  if(tween.t>=1) tween=null;
}
function pushState(){
  skyUniforms.topColor.value.copy(cur.top);
  skyUniforms.midColor.value.copy(cur.mid);
  skyUniforms.botColor.value.copy(cur.bot);
  scene.fog.color.copy(cur.fog); scene.fog.near=cur.fogNear; scene.fog.far=cur.fogFar;
  sun.position.copy(cur.sunPos); sun.color.copy(cur.sunColor); sun.intensity=cur.sunI;
  hemi.color.copy(cur.hemiSky);
  hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround); hemi.intensity=cur.hemiI;
  fill.intensity=cur.fillI;
  renderer.toneMappingExposure=cur.exposure;
  if(bloom) bloom.strength=cur.bloom;
  if(gradePass){
    gradePass.uniforms.sat.value=cur.sat;
    gradePass.uniforms.vig.value=cur.vig;
    gradePass.uniforms.warm.value=stateName==='sunset'?1:(stateName==='night'?-.4:0);
  }
  starLayers.forEach(p=>{ p.material.opacity=cur.star*.85*p.userData.bright; });
  skyUniforms.uStars.value=cur.star;
  // distant hills/trees take the sky's own light so they never look pasted on
  if(typeof BEYOND_MATS!=='undefined'){
    const night=cur.star, warm=stateName==='sunset'?1:0;
    BEYOND_MATS.forEach(m=>{
      if(!m||!m.color||!m.__base) return;
      m.color.copy(m.__base);
      if(night>.01) m.color.lerp(cur.hemiSky, night*.42).multiplyScalar(1-night*.34);
      if(warm) m.color.lerp(new THREE.Color(0xf0b48a), .30);
    });
  }
  fireflies.material.opacity=stateName==='night'?cur.star*.75:0;
  motes.material.opacity=stateName==='night'?.15:lerp(.10,.20,1-cur.star);   // dust must not read as daytime stars
  birds.children.forEach(b=>b.material.opacity=(1-cur.star)*.55);
}

/* ============================================================
   16 · LIGHTS — the signature cascade
   ============================================================ */
const ZONE_ORDER=['gate','paths','buildings','circus','coaster','ferris','graveyard'];
let lightsOn=true;
let cascade=null; // {t}
function setLights(on,cascadeIt){
  lightsOn=on;
  const btn=document.getElementById('btn-lights');
  btn.classList.toggle('off',!on);
  btn.setAttribute('aria-pressed',String(on));
  if(on && cascadeIt!==false){
    cascade={t:0};
    LAMPS.forEach(l=>{ l.target=0; });
  }else{
    cascade=null;
    LAMPS.forEach(l=>{ l.target=on?1:0; });
  }
}
function stepLights(dt){
  // cascade: zones ignite in order, ending with the ferris wheel
  if(cascade){
    cascade.t+=dt;
    const perZone=REDUCED?.12:.55;
    LAMPS.forEach(l=>{
      const zi=Math.max(0,ZONE_ORDER.indexOf(l.zone));
      const start=zi*perZone;
      l.target = cascade.t>start ? 1 : 0;
    });
    if(cascade.t> ZONE_ORDER.length*perZone+1.6) cascade=null;
  }
  // per-lamp easing, with a little flicker so bulbs feel physical
  const bulbMaster=cur.bulb;
  LAMPS.forEach((l,i)=>{
    const tgt=(l.target ?? (lightsOn?1:0));
    l.lit=lerp(l.lit,tgt,1-Math.pow(.001,dt));
    const flick=1+Math.sin(clock*7.3+i*2.1)*.035+Math.sin(clock*19+i)*.015;
    l.mat.emissiveIntensity=l.lit*l.intensity*Math.max(bulbMaster,l.lit*bulbMaster)*flick;
  });
  // the big spill lights follow the ferris wheel & circus
  const ferrisLit=LAMPS.filter(l=>l.zone==='ferris').reduce((a,l)=>a+l.lit,0)/Math.max(1,LAMPS.filter(l=>l.zone==='ferris').length);
  moonGlow.intensity=ferrisLit*bulbMaster*96;
  moonGlow.distance=96;
  const circusLit=LAMPS.filter(l=>l.zone==='circus').reduce((a,l)=>a+l.lit,0)/Math.max(1,LAMPS.filter(l=>l.zone==='circus').length);
  circusGlow.intensity=circusLit*bulbMaster*54; circusGlow.distance=68;
  const gateLit=LAMPS.filter(l=>l.zone==='gate').reduce((a,l)=>a+l.lit,0)/Math.max(1,LAMPS.filter(l=>l.zone==='gate').length);
  gateGlow.intensity=gateLit*bulbMaster*46; gateGlow.distance=60;
  // outer zones light their own ground once their bulbs are up
  const zoneLit={};
  ZONE_ORDER.forEach(z=>{
    const ls=LAMPS.filter(l=>l.zone===z);
    zoneLit[z]=ls.length?ls.reduce((a,l)=>a+l.lit,0)/ls.length:0;
  });
  nightFill.intensity=bulbMaster*0.55;
  // ground pools follow the path lamps
  const pathLit=(()=>{const ls=LAMPS.filter(l=>l.zone==='paths');
    return ls.length?ls.reduce((a,l)=>a+l.lit,0)/ls.length:0;})();
  LAMP_POOLS.forEach(p=>{ p.mat.opacity=pathLit*bulbMaster*p.peak; });
  zoneGlows.forEach(g=>{
    g.light.intensity=(zoneLit[g.zone]||0)*bulbMaster*g.mul;
    g.light.distance=g.dist;
  });
}
LAMPS.forEach(l=>l.target=1);

/* ============================================================
   17 · WEATHER / DREAM
   ============================================================ */
let weather='clear', dreamAmt=0, dreamTarget=0;
function setWeather(w){
  weather=w;
  dreamTarget=w==='dream'?1:0;
  document.querySelectorAll('#wbank .sw').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.w===w)));
  if(w==='rain'){ toast('Rain. Dolly has gone inside.'); dollyShelter(true); }
  else if(w==='snow'){ toast('Snow. The park keeps its lights on.'); dollyShelter(false); }
  else if(w==='dream'){ toast('Something is slightly wrong.'); dollyShelter(false); }
  else dollyShelter(false);
}
let wxAmt={rain:0,snow:0};
const SNOW_TINT=[]; // materials that accumulate snow, with their base colors
function registerSnow(m){ if(m&&!m.__snowBase){ m.__snowBase=m.color.clone(); SNOW_TINT.push(m); } }
/* the outer world must age with the park: snow settles on distant hills and trees too */
if(typeof BEYOND_MATS!=='undefined') BEYOND_MATS.forEach(m=>{ if(m&&m.color) registerSnow(m); });
function snowCover(a){
  for(const m of SNOW_TINT) m.color.copy(m.__snowBase).lerp(WHITE_SNOW,a*.62);
}
const WHITE_SNOW=new THREE.Color(0xf6f8fa);
function stepWeather(dt){
  skyUniforms.uTime.value=clock;   // dome starfield twinkle + aurora drift
  const rt=weather==='rain'?1:0, st=weather==='snow'?1:0;
  wxAmt.rain=lerp(wxAmt.rain,rt,dt*1.6);
  wxAmt.snow=lerp(wxAmt.snow,st,dt*1.6);
  // rain: overcast, cool, wet reflective ground. snow: pale, cold, accumulating.
  const w=wxAmt.rain, sn=wxAmt.snow;
  sun.intensity=cur.sunI*(1-w*.34-sn*.30);
  hemi.intensity=cur.hemiI*(1+w*.52+sn*.30);
  hemi.color.lerp(new THREE.Color(w?0xc3d4e2:0xdfe9f4), (w+sn)*.5*dt*3);
  scene.fog.near=cur.fogNear*(1-w*.34-sn*.12);
  scene.fog.far=cur.fogFar*(1-w*.26-sn*.05);
  scene.fog.color.lerp(new THREE.Color(0xccd8dd), w*.42);
  scene.fog.color.lerp(new THREE.Color(0xdde5e8), sn*.5);
  // a rain sky with a warm break low down — the good kind of rainy day
  skyUniforms.topColor.value.lerp(new THREE.Color(0x8397a8), w*.62);
  skyUniforms.midColor.value.lerp(new THREE.Color(0xb9c6cf), w*.58);
  skyUniforms.botColor.value.lerp(new THREE.Color(0xe4d9c6), w*.52);
  skyUniforms.topColor.value.lerp(new THREE.Color(0x93a6b6), sn*.5);
  skyUniforms.midColor.value.lerp(new THREE.Color(0xbcc7cf), sn*.5);
  skyUniforms.botColor.value.lerp(new THREE.Color(0xd2d9da), sn*.5);
  // wet paths gain specularity; snow whitens the turf and roofs
  ground.material.roughness=lerp(.96,.62,w);   // damp, not mirrored
  ground.material.color.setRGB(1,1,1).lerp(new THREE.Color(0xa9b6ba),w*.18);
  snowBlanket.visible=sn>.01;
  snowBlanket.material.opacity=sn*.86;
  // the country beyond the park whitens with it, so there is no snow-line ring
  if(typeof SKIRT_SNOW!=='undefined' && SKIRT_SNOW){
    SKIRT_SNOW.visible=sn>.01;
    SKIRT_SNOW.material.opacity=sn*.80;
  }
  // snow settles on every upward face: paths, roofs, canopies
  snowCover(Math.min(1,sn*1.5));   // deeper accumulation so daytime snow is obvious
  ground.material.metalness=w*.10;   // reflection belongs to the puddles, not the whole park
  pond.material.roughness=lerp(.16,.04,w);
  // puddles fade in on the paths
  if(typeof PUDDLES!=='undefined') PUDDLES.forEach((p,i)=>{
    p.material.opacity=w*(.70+Math.sin(clock*1.6+i)*.07);
    p.visible=w>.02;
  });
  rain.material.opacity=lerp(rain.material.opacity,rt*.85,dt*2.2);
  snow.material.opacity=lerp(snow.material.opacity,st,dt*2.2);
  dreamAmt=lerp(dreamAmt,dreamTarget,dt*1.3);
  // real fireworks over the park during the dream
  if(typeof FIREWORKS!=='undefined' && FIREWORKS) FIREWORKS.step(dt,dreamAmt);
  if(dreamAmt>.004){
    const D=dreamAmt;
    // violet-teal dusk that never quite resolves
    skyUniforms.topColor.value.lerp(new THREE.Color(0x2a1f4e), D*.80);
    skyUniforms.midColor.value.lerp(new THREE.Color(0x6b4a86), D*.72);
    skyUniforms.botColor.value.lerp(new THREE.Color(0xd98fa8), D*.62);
    // dream lifts the dome's own starfield + aurora so they read at any camera angle
    skyUniforms.uDream.value=D;
    skyUniforms.uStars.value=Math.max(skyUniforms.uStars.value, lerp(0,1,Math.min(1,D*1.25)));
    scene.fog.color.lerp(new THREE.Color(0x4a3a66), D*.7);
    scene.fog.near=cur.fogNear*(1-D*.34);
    scene.fog.far=cur.fogFar*(1-D*.20);
    sun.color.lerp(new THREE.Color(0xffc2e0), D*.6);
    sun.intensity*=1-D*.18;
    hemi.color.lerp(new THREE.Color(0xb59ae0), D*.7);
    hemi.groundColor.lerp(new THREE.Color(0x4d3d6b), D*.7);
    hemi.intensity*=1+D*.78;
    fill.color.lerp(new THREE.Color(0x9fd8e8), D*.7);
    fill.intensity=lerp(fill.intensity,1.16,D*.6);
    if(bloom){
      bloom.strength=lerp(bloom.strength,.92,D*.85);
      bloom.radius=lerp(bloom.radius,.48,D*.7);
    }
    renderer.toneMappingExposure*=1+D*.13;
    // stars bloom and drift toward warm pink inside the dream
    starLayers.forEach(p=>{
      p.material.opacity=Math.max(p.material.opacity, D*(.55+.45*p.userData.bright));
      p.material.color.lerp(new THREE.Color(0xffe4f2), D*.5);
      p.material.size=p.userData.size0||(p.userData.size0=p.material.size);
      p.material.size=p.userData.size0*(1+D*.55);
    });
  } else { skyUniforms.uDream.value=lerp(skyUniforms.uDream.value,0,.3); }
  if(rain.material.opacity>.01){
    // the whole volume rides with the camera, so rain covers wherever you look
    rain.position.set(Math.round(camera.position.x),0,Math.round(camera.position.z));
    const p=rain.geometry.attributes.position, L=rain.userData.len;
    const gust=Math.sin(clock*.23)*.5+Math.sin(clock*.61)*.25;   // slow wind drift
    const fall=dt*54, sway=dt*gust*7.5, span=RAIN_SPAN, half=span*.5;
    for(let i=0;i<p.count;i+=2){
      let yT=p.getY(i)-fall, len=L?L[i]:2.4;
      let xT=p.getX(i)+sway;
      if(yT<0){ yT+=RAIN_H; }
      if(xT>half) xT-=span; else if(xT<-half) xT+=span;
      // streaks lean into the wind instead of falling dead vertical
      const lean=gust*.9;
      p.setY(i,yT);     p.setX(i,xT);
      p.setY(i+1,yT-len); p.setX(i+1,xT+lean);
    }
    p.needsUpdate=true;
  }
  if(snow.material.opacity>.01){
    snow.position.set(Math.round(camera.position.x),0,Math.round(camera.position.z));
    const p=snow.geometry.attributes.position;
    const drift=Math.sin(clock*.19)*.6+Math.sin(clock*.47)*.3;
    const half=SNOW_SPAN*.5;
    for(let i=0;i<p.count;i++){
      // each flake keeps its own tumble phase, so the fall never looks like a grid
      const ph=i*.618;
      let y=p.getY(i)-dt*(4.2+Math.sin(ph)*1.1);
      if(y<0) y+=SNOW_H;
      p.setY(i,y);
      let x=p.getX(i)+(Math.sin(clock*.55+ph*3.1)*1.5+drift*2.2)*dt;
      let z=p.getZ(i)+(Math.cos(clock*.41+ph*2.3)*1.1)*dt;
      if(x>half) x-=SNOW_SPAN; else if(x<-half) x+=SNOW_SPAN;
      if(z>half) z-=SNOW_SPAN; else if(z<-half) z+=SNOW_SPAN;
      p.setX(i,x); p.setZ(i,z);
    }
    p.needsUpdate=true;
  }
  // rain darkens & wets: raise reflectivity of paths cheaply via fog + grade
  if(gradePass){
    gradePass.uniforms.sat.value=cur.sat*(1-wxAmt.rain*.04-wxAmt.snow*.3)*(dreamAmt>.02?lerp(1,1.14,dreamAmt):1);
    gradePass.uniforms.vig.value=cur.vig*(1+wxAmt.rain*.12-wxAmt.snow*.22);
  }
  renderer.toneMappingExposure=cur.exposure*(1+wxAmt.rain*.06+wxAmt.snow*.02);
}
function dollyShelter(inside){
  dolly.userData.shelter=inside;
}

/* ============================================================
   18 · CAMERA CONTROL — bounded orbit + cinematic focus moves
   ============================================================ */
let focusId=null;
let camAnim=null;
function flyTo(focus,dur,after){
  const from={az:rig.azT,pol:rig.polT,dist:rig.distT,tgt:rig.tgtT.clone()};
  camAnim={t:0,dur:dur??(REDUCED?300:1700),from,to:{
    az:focus.az,pol:focus.pol,dist:focus.dist,tgt:focus.tgt.clone()
  },after};
}
function stepCam(dt){
  if(camAnim){
    camAnim.t=Math.min(1,camAnim.t+dt*1000/camAnim.dur);
    const e=easeOutCubic(camAnim.t), f=camAnim.from, t=camAnim.to;
    rig.azT=lerp(f.az,t.az,e); rig.polT=lerp(f.pol,t.pol,e); rig.distT=lerp(f.dist,t.dist,e);
    rig.tgtT.copy(f.tgt).lerp(t.tgt,e);
    if(camAnim.t>=1){ const cb=camAnim.after; camAnim=null; cb&&cb(); }
  }
  // spring toward targets — weighted, never snappy
  const k=1-Math.pow(REDUCED?.0001:.0035,dt);
  rig.az=lerp(rig.az,rig.azT,k);
  rig.pol=lerp(rig.pol,rig.polT,k);
  rig.dist=lerp(rig.dist,rig.distT,k);
  rig.tgt.lerp(rig.tgtT,k);
  applyRig();
}
function toOverview(){
  focusId=null;
  document.body.dataset.focus='0';
  setRigLimits({azMin:-Math.PI,azMax:Math.PI,polMin:0.42,polMax:1.44,distMin:26,distMax:275});
  flyTo(OVERVIEW,REDUCED?300:1800);
  closeSheet(); closeDolly();
  document.getElementById('back').classList.remove('show');
}
function focusOn(id){
  const h=HOT.find(x=>x.id===id); if(!h) return;
  focusId=id;
  document.body.dataset.focus='1';
  /* The sheet covers the right third on desktop. Slide the look-at point along
     the camera's own right axis so the subject lands in the clear left area,
     independent of which way the shot is facing. */
  let tgt=h.focus.tgt;
  if(!MOBILE && id!=='dolly'){
    const dir=new THREE.Vector3().setFromSpherical(
      new THREE.Spherical(1,h.focus.pol,h.focus.az));
    const right=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0)).normalize();
    tgt=h.focus.tgt.clone().addScaledVector(right,-h.focus.dist*0.13);
  }
  const f={az:h.focus.az,pol:h.focus.pol,dist:h.focus.dist,tgt};
  setRigLimits({azMin:f.az-0.5,azMax:f.az+0.5,
    polMin:0.48,polMax:1.42,distMin:f.dist*.6,distMax:f.dist*1.6});
  flyTo(f);
  document.getElementById('back').classList.add('show');
  document.getElementById('mapcard').classList.remove('open');
  document.getElementById('mapcard').setAttribute('aria-hidden','true');
  document.getElementById('btn-map').setAttribute('aria-pressed','false');
  if(id==='dolly'){ closeSheet(); openDolly(); }
  else { closeDolly(); openSheetFor(id); }
  if(id==='graveyard') discover('graveyard','You found the graveyard. Ideas at rest.');
}

/* --------- pointer: drag to orbit, wheel to lean in, click to pick --------- */
const ray=new THREE.Raycaster();
const ptr=new THREE.Vector2(-9,-9);
let dragging=false, moved=0, lastX=0, lastY=0, pinchD=0, panning=false;
const PAN_C=new THREE.Vector3(2,0,2);   // park centre for the pan leash
let hoverId=null;

function onDown(e){
  if(e.target.closest('.hud,#mapcard,#sheet,#dolly,#back,#intro,#skip')) return;
  dragging=true; moved=0;
  // right button or shift = pan the look-at point instead of orbiting it
  panning=(e.button===2)||e.shiftKey;
  const t=e.touches?e.touches[0]:e;
  lastX=t.clientX; lastY=t.clientY;
  if(e.touches&&e.touches.length===2){
    pinchD=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  }
  stage.classList.add('grabbing');
}
function onMove(e){
  const t=e.touches?e.touches[0]:e;
  ptr.x=(t.clientX/innerWidth)*2-1;
  ptr.y=-(t.clientY/innerHeight)*2+1;
  if(e.touches&&e.touches.length===2){
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    rig.distT=clamp(rig.distT*(pinchD/d),rig.distMin,rig.distMax);
    pinchD=d; moved+=20; return;
  }
  if(dragging){
    const dx=t.clientX-lastX, dy=t.clientY-lastY;
    lastX=t.clientX; lastY=t.clientY;
    moved+=Math.abs(dx)+Math.abs(dy);
    camAnim=null;
    if(panning){
      // slide the look-at point across the ground plane, camera-relative
      const fwd=new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y=0; fwd.normalize();
      const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),fwd).normalize();
      const k=rig.distT*.0016;
      rig.tgtT.addScaledVector(right,dx*k).addScaledVector(fwd,-dy*k);
      // keep the park reachable but never let the view drift into empty terrain
      const off=rig.tgtT.clone().sub(PAN_C); off.y=0;
      if(off.length()>PAN_LIMIT){ off.setLength(PAN_LIMIT); rig.tgtT.copy(PAN_C).add(off).setY(rig.tgtT.y); }
      rig.tgtT.y=clamp(rig.tgtT.y,2,34);
    }else{
      const spd=MOBILE?.006:.0042;
      rig.azT=clamp(rig.azT-dx*spd,rig.azMin,rig.azMax);
      rig.polT=clamp(rig.polT-dy*spd*.8,rig.polMin,rig.polMax);
    }
  }
  const tip=document.getElementById('tip');
  tip.style.left=t.clientX+'px'; tip.style.top=t.clientY+'px';
}
function onUp(e){
  stage.classList.remove('grabbing');
  const wasDragging=dragging; dragging=false;
  if(panning){ panning=false; return; }   // a pan is never a click
  if(!wasDragging) return;
  if(moved>9) return; // that was a look-around, not a click
  pick();
}
function onWheel(e){
  if(e.target.closest('#sheet,#dolly,#mapcard')) return;
  e.preventDefault();
  camAnim=null;
  rig.distT=clamp(rig.distT+e.deltaY*.055,rig.distMin,rig.distMax);
}
function hitTest(){
  ray.setFromCamera(ptr,camera);
  const hits=ray.intersectObjects(world.children,true);
  for(const h of hits){
    let o=h.object;
    while(o){ if(o.userData.hotId) return o.userData.hotId; o=o.parent; }
  }
  return null;
}
function pick(){
  const id=hitTest();
  if(!id){ if(focusId) toOverview(); return; }
  if(id===focusId){ return; }
  focusOn(id);
}
stage.addEventListener('mousedown',onDown);
addEventListener('mousemove',onMove,{passive:true});
addEventListener('mouseup',onUp);
stage.addEventListener('touchstart',onDown,{passive:true});
addEventListener('touchmove',onMove,{passive:true});
addEventListener('touchend',onUp);
addEventListener('wheel',onWheel,{passive:false});
addEventListener('contextmenu',e=>{ if(!e.target.closest('.hud,#mapcard,#sheet,#dolly')) e.preventDefault(); });

/* keyboard: the park must be reachable without a mouse */
addEventListener('keydown',e=>{
  const lightboxOpen=document.getElementById('lightbox').classList.contains('open');
  if(lightboxOpen) return;
  if(e.key==='Escape'){
    const map=document.getElementById('mapcard');
    if(map.classList.contains('open')){
      map.classList.remove('open'); map.setAttribute('aria-hidden','true');
      document.getElementById('btn-map').setAttribute('aria-pressed','false');
      document.getElementById('btn-map').focus();
    }else if(focusId) toOverview(); else closeSheet();
    return;
  }
  if(e.target.closest('button,a,#sheet,#dolly,#mapcard')) return;
  if(e.target.matches('input,textarea')) return;
  const step=.12;
  if(e.key==='ArrowLeft'){ camAnim=null; rig.azT=clamp(rig.azT+step,rig.azMin,rig.azMax); }
  else if(e.key==='ArrowRight'){ camAnim=null; rig.azT=clamp(rig.azT-step,rig.azMin,rig.azMax); }
  else if(e.key==='ArrowUp'){ camAnim=null; rig.distT=clamp(rig.distT-6,rig.distMin,rig.distMax); }
  else if(e.key==='ArrowDown'){ camAnim=null; rig.distT=clamp(rig.distT+6,rig.distMin,rig.distMax); }
  else if(e.key==='1') focusOn('ferris');
  else if(e.key==='2') focusOn('coaster');
  else if(e.key==='3') focusOn('circus');
  else if(e.key==='4') focusOn('garden');
  else if(e.key==='5') focusOn('globe');
  else if(e.key==='6') focusOn('gallery');
  else if(e.key==='l'||e.key==='L') setLights(!lightsOn,true);
});

/* bring a globe pin round to face the visitor */
function spinGlobeTo(i){
  const g=globeZone.userData.globe; if(!g) return;
  const pl=PLACES[i]; if(!pl) return;
  const target=-(pl.lon+180)*Math.PI/180 - Math.PI*.5;
  const cur=g.rotation.y%(Math.PI*2);
  let d=(target-cur)%(Math.PI*2);
  if(d>Math.PI) d-=Math.PI*2; if(d<-Math.PI) d+=Math.PI*2;
  globeZone.userData.spinTo={from:cur,to:cur+d,t:0};
}

/* ==== part10_sheets ==== */
/* ============================================================
   21 · CONTENT SHEETS FOR THE NEW ZONES
   Each zone gets a paper object native to itself: a manuscript
   page for the garden, a postcard for the globe, a works order
   for Futureland, a cabinet card for the arcade, a prize slip
   for the booth, and an exhibition label for the gallery.
   ============================================================ */
let activeWrite=0, activePlace=0, activeBuild=0, activeMachine=0, activePhoto=0;

/* --- Story Garden: a manuscript page --- */
function gardenSheet(){
  const d=WRITING[activeWrite];
  const list=WRITING.map((w,i)=>
    `<button class="ride" data-write="${i}" aria-current="${i===activeWrite}">
       <span class="rn">${esc(w.name)}</span>
       <span class="rk">${esc(w.kind.split(' · ')[0])}</span>
     </button>`).join('');
  openSheet(`
    <div class="pinned">
      <div class="kicker">Story Garden · ${esc(d.where)}</div>
      <h2 class="serif-xl">${esc(d.name)}</h2>
      <div class="metarow"><span>${esc(d.kind)}</span></div>
      <div class="rule"></div>
      <div class="prose"><p>${esc(d.text)}</p></div>
      <div class="rule"></div>
      <div class="kicker">Featured notes and methods</div>
      <div class="rides">${list}</div>
      <div class="actionrow"><button class="paper-action" data-learning-archive>Open the public Learning archive →</button></div>
      <button class="back-inline" data-close>← Back to park</button>
    </div>`);
}

async function learningArchiveSheet(){
  const requestedZone=sheetZone;
  openSheet(`<div class="pinned"><div class="kicker">Story Garden · archive</div><h2 class="serif-xl">Opening the reading room…</h2></div>`);
  await PC.ready;
  if(sheetZone!==requestedZone||focusId!=='garden') return;
  const sections=[['prompts','Prompts'],['methods','Methods'],['notes','Notes'],['readings','Readings']];
  const body=sections.map(([key,label])=>`<section class="archive-section">
    <div class="kicker">${PC.learning[key].length} ${label}</div>
    <div class="archive-grid">${PC.learning[key].map((item,i)=>`
      <button class="archive-card" data-learning-kind="${key}" data-learning-index="${i}">
        <strong>${esc(item.title)}</strong><span>${esc(item.useCase||item.summary||item.source||item.author||'')}</span>
      </button>`).join('')}</div>
  </section>`).join('');
  openSheet(`<div class="pinned"><div class="kicker">Story Garden · learning archive</div><h2 class="serif-xl">Ways of Thinking</h2><div class="prose"><p>Prompts, methods, notes and readings I keep returning to.</p></div><div class="rule"></div>${body}</div>`);
}
function learningDetailSheet(kind,index){
  const item=PC.learning[kind]?.[index]; if(!item) return learningArchiveSheet();
  const meta=item.useCase||item.appliesTo||item.source||item.author||'';
  const content=item.fullContent||item.template||item.content||item.summary||item.takeaways?.map(x=>`- ${x}`).join('\n')||'';
  openSheet(`<div class="pinned"><button class="paper-action secondary" data-learning-archive>← Learning archive</button><div class="kicker">${esc(kind.replace(/s$/,''))}</div><h2 class="serif-xl">${esc(item.title)}</h2><div class="metarow"><span>${esc(meta)}</span>${item.date?`<span>${esc(item.date)}</span>`:''}</div><div class="rule"></div><div class="story-body">${renderMarkdownLite(content)}</div>${item.link?`<div class="actionrow"><a class="paper-action" href="${esc(safeHref(item.link))}" target="_blank" rel="noreferrer">Open source ↗</a></div>`:''}</div>`);
}

/* --- Around the World: a postcard, front and back --- */
function globeSheet(){
  const d=PLACES[activePlace];
  const photos=PHOTOS.map((p,i)=>({p,i})).filter(x=>x.p.cityId===d.id);
  const countries=[...new Set(PLACES.map(p=>p.country))];
  const pins=countries.map(country=>{
    const entries=PLACES.map((p,i)=>({p,i})).filter(x=>x.p.country===country);
    return `<details class="country-group" ${country===d.country?'open':''}><summary><span>${esc(country)}</span><span>${entries.length} ${entries.length===1?'region':'regions'}</span></summary><div class="citygrid">${entries.map(({p,i})=>
      `<button class="city-chip" data-place="${i}" aria-current="${i===activePlace}">${esc(p.name)}</button>`).join('')}</div></details>`;
  }).join('');
  openSheet(`
    <div class="ticket">
      <div class="stub">
        <div>
          <div class="kicker">Around the World · Region ${activePlace+1} of ${PLACES.length}</div>
          <h2 class="serif-xl">${esc(d.name)}</h2>
        </div>
        <div class="yearstamp">${esc(d.country)}</div>
      </div>
      <div class="body">
        <div class="prose"><p>${esc(d.feature?.intro||PC.travel.summary)}</p></div>
        ${d.feature?`<div class="rule"></div><div class="archive-grid">${d.feature.chapters.map(([title,text])=>`<article class="archive-card" style="cursor:default"><strong>${esc(title)}</strong><span>${esc(text)}</span></article>`).join('')}</div><p class="project-proof">${esc(d.feature.takeaway||'')}</p>`:''}
        ${photos.length?`<div class="city-photo">${photos.map(({p,i})=>`<button class="photo-card" data-photo="${i}"><img class="real-thumb" src="${esc(p.thumb)}" loading="lazy" alt="${esc(p.alt)}"><span class="pc-t">${esc(p.title)}</span></button>`).join('')}</div>`:''}
        <div class="rule"></div>
        <div class="kicker">Perspectives by region</div>
        ${pins}
        ${PC.travel.moreLink?`<div class="actionrow"><a class="paper-action" href="${esc(safeHref(PC.travel.moreLink.href))}" target="_blank" rel="noreferrer">${esc(PC.travel.moreLink.label)}</a></div>`:''}
        <button class="back-inline" data-close>← Back to park</button>
      </div>
    </div>`);
}

/* --- Futureland: a works order, stamped and unfinished --- */
function futureSheet(){
  const d=BUILDING_NOW[activeBuild];
  const list=BUILDING_NOW.map((b,i)=>
    `<button class="ride" data-build="${i}" aria-current="${i===activeBuild}">
       <span class="rn">${esc(b.name)}</span>
       <span class="rk">${esc(b.kind)}</span>
     </button>`).join('');
  openSheet(`
    <div class="ticket">
      <div class="stub">
        <div>
          <div class="kicker">Futureland · recent workbench</div>
          <h2 class="serif-xl">${esc(d.name)}</h2>
        </div>
        <div class="yearstamp">${esc(d.kind.split(' · ')[1]||'NOW')}</div>
      </div>
      <div class="body">
        <div class="prose"><p>${esc(d.text)}</p></div>
        <div class="rule"></div>
        <div class="metarow"><span>${esc(d.kind)}</span><span>${esc(d.note)}</span></div>
        <span class="stamp">${esc(d.sign)}</span>
        <div class="rule"></div>
        <div class="kicker">Also on the site</div>
        <div class="rides">${list}</div>
        <button class="back-inline" data-close>← Back to park</button>
      </div>
    </div>`);
}

/* --- Skill Arcade: a cabinet card with a CRT list --- */
function arcadeSheet(){
  const d=MACHINES[activeMachine];
  const tabs=MACHINES.map((m,i)=>
    `<button class="ride" data-machine="${i}" aria-current="${i===activeMachine}">
       <span class="rn">${esc(m.name)}</span>
       <span class="rk">${esc(m.kind.replace('cabinet ',''))}</span>
     </button>`).join('');
  const items=d.items.map(t=>`<li>${esc(t)}</li>`).join('');
  openSheet(`
    <div class="program">
      <div class="kicker">Skill Arcade · ${esc(d.kind)}</div>
      <h2 class="serif-xl">${esc(d.name)}</h2>
      <div class="crt">
        <div class="crt-label">${esc(d.screen)}</div>
        <ul class="crt-list">${items}</ul>
      </div>
      <p class="hand">${esc(d.note)}</p>
      <div class="rule"></div>
      <div class="kicker">Other cabinets</div>
      <div class="rides">${tabs}</div>
      <button class="back-inline" data-close>← Back to park</button>
    </div>`);
}

/* --- Prize Corner: the whole shelf at once, as a prize list --- */
function prizeSheet(){
  const groups=PRIZES.map(p=>`<div class="prize"><div class="kicker">${esc(p.c)}</div><div class="pt">${esc(p.t)}</div><div class="pd">${esc(p.d)}</div></div>`).join('');
  openSheet(`
    <div class="pinned">
      <div class="kicker">Prize Corner · selected evidence</div>
      <h2 class="serif-xl">Awards & Outcomes</h2>
      <div class="prose"><p>Only recorded awards and measurable outcomes are kept on this shelf.</p></div>
      <div class="rule"></div>
      ${groups}
      <button class="back-inline" data-close>← Back to park</button>
    </div>`);
}

/* --- The Gallopers: what a carousel is for --- */
let activeInterest=0;
function carouselSheet(){
  const stories=PC.interestStories||PC.interests||[];
  if(!stories.length) return;
  const d=stories[activeInterest]||stories[0];
  const list=stories.map((x,i)=>`<button class="ride" data-interest="${i}" aria-current="${i===activeInterest}"><span class="rn">${esc(x.icon||'•')} ${esc(x.title)}</span><span class="rk">${esc(x.hook||'')}</span></button>`).join('');
  openSheet(`
    <div class="pinned">
      <div class="kicker">The Gallopers · story ${activeInterest+1} of ${stories.length}</div>
      <h2 class="serif-xl">${esc(d.icon||'')} ${esc(d.title)}</h2>
      <p class="project-proof">${esc(d.hook||'')}</p>
      <div class="rule"></div>
      <div class="prose"><p>${esc(d.story||'')}</p></div>
      <div class="metarow"><span>${esc(d.detail||'')}</span></div>
      <div class="rule"></div><div class="ridelist">${list}</div>
      <button class="back-inline" data-close>← Back to park</button>
    </div>`);
}

/* --- The Gallery: a museum label, then the prints themselves --- */
function gallerySheet(){
  const grid=PHOTOS.map((p,i)=>`
    <button class="photo-card" data-photo="${i}" aria-current="${i===activePhoto}">
      <img class="real-thumb" src="${esc(p.thumb)}" loading="lazy" decoding="async" alt="${esc(p.alt)}">
      <span class="pc-t">${esc(p.title)}</span>
      <span class="pc-y">${esc(p.location||'Unlocated study')}</span>
    </button>`).join('');
  openSheet(`
    <div class="label-plate">
      <div class="kicker">The Gallery · ${PHOTOS.length} real photographs</div>
      <h2 class="serif-xl">The Darkroom</h2>
      <div class="prose"><p>Image colour is preserved. Identity-bearing photographs are removed, captions and locations are intentionally broad, and no image is tied to a personal itinerary.</p></div>
      <div class="rule"></div>
      <div class="photogrid">${grid}</div>
      <button class="sheet-close" data-close>← Back to Park</button>
    </div>`);
}

/* --- The Gallery lightbox: real photographs, viewed close up --- */
const lbEl=document.getElementById('lightbox');
const lbImage=document.getElementById('lb-image');
let lbIndex=0;
let lastFocusedBeforeLightbox=null;

function lbShow(i){
  lbIndex=((i%PHOTOS.length)+PHOTOS.length)%PHOTOS.length;
  activePhoto=lbIndex;
  const d=PHOTOS[lbIndex];
  lbImage.src=d.src; lbImage.alt=d.alt;
  document.getElementById('lb-count').textContent=`Plate ${lbIndex+1} of ${PHOTOS.length}`;
  document.getElementById('lb-title').textContent=d.title;
  document.getElementById('lb-year').textContent=d.location||'Location not recorded';
  document.getElementById('lb-text').textContent=d.caption;
  const cap=lbEl.querySelector('.lb-cap');
  cap.querySelector('[data-city-jump]')?.remove();
  if(d.cityId){
    const cityIndex=PLACES.findIndex(p=>p.id===d.cityId);
    if(cityIndex>=0) cap.insertAdjacentHTML('beforeend',`<button class="paper-action" data-city-jump="${cityIndex}">Find ${esc(d.location)} on the globe →</button>`);
  }
  // keep the sheet's highlight in step with the sequence
  objEl.querySelectorAll('[data-photo]').forEach(b=>{
    b.setAttribute('aria-current',String(+b.dataset.photo===lbIndex));
  });
}
function openLightbox(i){
  lastFocusedBeforeLightbox=document.activeElement;
  lbShow(i);
  lbEl.classList.add('open'); lbEl.setAttribute('aria-hidden','false');
  lbEl.querySelector('.lb-x').focus({preventScroll:true});
}
function closeLightbox(){
  lbEl.classList.remove('open'); lbEl.setAttribute('aria-hidden','true');
  lastFocusedBeforeLightbox?.focus?.({preventScroll:true});
}
lbEl.querySelectorAll('[data-lb-close]').forEach(b=>b.onclick=closeLightbox);
lbEl.querySelector('[data-lb-prev]').onclick=()=>lbShow(lbIndex-1);
lbEl.querySelector('[data-lb-next]').onclick=()=>lbShow(lbIndex+1);
lbEl.addEventListener('click',e=>{
  const b=e.target.closest('[data-city-jump]'); if(!b) return;
  activePlace=+b.dataset.cityJump; closeLightbox(); focusOn('globe'); spinGlobeTo(activePlace);
  requestAnimationFrame(()=>objEl.querySelector('[data-close]')?.focus({preventScroll:true}));
});
document.addEventListener('keydown',e=>{
  if(!lbEl.classList.contains('open')) return;
  if(e.key==='ArrowRight') lbShow(lbIndex+1);
  else if(e.key==='ArrowLeft') lbShow(lbIndex-1);
  else if(e.key==='Escape') closeLightbox();
  else if(e.key==='Tab'){
    const focusable=[...lbEl.querySelectorAll('button:not([disabled]),a[href]')];
    if(!focusable.length) return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
});

/* ==== part7_content ==== */
/* ============================================================
   19 · CONTENT SHEETS — information as objects native to the park
   ============================================================ */
const sheetEl=document.getElementById('sheet');
const objEl=document.getElementById('sheet-obj');
let activeCabin=0, activeRide=0, activeTent=0;

function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function contentPath(path){
  if(!path) return '';
  return path.replace(/^\.\//,'');
}
function safeHref(path){
  const href=contentPath(path);
  return /^(?:https?:|#)/i.test(href)?href:'#';
}
function projectActions(project){
  const labels={demo:'Open project',repo:'View repository',article:'Read more',video:'Watch video'};
  return Object.entries(project.links||{}).map(([kind,href])=>
    `<a class="paper-action" href="${esc(safeHref(href))}" ${/^https?:/i.test(href)?'target="_blank" rel="noreferrer"':''}>${esc(labels[kind]||'Open link')} ↗</a>`
  ).join('');
}
function renderMarkdownLite(source){
  const lines=String(source||'').replace(/\r/g,'').split('\n');
  const inline=value=>{
    let out=esc(value);
    out=out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    out=out.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
    return out;
  };
  let html='',list='';
  const flush=()=>{ if(list){ html+=`</${list}>`; list=''; } };
  for(const raw of lines){
    const line=raw.trim();
    if(!line){ flush(); continue; }
    const heading=line.match(/^(#{1,3})\s+(.+)/);
    if(heading){ flush(); const level=Math.min(4,heading[1].length+2); html+=`<h${level}>${inline(heading[2])}</h${level}>`; continue; }
    const bullet=line.match(/^[-*]\s+(.+)/), ordered=line.match(/^\d+[.)]\s+(.+)/);
    if(bullet||ordered){ const next=ordered?'ol':'ul'; if(list!==next){ flush(); list=next; html+=`<${list}>`; } html+=`<li>${inline((bullet||ordered)[1])}</li>`; continue; }
    flush(); html+=`<p>${inline(line)}</p>`;
  }
  flush(); return html;
}

/* --- the way out ---------------------------------------------------------
   One exit for every sheet, in one place, so leaving a ride is a single
   learned gesture rather than a different button per panel. The plate carries
   the ride's own parting line: same mechanism everywhere, local voice. */
const EXIT_LINES={
  gate:      ['Entrance Gate',     'mind the turnstile'],
  ferris:    ['Ferris Wheel of Time','watch your step down'],
  coaster:   ['Project Coaster',   'please keep hands inside'],
  circus:    ['Idea Circus',       'the tent stays up all night'],
  carousel:  ['The Gallopers',     'wait for the horses to stop'],
  garden:    ['Story Garden',      'leave the gate as you found it'],
  globe:     ['Around the World',  'post it on your way out'],
  futureland:['Futureland',        'mind the scaffolding'],
  arcade:    ['Skill Arcade',      'your credits are saved'],
  prizes:    ['Prize Corner',      'nothing to redeem, take a look'],
  gallery:   ['The Gallery',       'lights stay on for the next visitor'],
  dolly:     ['Ask Dolly',         'she will be here'],
  graveyard: ['Quiet Corner',      'mind the headstones']
};
function exitBar(id){
  const e=EXIT_LINES[id]||['The Park','back the way you came'];
  return `<div class="exitbar">
    <button class="way" data-close><span class="chev">‹</span>Exit to park</button>
    <span class="plate"><span class="zone">${esc(e[0])}</span><span class="note">${esc(e[1])}</span></span>
  </div>`;
}
/* The instrument cluster and the sheet both live on the right edge. Measure the
   cluster's real height so the sheet can start clear of it — the switch rows
   wrap at narrow widths, so a hard-coded offset drifts. */
const hudRightEl=document.getElementById('hud-right');
function syncHudHeight(){
  if(!hudRightEl) return;
  /* bottom edge, not height — the cluster is inset from the top, so the sheet
     has to clear where it actually ends. */
  const b=hudRightEl.getBoundingClientRect().bottom;
  document.documentElement.style.setProperty('--hud-h',Math.round(b)+'px');
}
syncHudHeight();
addEventListener('resize',syncHudHeight);

/* The park plan occupies the same column as the sheet; opening a sheet retires
   it rather than stacking two cards on top of each other. */
function closeMapCard(){
  const mc=document.getElementById('mapcard'), mb=document.getElementById('btn-map');
  if(mc&&mc.classList.contains('open')){
    mc.classList.remove('open');
    mc.setAttribute('aria-hidden','true');
    if(mb) mb.setAttribute('aria-pressed','false');
  }
}

/* the sheet currently on screen, so the exit knows which ride it belongs to */
let sheetZone=null;
function openSheet(html){
  const wasOpen=sheetEl.classList.contains('open');
  objEl.innerHTML=html;
  /* Fit the exit inside the sheet's own paper, above its first line. Doing it
     here rather than in each panel is what makes the gesture identical
     everywhere — one exit, one position, thirteen panels. */
  const paper=objEl.firstElementChild;
  if(paper){
    /* retire any per-panel close button; the exit bar replaces them all */
    paper.querySelectorAll('.sheet-close,.back-inline').forEach(b=>b.remove());
    paper.insertAdjacentHTML('afterbegin',exitBar(sheetZone));
  }
  syncHudHeight();
  closeMapCard();
  sheetEl.classList.add('open');
  sheetEl.setAttribute('aria-hidden','false');
  objEl.scrollTop=0;
  bindSheet();
  if(!wasOpen) requestAnimationFrame(()=>paper?.querySelector('[data-close]')?.focus({preventScroll:true}));
}
function closeSheet(){ sheetEl.classList.remove('open'); sheetEl.setAttribute('aria-hidden','true'); }
function bindSheet(){
  objEl.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{ toOverview(); });
  objEl.querySelectorAll('[data-cabin]').forEach(b=>b.onclick=()=>{
    activeCabin=+b.dataset.cabin; ferrisSheet(); spinCabinToFront(activeCabin);
  });
  objEl.querySelectorAll('[data-ride]').forEach(b=>b.onclick=()=>{
    activeRide=+b.dataset.ride; coasterSheet();
  });
  objEl.querySelectorAll('[data-tent]').forEach(b=>b.onclick=()=>{
    activeTent=+b.dataset.tent; circusSheet(); nudgeTent(activeTent);
  });
  objEl.querySelectorAll('[data-write]').forEach(b=>b.onclick=()=>{
    activeWrite=+b.dataset.write; gardenSheet();
  });
  objEl.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>{
    activePlace=+b.dataset.place; globeSheet(); spinGlobeTo(activePlace);
  });
  objEl.querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>{
    activeBuild=+b.dataset.build; futureSheet();
  });
  objEl.querySelectorAll('[data-machine]').forEach(b=>b.onclick=()=>{
    activeMachine=+b.dataset.machine; arcadeSheet();
  });
  objEl.querySelectorAll('[data-interest]').forEach(b=>b.onclick=()=>{activeInterest=+b.dataset.interest;carouselSheet();});
  objEl.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>{
    activePhoto=+b.dataset.photo; openLightbox(activePhoto);
  });
  objEl.querySelectorAll('[data-project-archive]').forEach(b=>b.onclick=projectArchiveSheet);
  objEl.querySelectorAll('[data-project]').forEach(b=>b.onclick=()=>projectDetailSheet(b.dataset.project));
  objEl.querySelectorAll('[data-ai-archive]').forEach(b=>b.onclick=aiArchiveSheet);
  objEl.querySelectorAll('[data-ai-kind]').forEach(b=>b.onclick=()=>aiDetailSheet(b.dataset.aiKind,+b.dataset.aiIndex));
  objEl.querySelectorAll('[data-learning-archive]').forEach(b=>b.onclick=learningArchiveSheet);
  objEl.querySelectorAll('[data-learning-kind]').forEach(b=>b.onclick=()=>learningDetailSheet(b.dataset.learningKind,+b.dataset.learningIndex));
  objEl.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>focusOn(b.dataset.jump));
}

/* --- ferris wheel: a vintage ticket, one per chapter --- */
function ferrisSheet(){
  const d=CAB_DATA[activeCabin];
  const chips=CAB_DATA.map((c,i)=>
    `<button class="ride" data-cabin="${i}" aria-current="${i===activeCabin}">
       <span class="rn">${esc(c.year)}</span>
       <span class="rk">${esc(c.kind)}</span>
     </button>`).join('');
  openSheet(`
    <div class="ticket">
      <div class="stub">
        <div>
          <div class="kicker">Ferris Wheel of Time · Cabin ${activeCabin+1} of ${CAB_DATA.length}</div>
          <h2 class="serif-xl">${esc(d.title)}</h2>
        </div>
        <div class="yearstamp">${esc(d.year)}</div>
      </div>
      <div class="body">
        <div class="metarow"><span>${esc(d.role)}</span><span>${esc(d.kind)}</span></div>
        <div class="prose"><p>${esc(d.text)}</p></div>
        <div class="rule"></div>
        <p class="project-proof">${esc(d.note)}</p>
        <div class="rule"></div>
        <div class="kicker" style="margin-bottom:8px">Other cabins</div>
        <div class="ridelist">${chips}</div>
        <div class="actionrow">
          <button class="paper-action" data-jump="coaster">See selected work →</button>
          <button class="paper-action secondary" data-jump="garden">See public methods →</button>
        </div>
        <button class="sheet-close" data-close>← Back to Park</button>
      </div>
    </div>`);
}

/* --- coaster: a folded programme with the ride's journey --- */
function coasterSheet(){
  const r=RIDES[activeRide]||RIDES[0];
  const list=RIDES.map((x,i)=>
    `<button class="ride" data-ride="${i}" aria-current="${i===activeRide}">
       <span class="rn">${esc(x.title)}</span><span class="rk">${esc(x.time||'')}</span>
     </button>`).join('');
  const cover=r.coverImage?`<img class="project-cover" src="${esc(contentPath(r.coverImage))}" loading="lazy" decoding="async" alt="${esc(`${r.title} project cover`)}">`:'';
  openSheet(`
    <div class="program">
      <div class="head">
        <div class="kicker">Project Coaster · Project ${activeRide+1} of ${RIDES.length}</div>
        <h2 class="serif-xl">${esc(r.title)}</h2>
        <div class="metarow" style="margin-top:8px"><span>${esc(r.role)}</span><span>${esc(r.time)}</span></div>
      </div>
      ${cover}
      <div class="prose"><p>${esc(r.oneLiner)}</p></div>
      <div class="rule"></div>
      <div class="kicker">What it explores</div><p class="project-proof">${esc(r.outcome)}</p>
      <div class="metarow">${(r.tags||[]).map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>
      <div class="actionrow">${projectActions(r)}</div>
      <div class="rule"></div>
      <div class="kicker" style="margin-bottom:8px">Other projects</div>
      <div class="ridelist">${list}</div>
      <div class="actionrow"><button class="paper-action" data-project-archive>Open all projects →</button></div>
      <button class="sheet-close" data-close>← Back to Park</button>
    </div>`);
}

function projectCategory(project){
  const tags=(project.tags||[]).join(' ').toLowerCase();
  if(tags.includes('research')||tags.includes('analysis')) return 'Research';
  if(tags.includes('product design')||tags.includes('product thinking')||tags.includes('user research')) return 'Product';
  if(tags.includes('ai/ml')||tags.includes('automation')) return 'AI';
  return 'Build';
}
async function projectArchiveSheet(){
  const requestedZone=sheetZone;
  openSheet(`<div class="program"><div class="kicker">Project Coaster · archive</div><h2 class="serif-xl">Loading every ride…</h2></div>`);
  await PC.ready;
  if(sheetZone!==requestedZone||focusId!=='coaster') return;
  const projects=PC.projects.items;
  const groups=['AI','Product','Research','Build'].map(label=>{
    const items=projects.filter(p=>projectCategory(p)===label);
    return `<section class="archive-section"><div class="kicker">${label} · ${items.length}</div><div class="archive-grid">${items.map(p=>`
      <button class="archive-card" data-project="${esc(p.slug)}"><strong>${esc(p.title)}</strong><span>${esc(p.oneLiner)}</span><small>${esc(p.role)} · ${esc(p.time)}</small></button>`).join('')}</div></section>`;
  }).join('');
  openSheet(`<div class="program"><div class="kicker">Project Coaster · personal selection</div><h2 class="serif-xl">${projects.length} Projects</h2><div class="prose"><p>Five things I have made, each with its role, process and result.</p></div><div class="rule"></div>${groups}</div>`);
}
function projectDetailSheet(slug){
  const p=PC.projects.items.find(item=>item.slug===slug); if(!p) return projectArchiveSheet();
  openSheet(`<div class="program"><button class="paper-action secondary" data-project-archive>← All studies</button><div class="kicker">Personal project · ${esc(projectCategory(p))}</div><h2 class="serif-xl">${esc(p.title)}</h2><div class="metarow"><span>${esc(p.role)}</span><span>${esc(p.time)}</span></div>${p.coverImage?`<img class="project-cover" src="${esc(contentPath(p.coverImage))}" loading="lazy" alt="${esc(`${p.title} project cover`)}">`:''}<div class="prose"><p>${esc(p.oneLiner)}</p></div><div class="rule"></div><div class="kicker">What it explores</div><p class="project-proof">${esc(p.outcome)}</p><div class="metarow">${(p.tags||[]).map(tag=>`<span>${esc(tag)}</span>`).join('')}</div><div class="actionrow">${projectActions(p)}</div></div>`);
}

/* --- idea circus: a pinned note, handwriting and all --- */
function circusSheet(){
  const t=TENTS[activeTent];
  const grid=TENTS.map((x,i)=>
    `<button class="tent" data-tent="${i}" aria-current="${i===activeTent}">
       <span class="tn">${esc(x.name)}</span><span class="tk">${esc(x.kind)}</span>
     </button>`).join('');
  openSheet(`
    <div class="pinned">
      <div class="kicker">Idea Circus · No business case required</div>
      <h2 class="serif-xl">${esc(t.name)}</h2>
      <div class="metarow" style="margin:8px 0 14px"><span>${esc(t.kind)}</span></div>
      <img class="project-cover" src="${esc(t.image)}" loading="lazy" decoding="async" alt="${esc(t.name)}">
      <div class="prose"><p>${esc(t.text)}</p></div>
      <div class="rule"></div>
      <div class="kicker">Featured visual experiments</div>
      <div class="tentgrid">${grid}</div>
      <div class="actionrow"><button class="paper-action" data-ai-archive>Open the public AI Lab selection →</button></div>
      <button class="sheet-close" data-close>← Back to Park</button>
    </div>`);
}

async function aiArchiveSheet(){
  const requestedZone=sheetZone;
  openSheet(`<div class="pinned"><div class="kicker">Idea Circus · archive</div><h2 class="serif-xl">Raising every tent…</h2></div>`);
  await PC.ready;
  if(sheetZone!==requestedZone||focusId!=='circus') return;
  const gallery=`<section class="archive-section"><div class="kicker">Visual experiments · ${PC.aiLab.gallery.length}</div><div class="archive-grid">${PC.aiLab.gallery.map((item,i)=>`<button class="archive-card" data-ai-kind="gallery" data-ai-index="${i}"><img class="real-thumb" src="${esc(contentPath(item.thumbnail||item.image))}" loading="lazy" alt="${esc(item.title)}"><strong>${esc(item.title)}</strong><span>${esc(item.goal)}</span></button>`).join('')}</div></section>`;
  const ideas=`<section class="archive-section"><div class="kicker">AI product ideas · ${PC.aiLab.ideas.length}</div><div class="archive-grid">${PC.aiLab.ideas.map((item,i)=>`<button class="archive-card" data-ai-kind="ideas" data-ai-index="${i}"><strong>${esc(item.title)}</strong><span>${esc(item.content)}</span></button>`).join('')}</div></section>`;
  openSheet(`<div class="pinned"><div class="kicker">Idea Circus · personal experiments</div><h2 class="serif-xl">AI Lab</h2><div class="prose"><p>Visual experiments and product ideas made while learning to build with AI.</p></div><div class="rule"></div>${gallery}${ideas}</div>`);
}
function aiDetailSheet(kind,index){
  const item=PC.aiLab[kind]?.[index]; if(!item) return aiArchiveSheet();
  const isImage=kind==='gallery';
  openSheet(`<div class="pinned"><button class="paper-action secondary" data-ai-archive>← AI Lab archive</button><div class="kicker">${isImage?'Visual experiment':'Product idea'} · ${esc(item.date||'')}</div><h2 class="serif-xl">${esc(item.title)}</h2>${isImage?`<img class="project-cover" src="${esc(contentPath(item.image))}" loading="lazy" alt="${esc(item.title)}"><div class="metarow"><span>${esc(item.model)}</span><span>${esc(item.goal)}</span></div><div class="rule"></div><div class="kicker">Original prompt</div><div class="prose"><p>${esc(item.prompt)}</p></div>`:`<div class="prose"><p>${esc(item.content)}</p></div><div class="metarow">${(item.tags||[]).map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>`}</div>`);
}

/* --- gate: the park's own museum label --- */
function gateSheet(){
  const p=PC.profile;
  openSheet(`
    <div class="label-plate">
      <div class="kicker">Entrance · ${esc(p.locations.join(' · '))}</div>
      <h2 class="serif-xl">${esc(p.name)}</h2>
      <div class="metarow"><span>${esc(p.role)}</span><span>Personal edition</span></div>
      <div class="rule"></div>
      <div class="prose">
        <p><em>${esc(p.intro)}</em></p>
        <p>${esc(p.story)}</p>
        <p>The wheel holds my experience, the coaster holds selected projects, and the garden keeps the methods behind both. Dolly can turn them into a short route.</p>
      </div>
      <div class="rule"></div>
      <div class="actionrow">
        <button class="paper-action" data-jump="coaster">Explore selected work →</button>
        <button class="paper-action secondary" data-jump="garden">Explore methods →</button>
        <button class="paper-action secondary" data-jump="globe">Explore the abstract globe →</button>
      </div>
      <button class="sheet-close" data-close>← Back to Park</button>
    </div>`);
}

/* --- graveyard: the easter egg --- */
function graveSheet(){
  const zh=window.PARK_LANG==='zh';
  const kept=GRAVES.filter(g=>g.a);
  const items=kept.map(g=>`<li>${esc(g.a)}<br/>${esc(g.b)}<small>${esc(g.d)}</small></li>`).join('');
  const body=kept.length
    ? `<div class="prose" style="margin-top:10px"><p>${zh?'一小份没能跑通的事，留着，因为教训比光鲜更重要。':'A small record of things that did not work, kept because the lesson matters more than the polish.'}</p></div><ul class="epitaphs">${items}</ul>`
    : `<div class="prose" style="margin-top:10px"><p>${zh?'一个安静的角落，留给还在路上的想法。':'A quiet corner, left for ideas still on the way.'}</p></div>`;
  openSheet(`
    <div class="label-plate">
      <div class="kicker">${zh?'不在园区地图上':'Not on the park plan'}</div>
      <h2 class="serif-xl">${zh?'安静的角落':'A Quiet Corner'}</h2>
      ${body}
      <button class="sheet-close" data-close>${zh?'← 回到园区':'← Back to Park'}</button>
    </div>`);
}

function openSheetFor(id){
  sheetZone=id;
  if(id==='ferris') ferrisSheet();
  else if(id==='coaster') coasterSheet();
  else if(id==='circus') circusSheet();
  else if(id==='gate') gateSheet();
  else if(id==='graveyard') graveSheet();
  else if(id==='garden') gardenSheet();
  else if(id==='globe') globeSheet();
  else if(id==='futureland') futureSheet();
  else if(id==='arcade') arcadeSheet();
  else if(id==='prizes') prizeSheet();
  else if(id==='gallery') gallerySheet();
  else if(id==='carousel') carouselSheet();
  else closeSheet();
}

/* ============================================================
   20 · DOLLY'S CONVERSATION — architected for a real endpoint later
   ============================================================ */
const dollyEl=document.getElementById('dolly');
const logEl=document.getElementById('dolly-log');
const asksEl=document.getElementById('dolly-asks');

/*  Replace this resolver with a fetch() to an LLM endpoint and everything
    above keeps working: same shape in, same shape out.
    async function ask(q){ const r = await fetch('/api/dolly',{...}); return r.json(); }  */
const DOLLY_SCRIPT=window.PARK_DOLLY||{
  root:[
    {q:'I only have 3 minutes.',a:'Take the Ferris Wheel for six broad capability chapters, then the Project Coaster for five generalized project types. Nothing in this route identifies a person, employer, school, or client.',go:'ferris',
     next:['Show me the selected work.','Show me the public methods.','What is the globe showing?']},
    {q:'Show me the selected work.',a:'The Project Coaster contains five anonymous concept studies about decision support, structured workflows, research synthesis, interactive systems, and shared interaction. They communicate methods without reproducing a real project history.',go:'coaster',
     next:['Show me the public methods.','What is the globe showing?','Show me the AI Lab.']},
    {q:'Show me the public methods.',a:'The Story Garden contains a small selection of prompts, methods, notes, and readings. It explains how the work approaches validation, reflection, disagreement, and learning by doing.',go:'garden',
     next:['Show me the selected work.','Show me the AI Lab.','What is intentionally omitted?']},
    {q:'What is the globe showing?',a:'The mechanical globe uses broad regional points and illustrative connections. It preserves the interaction and visual idea without revealing a personal travel history, exact city list, or route.',go:'globe',
     next:['Show me the photographs.','Show me the selected work.','What is intentionally omitted?']},
    {q:'Show me the AI Lab.',a:'The Idea Circus contains a small public selection of generative visual studies and AI interaction ideas. Timestamps, accounts, and personal working history are omitted.',go:'circus',
     next:['Show me the public methods.','Show me the photographs.','What is intentionally omitted?']},
    {q:'Show me the photographs.',a:'The Gallery keeps fourteen images with neutral titles and broad regional labels. The public edition removes identity-bearing images and does not include a photographer identity, exact coordinates, or a personal itinerary.',go:'gallery',
     next:['What is the globe showing?','Show me the selected work.','What is intentionally omitted?']},
    {q:'What is intentionally omitted?',a:'Names, portraits, employers, schools, contact details, résumés, precise dates, exact metrics, account links, city-level travel history, and session metadata are all absent from this edition.',go:'gate',
     next:['Show me the selected work.','Show me the public methods.','I only have 3 minutes.']},
    {q:'Show me the quiet lessons.',a:'The Quiet Corner keeps three broad lessons about validation, premature precision, and mistaking fluency for insight. Blank stones remain blank rather than inventing evidence.',go:'graveyard',
     next:['Show me the public methods.','I only have 3 minutes.']}
  ]
};
let dollyOpen=false;
function dollySay(text,mine){
  const p=document.createElement('p');
  p.className='msg '+(mine?'mine':'her');
  p.textContent=text;
  logEl.appendChild(p);
  logEl.scrollTop=logEl.scrollHeight;
}
function dollyAsks(list){
  asksEl.innerHTML='';
  list.forEach(q=>{
    const b=document.createElement('button');
    b.className='ask'; b.textContent=q;
    b.onclick=()=>dollyAnswer(q);
    asksEl.appendChild(b);
  });
}
function dollyAnswer(q){
  const item=DOLLY_SCRIPT.root.find(x=>x.q===q);
  dollySay(q,true);
  asksEl.innerHTML='';
  setTimeout(()=>{
    if(!item){ dollySay(window.PARK_LANG==='zh'?'这个问题我还没学会回答。换一条路线逛逛吧。':'I do not know that one yet. Try another route through the park.'); dollyAsks(DOLLY_SCRIPT.root.slice(0,4).map(x=>x.q)); return; }
    dollySay(item.a);
    dollyAsks(item.next||DOLLY_SCRIPT.root.slice(0,4).map(x=>x.q));
    if(item.go){
      const goBtn=document.createElement('button');
      goBtn.className='ask';
      goBtn.style.borderColor='var(--red)'; goBtn.style.color='var(--red)';
      goBtn.textContent='→ Take me there';
      goBtn.onclick=()=>{ focusOn(item.go); };
      asksEl.prepend(goBtn);
    }
  }, REDUCED?60:520);
}
function openDolly(){
  dollyOpen=true;
  dollyEl.classList.add('open'); dollyEl.setAttribute('aria-hidden','false');
  const late=stateName==='night';
  dollyEl.classList.toggle('sleepy',late);
  if(!logEl.childElementCount){
    dollySay(late
      ? (window.PARK_LANG==='zh'?'哦——你好。天色很晚，我刚刚差点睡着了。你还是可以问。':'Oh — hello. It is late and I was mostly asleep. Ask anyway, I will manage.')
      : (window.PARK_LANG==='zh'?'欢迎来到洛颖的主题乐园。我是 Dolly，可以带你走一条短路线。':'Welcome to Luoying’s Theme Park. I am Dolly, your guide.'));
    dollyAsks(DOLLY_SCRIPT.root.slice(0,4).map(x=>x.q));
  }
}
function closeDolly(){
  dollyOpen=false;
  dollyEl.classList.remove('open'); dollyEl.setAttribute('aria-hidden','true');
}

/* ============================================================
   21 · DISCOVERY & TOASTS
   ============================================================ */
const found=new Set();
let toastTimer=null;
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),3400);
}
function discover(key,msg){
  if(found.has(key)) return;
  found.add(key); toast(msg);
}

/* ============================================================
   22 · ATTRACTION REACTIONS
   ============================================================ */
let cabinTargetAngle=null;
function spinCabinToFront(chapterIndex){
  // rotate the wheel so the chosen cabin sits low and forward
  const cabs=ferris.userData.cabs.filter(c=>c.chapter===chapterIndex);
  if(!cabs.length) return;
  const c=cabs[0];
  cabinTargetAngle=-c.angle - Math.PI*0.5 + 0.35;
}
function nudgeTent(i){
  const t=circus.userData.tents[i];
  if(t) t.userData.nudge=1;
}

/* ============================================================
   23 · INTRO SEQUENCE
   ============================================================ */
let introDone=false, gateOpen=0, introT=0, introPlaying=false;
// start tucked in close to the gate, facing up the path
rig.az=rig.azT=.02; rig.pol=rig.polT=1.0; rig.dist=rig.distT=34;
rig.tgt.set(0,7,26); rig.tgtT.copy(rig.tgt);
applyRig();

function startIntro(){
  document.getElementById('intro').classList.add('gone');
  document.body.classList.remove('intro-open');
  document.getElementById('skip').classList.remove('show');
  document.getElementById('titlecard').classList.add('play');
  introPlaying=true; introT=0;
  setRigLimits({azMin:-Math.PI,azMax:Math.PI,polMin:.42,polMax:1.44,distMin:20,distMax:275});
  // gate swings, camera rises and pulls back into the overview
  setTimeout(()=>{ flyTo(ARRIVAL, REDUCED?400:4200, ()=>{
    introDone=true; introPlaying=false;
    setRigLimits({azMin:-Math.PI,azMax:Math.PI,polMin:0.42,polMax:1.44,distMin:26,distMax:275});
    const hint=document.getElementById('hint');
    hint.classList.add('show');
    setTimeout(()=>hint.classList.remove('show'),6500);
  }); }, REDUCED?100:900);
}
function skipIntro(){
  document.getElementById('intro').classList.add('gone');
  document.body.classList.remove('intro-open');
  document.getElementById('titlecard').classList.remove('play');
  document.getElementById('skip').classList.remove('show');
  gateOpen=1; introDone=true; introPlaying=false;
  camAnim=null;
  rig.azT=ARRIVAL.az; rig.polT=ARRIVAL.pol; rig.distT=ARRIVAL.dist; rig.tgtT.copy(ARRIVAL.tgt);
  rig.az=rig.azT; rig.pol=rig.polT; rig.dist=rig.distT; rig.tgt.copy(rig.tgtT);
  setRigLimits({azMin:-Math.PI,azMax:Math.PI,polMin:0.42,polMax:1.44,distMin:26,distMax:275});
}
document.getElementById('enter').onclick=startIntro;
document.getElementById('skip').onclick=skipIntro;
setTimeout(()=>{ if(!introDone && !introPlaying) document.getElementById('skip').classList.add('show'); },1400);

/* ============================================================
   24 · HUD WIRING
   ============================================================ */
document.querySelectorAll('.sw[data-state]').forEach(b=>{
  b.onclick=()=>{
    setState(b.dataset.state);
    if(b.dataset.state==='night'){
      discover('night','Night. Try the lights.');
      if(dollyOpen) dollyEl.classList.add('sleepy');
    } else dollyEl.classList.remove('sleepy');
  };
});
document.getElementById('btn-lights').onclick=()=>{
  const next=!lightsOn;
  setLights(next,next);
  if(next) discover('cascade','Gate · paths · buildings · circus · coaster · wheel');
  else toast('Lights out. Only stars and a few safety lamps.');
};
document.getElementById('btn-map').onclick=e=>{
  const card=document.getElementById('mapcard');
  const open=card.classList.toggle('open');
  card.setAttribute('aria-hidden',String(!open));
  e.currentTarget.setAttribute('aria-pressed',String(open));
  /* plan and sheet share the right column — showing one retires the other */
  if(open){
    closeSheet();
    requestAnimationFrame(()=>card.querySelector('.map-links button')?.focus());
  }
};
document.getElementById('btn-tools').onclick=e=>{
  const open=document.body.classList.toggle('tools-open');
  e.currentTarget.setAttribute('aria-expanded',String(open));
  requestAnimationFrame(syncHudHeight);
};
document.querySelectorAll('#mapcard .plan-hit').forEach(g=>{
  g.onclick=()=>{
    document.getElementById('mapcard').classList.remove('open');
    document.getElementById('btn-map').setAttribute('aria-pressed','false');
    focusOn(g.dataset.goto);
  };
});
document.getElementById('back').onclick=toOverview;
document.getElementById('sheet-scrim').onclick=toOverview;
document.getElementById('btn-help').onclick=()=>{
  focusOn('gate');
};

/* --- ambience: synthesised, so there are no audio files to load --- */
let audioCtx=null, ambience=null, soundOn=false;
function buildAmbience(){
  audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  const master=audioCtx.createGain(); master.gain.value=0; master.connect(audioCtx.destination);
  // soft wind: filtered noise
  const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*3,audioCtx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*.4;
  const noise=audioCtx.createBufferSource(); noise.buffer=buf; noise.loop=true;
  const lp=audioCtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420; lp.Q.value=.6;
  const ng=audioCtx.createGain(); ng.gain.value=.5;
  noise.connect(lp).connect(ng).connect(master); noise.start();
  // distant fairground organ: two detuned sines drifting
  const o1=audioCtx.createOscillator(); o1.type='sine'; o1.frequency.value=196;
  const o2=audioCtx.createOscillator(); o2.type='sine'; o2.frequency.value=294.5;
  const og=audioCtx.createGain(); og.gain.value=.028;
  const olp=audioCtx.createBiquadFilter(); olp.type='lowpass'; olp.frequency.value=900;
  o1.connect(og); o2.connect(og); og.connect(olp).connect(master);
  o1.start(); o2.start();
  const lfo=audioCtx.createOscillator(); lfo.frequency.value=.07;
  const lg=audioCtx.createGain(); lg.gain.value=3.5;
  lfo.connect(lg); lg.connect(o1.frequency); lfo.start();
  ambience={master,ng,og};
}
document.getElementById('btn-sound').onclick=e=>{
  soundOn=!soundOn;
  e.currentTarget.setAttribute('aria-pressed',String(soundOn));
  if(soundOn){
    if(!audioCtx) buildAmbience();
    audioCtx.resume();
    ambience.master.gain.linearRampToValueAtTime(.16,audioCtx.currentTime+1.4);
    toast('Ambience on. Quiet by design.');
  }else if(ambience){
    ambience.master.gain.linearRampToValueAtTime(0,audioCtx.currentTime+.8);
  }
};

/* weather bank, injected next to the others so the HTML stays legible */
(function addWeatherBank(){
  const host=document.getElementById('hud-right');
  const bank=document.createElement('div');
  bank.className='switchbank'; bank.id='wbank';
  bank.setAttribute('role','group'); bank.setAttribute('aria-label','Weather');
  [['clear','Clear','○'],['rain','Rain','☂'],['snow','Snow','❄'],['dream','Dream','✦']].forEach(([w,label,g],i)=>{
    const b=document.createElement('button');
    b.className='sw'; b.dataset.w=w; b.setAttribute('aria-pressed',String(i===0));
    b.innerHTML=`<span class="g">${g}</span><span class="lbl">${label}</span>`;
    b.onclick=()=>setWeather(w);
    bank.appendChild(b);
  });
  host.appendChild(bank);
  /* the cluster just grew by a row — re-measure so the sheet clears it */
  syncHudHeight();
})();

/* ==== part8_loop ==== */
/* ============================================================
   25 · ANIMATION LOOP — the park must never look frozen
   ============================================================ */
let clock=0, last=performance.now(), coasterT=0, hoverPulse=0;
const tmpV=new THREE.Vector3();

function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min(.05,(now-last)/1000); last=now;
  clock+=dt;

  stepState(dt); pushState(); stepLights(dt); stepWeather(dt);

  /* --- ferris wheel: slow, mechanical, occasionally deliberate --- */
  const wheelG=ferris.userData.wheel;
  if(cabinTargetAngle!==null){
    // ease the chosen cabin toward the front, then release
    let cur=wheelG.rotation.z;
    let diff=((cabinTargetAngle-cur+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
    wheelG.rotation.z+=diff*Math.min(1,dt*1.6);
    if(Math.abs(diff)<.02) cabinTargetAngle=null;
  }else{
    const slow=focusId==='ferris'?.055:.12;
    wheelG.rotation.z+=dt*slow*(dreamAmt>.5?-.6:1);
  }
  // cabins hang level, swaying gently
  ferris.userData.cabs.forEach((c,i)=>{
    c.cab.rotation.z=-wheelG.rotation.z+Math.sin(clock*.9+i)*.045;
  });
  // dream: the wheel lifts off its frame
  ferris.position.y=hAt(FERRIS_POS.x,FERRIS_POS.z)+dreamAmt*2.6+Math.sin(clock*.5)*dreamAmt*.5;

  /* --- coaster train --- */
  const track=coaster.userData.track;
  coasterT=(coasterT+dt*(focusId==='coaster'?.028:.021))%1;
  coaster.userData.cars.children.forEach((car,i)=>{
    const t=(coasterT - i*.012 + 1)%1;
    const p=track.getPoint(t), tan=track.getTangent(t);
    car.position.copy(p);
    tmpV.copy(p).add(tan);
    car.lookAt(tmpV);
    // bank into the curves
    const t2=(t+.02)%1;
    const turn=track.getTangent(t2).angleTo(tan);
    car.rotateZ(clamp(turn*4,-.5,.5)*Math.sign(tan.x));
  });

  /* --- carousel --- */
  const spin=carousel.userData.spin;
  spin.rotation.y+=dt*(dreamAmt>.5?-.22:.16);
  (carousel.userData.animals||[]).forEach(g=>{
    g.position.y=g.userData.baseY+Math.sin(clock*1.9+g.userData.bob*.85)*.30;
    g.rotation.z=Math.sin(clock*1.9+g.userData.bob*.85)*.05;
  });
  if(carousel.userData.crownFlag)
    carousel.userData.crownFlag.rotation.y=Math.sin(clock*2.4)*.34;

  /* --- story garden: fountain jet and a page turning in the wind --- */
  if(garden.userData.jet){
    const j=garden.userData.jet;
    j.scale.y=1+Math.sin(clock*3.1)*.10;
    j.material.opacity=.42+Math.sin(clock*4.2)*.1;
  }
  if(garden.userData.sheet)
    garden.userData.sheet.rotation.z=.05+Math.sin(clock*1.15)*.07;

  /* --- the globe turns slowly; its gears turn with it --- */
  if(globeZone.userData.globe){
    const st=globeZone.userData.spinTo;
    if(st){
      st.t=Math.min(1,st.t+dt*1.05);
      const e=1-Math.pow(1-st.t,3);
      globeZone.userData.globe.rotation.y=st.from+(st.to-st.from)*e;
      if(st.t>=1) globeZone.userData.spinTo=null;
    } else globeZone.userData.globe.rotation.y+=dt*(dreamAmt>.5?.14:.045);
    if(globeZone.userData.gear0) globeZone.userData.gear0.rotation.z+=dt*.28;
    if(globeZone.userData.gear1) globeZone.userData.gear1.rotation.z-=dt*.36;
  }

  /* --- futureland never finishes: the crane swings, the canvas breathes --- */
  if(futureland.userData.jib)
    futureland.userData.jib.rotation.y=Math.sin(clock*.18)*.55;
  if(futureland.userData.halfWheel)
    futureland.userData.halfWheel.rotation.z=Math.sin(clock*.42)*.10;
  if(futureland.userData.drape){
    const pa=futureland.userData.drape.geometry.attributes.position;
    for(let i=0;i<pa.count;i++){
      const x=pa.getX(i),y=pa.getY(i);
      pa.setZ(i, Math.sin(x*.9+y*.5+clock*1.1)*.28+Math.cos(y*1.1+clock*.7)*.16);
    }
    pa.needsUpdate=true;
  }

  /* --- polaroids sway on the line --- */
  (gallery.userData.polas||[]).forEach((g,i)=>{
    g.rotation.z=Math.sin(clock*1.3+i*.7)*.06;
  });

  /* --- circus tents behaving impossibly --- */
  circus.userData.tents.forEach((t,i)=>{
    const nudge=t.userData.nudge||0;
    if(nudge>0) t.userData.nudge=Math.max(0,nudge-dt*1.6);
    const n=t.userData.nudge||0;
    if(t.userData.mode==='float'){
      t.position.y=.9+Math.sin(clock*.7)*.22+n*.7+dreamAmt*1.4;
      t.rotation.z=Math.sin(clock*.4)*.012;
    }else if(t.userData.mode==='flip'){
      t.rotation.z=Math.PI*(0.985+Math.sin(clock*.3)*.006);
      t.position.y=11.6+Math.sin(clock*.5)*.14+dreamAmt*1.2;
    }else if(t.userData.mode==='shrink'){
      const s=.72+Math.sin(clock*.45)*.045+n*.06;
      t.scale.setScalar(s);
      t.position.y=Math.sin(clock*.6)*.1+dreamAmt*.8;
    }else if(t.userData.mode==='orbit'){
      t.userData.orb.rotation.y+=dt*.5*(dreamAmt>.5?-1:1);
      t.userData.orb.rotation.x=Math.sin(clock*.3)*.2;
      t.position.y=n*.4+dreamAmt*1.1;
    }
  });

  /* --- flags & pennants: cloth, one of them against the wind --- */
  world.traverse(o=>{
    if(!o.userData.flag) return;
    const p=o.geometry.attributes.position, base=o.userData.base;
    const dir=o.userData.against?-1:1;
    for(let i=0;i<p.count;i++){
      const bx=base[i*3], by=base[i*3+1];
      const w=(bx+ (o.geometry.parameters?.width||2)/2);
      p.setZ(i, Math.sin(clock*3.1*dir + w*2.6 + by)*w*.19);
      p.setY(i, by + Math.sin(clock*2.2*dir + w*2)*w*.05);
    }
    p.needsUpdate=true;
  });

  /* --- trees sway --- */
  trees.children.forEach(t=>{
    t.rotation.z=Math.sin(clock*.55+t.userData.sway)*.016;
  });

  /* --- balloons drift --- */
  balloons.children.forEach(b=>{
    if(b.userData.i===undefined) return;
    b.position.x+=Math.sin(clock*.5+b.userData.i)*dt*.12;
    b.position.y+=Math.sin(clock*.9+b.userData.i*2)*dt*.16;
  });

  /* --- birds cross the sky by day --- */
  birds.children.forEach(b=>{
    b.userData.t+=dt*b.userData.speed;
    if(b.userData.t>1){ b.userData.t=0; b.userData.z=lerp(-70,50,Math.random()); }
    b.position.set(lerp(-90,90,b.userData.t), b.userData.y+Math.sin(clock+b.userData.ph)*1.2, b.userData.z);
    b.rotation.z=Math.sin(clock*6+b.userData.ph)*.3;
    b.visible=cur.star<.6;
  });

  /* --- atmospheric motes & fireflies --- */
  [motes,fireflies].forEach((pc,k)=>{
    if(pc.material.opacity<.02) return;
    const p=pc.geometry.attributes.position, ph=pc.userData.ph, base=pc.userData.base;
    for(let i=0;i<p.count;i++){
      const s=k?1.6:.6;
      p.setX(i, base[i*3]+Math.sin(clock*.34*s+ph[i])*2.2);
      p.setY(i, base[i*3+1]+Math.sin(clock*.22*s+ph[i]*1.7)*(k?1.4:2.6)*(dreamAmt>.3?2.4:1) + (dreamAmt*clock*.4*(k?0:1))%16);
      p.setZ(i, base[i*3+2]+Math.cos(clock*.29*s+ph[i])*2.2);
    }
    p.needsUpdate=true;
  });
  // fireflies keep to the story garden side at night
  fireflies.position.set(-18,0,30);

  /* --- Dolly: blinks, looks at you, wanders, dozes at night --- */
  (function dollyTick(){
    const u=dolly.userData; u.t+=dt;
    const nightly=stateName==='night';
    // breathing
    u.bodyG.position.y=.95+Math.sin(clock*1.4)*.03;
    // blink
    const blink=Math.sin(clock*.7)>.995 || (Math.sin(clock*2.3)>.9993);
    u.eyes.forEach(e=>e.scale.y=nightly?.18:(blink?.12:1));
    // look toward the visitor
    tmpV.copy(camera.position); tmpV.y=dolly.position.y+1.4;
    const desired=Math.atan2(tmpV.x-dolly.position.x,tmpV.z-dolly.position.z);
    if(nightly){
      // dozing: head droops, no tracking
      u.headG.rotation.x=lerp(u.headG.rotation.x,.42,dt*1.4);
      u.bodyG.rotation.y=lerp(u.bodyG.rotation.y,0,dt);
    }else{
      u.headG.rotation.x=lerp(u.headG.rotation.x,Math.sin(clock*.5)*.05,dt*1.6);
      const rel=((desired-dolly.rotation.y+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
      u.bodyG.rotation.y=lerp(u.bodyG.rotation.y,clamp(rel,-.9,.9),dt*1.3);
    }
    // occasional short walk near the booth (or shelter in the rain)
    if(u.shelter){
      u.walkTarget=new THREE.Vector3(BO.x+1.4,0,BO.z+1.2);
    }else if(!u.walkTarget && u.t>(u.nextIn||5) && !nightly){
      u.nextIn=4+Math.random()*5;   // next stroll scheduled, not gambled
      // Dolly tours the whole park: pick a zone, stand a little off to its side
      const stops=(typeof DOLLY_STOPS!=='undefined')?DOLLY_STOPS:[[BO.x,BO.z+3]];
      const s0=stops[(Math.random()*stops.length)|0];
      const a=Math.random()*Math.PI*2, r=lerp(4,9,Math.random());
      let tx=s0[0]+Math.cos(a)*r, tz=s0[1]+Math.sin(a)*r;
      // stand beside an attraction, never inside it
      if(typeof ZONE_CLEAR!=='undefined'){
        // two passes: shoving clear of one zone can nudge into a neighbour
        for(let pass=0;pass<3;pass++){
          for(const [zx,zz,zr] of ZONE_CLEAR){
            const dx=tx-zx, dz=tz-zz, dd=Math.hypot(dx,dz), keep=zr+2.5;
            if(dd<keep){ const k=(dd<.001)?1:keep/dd; tx=zx+dx*k; tz=zz+dz*k; }
          }
        }
      }
      u.walkTarget=new THREE.Vector3(tx,0,tz);
    }
    if(u.walkTarget){
      const to=u.walkTarget.clone().sub(dolly.position); to.y=0;
      const d=to.length();
      if(d<.3){ u.walkTarget=null; u.t=0; u.nextIn=4+Math.random()*5; }
      else{
        to.normalize();
        // longer hauls get a brisker walk so crossing the park doesn't take forever
        dolly.position.addScaledVector(to,dt*(d>14?4.6:d>6?3.0:1.6));
        dolly.position.y=hAt(dolly.position.x,dolly.position.z)+Math.abs(Math.sin(clock*7))*.07;
        dolly.rotation.y=lerp(dolly.rotation.y,Math.atan2(to.x,to.z),dt*4);
      }
    }
  })();

  /* --- hover feedback: bulbs brighten, cursor changes, label follows --- */
  if(introDone && !dragging){
    const id=hitTest();
    if(id!==hoverId){
      hoverId=id;
      const tip=document.getElementById('tip');
      const h=HOT.find(x=>x.id===id);
      stage.classList.toggle('pointing',!!id);
      if(id && h && id!==focusId){
        tip.textContent=h.label; tip.classList.add('show');
      }else tip.classList.remove('show');
      if(id==='graveyard') discover('graveyard-hover','Something is back there…');
    }
  }
  hoverPulse=lerp(hoverPulse, hoverId?1:0, dt*5);
  // nearby bulbs of the hovered attraction get a lift
  if(hoverId){
    LAMPS.forEach(l=>{
      if(l.zone===hoverId || (hoverId==='ferris'&&l.zone==='ferris')){
        l.mat.emissiveIntensity*=1+hoverPulse*.55;
      }
    });
  }

  /* --- intro: gate doors swing, flags catch --- */
  if(introPlaying||gateOpen>0){
    gateOpen=Math.min(1,gateOpen+dt*.42);
    const e=easeOutCubic(gateOpen);
    world.userData.doorL.rotation.y=-e*1.15;
    world.userData.doorR.rotation.y=e*1.15;
  }

  /* --- dream: the sky comes too close, a whale passes --- */
  if(dreamAmt>.01){
    starLayers.forEach(p=>{ p.material.opacity=Math.max(p.material.opacity,dreamAmt*.5*p.userData.bright); });
    stars.scale.setScalar(lerp(1,.55,dreamAmt));
    if(!scene.userData.whale){
      const wg=new THREE.Group();
      const bodyW=new THREE.Mesh(new THREE.SphereGeometry(6,14,10),
        new THREE.MeshBasicMaterial({color:0x0d1626,transparent:true,opacity:.5}));
      bodyW.scale.set(2.6,.8,1); wg.add(bodyW);
      const tail=new THREE.Mesh(new THREE.ConeGeometry(2.6,5,4),
        new THREE.MeshBasicMaterial({color:0x0d1626,transparent:true,opacity:.5}));
      tail.rotation.z=Math.PI/2; tail.position.x=-16; wg.add(tail);
      wg.position.set(-120,64,-60); scene.add(wg); scene.userData.whale=wg;
    }
    const w=scene.userData.whale;
    w.visible=true;
        w.position.x+=dt*5.5;
    if(w.position.x>130) w.position.x=-130;
    w.position.y=64+Math.sin(clock*.3)*3;
    w.children.forEach(c=>c.material.opacity=.42*dreamAmt);
  }else if(scene.userData.whale){
    scene.userData.whale.visible=false;
    stars.scale.setScalar(1);
  }

  stepCam(dt);
  if(composer) composer.render(); else renderer.render(scene,camera);
}

/* ============================================================
   26 · RESIZE & BOOT
   ============================================================ */
function resize(){
  const w=innerWidth,h=innerHeight;
  camera.aspect=w/h;
  camera.fov=w/h<1?46:34; // portrait needs a wider lens to keep the diorama whole
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(COMPAT_3D?1:Math.min(devicePixelRatio,MOBILE?1.35:1.5));
  renderer.setSize(w,h);
  if(composer) composer.setSize(w,h);
  if(bloom) bloom.setSize(w,h);
}
addEventListener('resize',resize);
resize();

// QA hook — lets a headless review read the real camera & light state
window.__park={THREE,DOLLY_STOPS,dolly,rig,camera,renderer,sun,hemi,scene,OVERVIEW,LAMPS,HOT,COMPAT_3D,rendererAttempt,
  clock:()=>clock, tween:()=>tween?tween.t:null, cur:()=>({sunI:cur.sunI,bulb:cur.bulb}), stateName:()=>stateName,
  state:()=>({state:stateName,lights:lightsOn,weather,focus:focusId,
    az:+rig.az.toFixed(2),pol:+rig.pol.toFixed(2),dist:+rig.dist.toFixed(1),
    tgt:rig.tgt.toArray().map(n=>+n.toFixed(1)),camPos:camera.position.toArray().map(n=>+n.toFixed(1)),
    fov:camera.fov,exposure:+renderer.toneMappingExposure.toFixed(2),
    lamps:LAMPS.length,litAvg:+(LAMPS.reduce((a,l)=>a+l.lit,0)/LAMPS.length).toFixed(2)}),
  go:id=>focusOn(id), over:()=>toOverview(),
  setState, setLights, setWeather,
  // advance world time without waiting on requestAnimationFrame (headless review)
  ff:(seconds)=>{
    const dt=1/60, n=Math.round(seconds/dt);
    for(let i=0;i<n;i++){ clock+=dt; stepState(dt); pushState(); stepLights(dt); stepWeather(dt); stepCam(dt); }
    if(composer) composer.render(); else renderer.render(scene,camera);
    return {clock:+clock.toFixed(1),state:stateName,renderMode:window.__parkRenderMode};
  }};

setState('day',1);
setLights(true,false);
window.__parkBooted=true;
window.__parkFailure=null;
document.getElementById('fallback').style.display='none';
document.getElementById('loading').classList.add('gone');
requestAnimationFrame(animate);

