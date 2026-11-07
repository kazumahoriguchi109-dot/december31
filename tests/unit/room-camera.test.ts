import {ROOM_X_SCALE} from '../../src/journey/roomPresentation';
import {describe,expect,it} from 'vitest';
import {roomCameraFrame} from '../../src/journey/roomCamera';
describe('room camera framing',()=>{
 for(const [width,height] of [[1280,720],[1280,800],[1672,941],[390,844],[667,375],[2560,1080]])it(`fits walls and plinth at ${width}×${height}`,()=>{
  const f=roomCameraFrame(width!,height!),scale=height!*f.zoom/16;
  const length=Math.hypot(f.rise,f.run),sin=f.rise/length,cos=f.run/length;
  const center=f.targetY*cos-f.targetZ*sin;
  for(const x of [-4.3,4.3])for(const y of[-.45,3.2])for(const z of[-4.2,3.2]){
   const px=width!/2+x*ROOM_X_SCALE*scale,py=height!/2-(y*cos-z*sin-center)*scale;
   expect(px).toBeGreaterThanOrEqual(11.9);expect(px).toBeLessThanOrEqual(width!-11.9);
   expect(py).toBeGreaterThanOrEqual(Math.min(92,height!*.16)-.1);
   expect(py).toBeLessThanOrEqual(height!-Math.min(92,height!*.16)+.1);
  }
 });
});
