import {expect,test} from './fixtures';
import {openGame} from './helpers';
import * as THREE from 'three';
import world from '../../data/world.json' with { type: 'json' };
for(const side of ['front','back'] as const)for(const party of ['follow','same','opposite'] as const)test(`P06 player boots occupy the ${side} plate with Toto ${party}`,async({page},info)=>{
 await openGame(page,'/?start=M1A_P05&era=E3');
 const p=world.cameraPresets[`portal_${side}_portal_${side}`],f=p.frustum;
 const cam=new THREE.OrthographicCamera(f.left,f.right,f.top,f.bottom,p.near,p.far);cam.position.fromArray(p.position);cam.up.fromArray(p.up);cam.lookAt(new THREE.Vector3(...p.target));cam.updateMatrixWorld(true);
 const x=party==='same'?-.35:0,z=side==='front'?-1.5:1.5;
 const point=new THREE.Vector3(x+.17,.25,z).project(cam);
 const count=await page.evaluate(async({side,party,point})=>{
  const g=(window as any).__d31.game,s=structuredClone(g.state);s.progress.milestone='P05_DONE';s.puzzles.p05={a:1,b:2,solved:true};s.player.anchor=`portal_${side}`;s.player.view=`portal_${side}`;
  s.toto=party==='follow'?{mode:'follow',anchor:'party'}:{mode:'wait',anchor:`p06_${party==='same'?side:side==='front'?'back':'front'}`};s.dialogue.activeId=null;s.dialogue.queue=[];const prev=g.state;g.state=s;g.emit([],prev);await new Promise(requestAnimationFrame);
  const cv=document.querySelector<HTMLCanvasElement>('#world')!,c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const ctx=c.getContext('2d')!;ctx.drawImage(cv,0,0);const d=ctx.getImageData(Math.round(point.x*c.width)-2,Math.round(point.y*c.height)-2,5,5).data;
  let dark=0;for(let i=0;i<d.length;i+=4)if(d[i]!<125&&d[i+1]!<125&&d[i+2]!<125)dark++;return dark;
 },{side,party,point:{x:(point.x+1)/2,y:(1-point.y)/2}});
 await page.screenshot({path:info.outputPath(`${side}-${party}.png`)});expect(count).toBeGreaterThanOrEqual(9);
});
