/** Deterministic motion artwork shared by the runtime fallback and video render. */
import {PORTAL_SECONDS,PORTAL_MOTION_SCALE} from './portalSoundtrack';
export {PORTAL_SECONDS} from './portalSoundtrack';
const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function drawPortalFrame(ctx:CanvasRenderingContext2D,image:CanvasImageSource,width:number,height:number,seconds:number,reduced=false){
 const p=Math.max(0,Math.min(1,seconds/PORTAL_SECONDS)),pull=smooth((p-.12)/.76);
 ctx.save();ctx.fillStyle='#0b1019';ctx.fillRect(0,0,width,height);
 const w=1672,h=941,scale=Math.min(width/w,height/h),ox=(width-w*scale)/2,oy=(height-h*scale)/2;
 ctx.translate(ox,oy);ctx.scale(scale,scale);
 // A slow inward drift rather than whole-screen spinning; the warm room loses colour.
 ctx.filter=`saturate(${1-pull*.98})`;
 if(reduced)ctx.drawImage(image,0,0,w,h);
 else {
  // Continuous texture warp: the two figures and nearby room pixels travel
  // into the portal while its outer rim stays full-frame (no shrinking card).
  const cx=w*.52,cy=h*.39;
  const point=(x:number,y:number)=>{const dx=x-cx,dy=y-cy,r=Math.hypot(dx,dy),weight=Math.max(0,1-r/1050);const k=1-pull*.94*weight*weight;return {x:cx+dx*k,y:cy+dy*k};};
  const triangle=(a:{x:number,y:number},b:{x:number,y:number},c:{x:number,y:number},da:{x:number,y:number},db:{x:number,y:number},dc:{x:number,y:number})=>{
   const den=a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y);
   const coeff=(u:number,v:number,z:number)=>[(u*(b.y-c.y)+v*(c.y-a.y)+z*(a.y-b.y))/den,(u*(c.x-b.x)+v*(a.x-c.x)+z*(b.x-a.x))/den,(u*(b.x*c.y-c.x*b.y)+v*(c.x*a.y-a.x*c.y)+z*(a.x*b.y-b.x*a.y))/den];
   const X=coeff(da.x,db.x,dc.x),Y=coeff(da.y,db.y,dc.y);
   const mx=(da.x+db.x+dc.x)/3,my=(da.y+db.y+dc.y)/3;const edge=(q:{x:number,y:number})=>{const length=Math.hypot(q.x-mx,q.y-my)||1;return {x:q.x+(q.x-mx)/length*.8,y:q.y+(q.y-my)/length*.8};};const ea=edge(da),eb=edge(db),ec=edge(dc);ctx.save();ctx.beginPath();ctx.moveTo(ea.x,ea.y);ctx.lineTo(eb.x,eb.y);ctx.lineTo(ec.x,ec.y);ctx.closePath();ctx.clip();ctx.transform(X[0]!,Y[0]!,X[1]!,Y[1]!,X[2]!,Y[2]!);const left=Math.max(0,Math.min(a.x,b.x,c.x)-2),top=Math.max(0,Math.min(a.y,b.y,c.y)-2),right=Math.min(w,Math.max(a.x,b.x,c.x)+2),bottom=Math.min(h,Math.max(a.y,b.y,c.y)+2);ctx.drawImage(image,left,top,right-left,bottom-top,left,top,right-left,bottom-top);ctx.restore();
  };
  ctx.save();ctx.translate(cx,cy);const zoom=1+pull*.65;ctx.scale(zoom,zoom);ctx.translate(-cx,-cy);
  for(let y=0;y<h;y+=100)for(let x=0;x<w;x+=100){
   const a={x,y},b={x:Math.min(w,x+100),y},c={x:Math.min(w,x+100),y:Math.min(h,y+100)},d={x,y:Math.min(h,y+100)};
   const A=point(a.x,a.y),B=point(b.x,b.y),C=point(c.x,c.y),D=point(d.x,d.y);triangle(a,b,c,A,B,C);triangle(a,c,d,A,C,D);
  }
  ctx.restore();
  // Fine pixel streams converge towards the opening, keeping the still artwork readable.
  for(let i=0;i<100;i++){
   const phase=(i*.61803398875+seconds/PORTAL_MOTION_SCALE*.12)%1,angle=i*2.39996323;
   const r=(1-phase)*950,alpha=Math.sin(phase*Math.PI)*.58*smooth(p/.15)*(1-smooth((p-.85)/.15));
   const x=w*.52+Math.cos(angle+pull*.12)*r,y=h*.39+Math.sin(angle+pull*.12)*r*.65;
   const size=2+(1-phase)*7;ctx.globalAlpha=alpha;ctx.fillStyle=i%3?'#d6e2ef':'#f5d58b';ctx.fillRect(x,y,size,size);
  }
  ctx.globalAlpha=1;
 }
 ctx.filter='none';
 // A single soft dark dissolve avoids flashes and hands off to the monochrome world.
 ctx.fillStyle=`rgba(9,14,23,${smooth((p-.73)/.27)})`;ctx.fillRect(-w,-h,w*3,h*3);ctx.restore();
}
