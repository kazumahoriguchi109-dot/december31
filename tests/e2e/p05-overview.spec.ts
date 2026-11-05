import {test,expect} from './fixtures';
import {openGame} from './helpers';
import * as THREE from 'three';
import world from '../../data/world.json' with {type:'json'};
import puzzles from '../../data/puzzles.json' with {type:'json'};
// Independently project the documented arc bounds, rather than inspect renderer internals.
function point(piece:'fixed'|'a'|'b', pos:number, t:number) {
 const p=puzzles.p05Projection,s=p[piece],theta=(s.startDegrees+(s.endDegrees-s.startDegrees)*t)*Math.PI/180;
 const z=piece==='fixed'?p.fixed.z:p.zStops[pos]!,scale=world.p05LocalToWorld.scale,o=world.p05LocalToWorld.origin;
 return new THREE.Vector3(o[0]+scale*s.radius*Math.cos(theta),o[1]+scale*s.radius*Math.sin(theta),o[2]-scale*z);
}

test('P05 overview keeps both coats outside every ring configuration',async({page})=>{
 await openGame(page,'/?start=M1A_P05');
 const p=world.cameraPresets.observatory_front,f=p.frustum;
 const cam=new THREE.OrthographicCamera(f.left,f.right,f.top,f.bottom,p.near,p.far);
 cam.position.fromArray(p.position);cam.lookAt(new THREE.Vector3(...p.target));cam.updateMatrixWorld();
 for(let a=0;a<3;a++)for(let b=0;b<3;b++){
  await page.evaluate(({a,b})=>{const g=(window as any).__d31.game,s=structuredClone(g.state);s.puzzles.p05.a=a;s.puzzles.p05.b=b;const prev=g.state;g.state=s;g.emit([],prev);},{a,b});
  const points=(['fixed','a','b'] as const).flatMap(piece=>Array.from({length:73},(_,i)=>point(piece,piece==='a'?a:piece==='b'?b:0,i/72).project(cam)));
  const region={left:Math.min(...points.map(v=>(v.x+1)/2))-.004,right:Math.max(...points.map(v=>(v.x+1)/2))+.004,top:Math.min(...points.map(v=>(1-v.y)/2))-.004,bottom:Math.max(...points.map(v=>(1-v.y)/2))+.004};
  const coatPixels=await page.locator('#world').evaluate((canvas,region)=>{
   const c=canvas as HTMLCanvasElement,copy=document.createElement('canvas');copy.width=c.width;copy.height=c.height;const ctx=copy.getContext('2d')!;ctx.drawImage(c,0,0);const data=ctx.getImageData(Math.floor(region.left*c.width),Math.floor(region.top*c.height),Math.ceil((region.right-region.left)*c.width),Math.ceil((region.bottom-region.top)*c.height)).data;
   let count=0;for(let i=0;i<data.length;i+=4){const r=data[i]!,g=data[i+1]!,b=data[i+2]!;if((r>g*1.4&&g>35&&b<g*.9)||(g>r*1.4&&g>45&&b<g*.95))count++;}return count;
  },region);
  expect(coatPixels,`A${a}/B${b} has no orange or green coat over its arcs`).toBeLessThan(8);
 }
});
