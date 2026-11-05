// A composed winter clearing around the existing mill. Render-only; puzzle coordinates stay fixed.
import * as THREE from 'three';
import { canvasTexture, lam, lamTex, rng } from './materials';
const flat = (m: THREE.Mesh) => { m.userData['flat'] = true; m.receiveShadow = true; return m; };
export function winterMill(): THREE.Group {
  const root = new THREE.Group(); root.name = 'winter-mill-clearing';
  const tex = canvasTexture('mill-snow', 512, 512, (g,w,h) => {
    g.fillStyle = '#c6d5dd'; g.fillRect(0,0,w,h);
    const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#e1e4df');grad.addColorStop(.55,'#c6d5dd');grad.addColorStop(1,'#9eb7c7');g.fillStyle=grad;g.fillRect(0,0,w,h);
    const r=rng(213);for(let i=0;i<350;i++){g.fillStyle=i%2?'rgba(255,255,255,.12)':'rgba(68,105,127,.05)';g.fillRect(r()*w,r()*h,1+r()*3,1);}
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const outline=new THREE.Shape();
  outline.moveTo(-5,4);
  outline.bezierCurveTo(-6,-1,-4,-7,-1,-8.5);
  outline.bezierCurveTo(1,-10,2,-9,4,-10);
  outline.bezierCurveTo(7,-10.5,10,-10.4,12,-9.8);
  outline.bezierCurveTo(14,-8,14,-4,13,1);
  outline.bezierCurveTo(12,5,8,5,4,4);
  outline.bezierCurveTo(1,5,-3,6,-5,4); outline.closePath();
  const geo=new THREE.ShapeGeometry(outline);const uv=geo.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+6)/20,(-uv.getY(i)+6)/17);
  const snow=flat(new THREE.Mesh(geo,lamTex(0xffffff,tex,'mill-snow')));snow.rotation.x=-Math.PI/2;snow.position.y=.008;root.add(snow);
  const stone=lam(0x607889),cap=lam(0xd7e0df);
  // Low, irregular banks frame the stream without competing with the drain and wheel controls.
  for(let i=0;i<15;i++)for(const side of [-1,1]) {
    const z=1.4+i*.59,x=6+side*(.88+.06*Math.sin(i*2));
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.23+(i%3)*.025,0),stone);rock.position.set(x,.12,z);rock.scale.set(1.1,.7,1.3);root.add(rock);
    const ice=new THREE.Mesh(new THREE.SphereGeometry(.24,7,4),cap);ice.position.set(x,.26,z);ice.scale.set(1,.22,1.1);root.add(ice);
  }
  // A masonry race contains the puzzle's horizontal water channel.
  for(const z of [9.03,9.97]) {
    const edge=new THREE.Mesh(new THREE.BoxGeometry(5.3,.22,.18),stone);edge.position.set(3.5,.11,z);root.add(edge);
    const dust=new THREE.Mesh(new THREE.BoxGeometry(5.3,.04,.20),cap);dust.position.set(3.5,.24,z);root.add(dust);
  }
  // Paired shallow footprints tell where the friends arrived, while leaving the puzzle tile clear.
  const footmat=lam(0x879eac);
  for(let i=0;i<10;i++){
    const foot=flat(new THREE.Mesh(new THREE.CircleGeometry(.085,8),footmat));foot.rotation.x=-Math.PI/2;foot.scale.set(.75,1.55,1);foot.position.set(2.5+i*.17+(i%2?.16:-.16),.025,5.5+i*.22);root.add(foot);
  }
  // Small icicles under the mill eave. No extra bloom or artificial foreground veil.
  for(let i=0;i<9;i++){
    const icicle=new THREE.Mesh(new THREE.ConeGeometry(.035,.16+(i%3)*.05,5),lam(0xa8ccd8));icicle.rotation.z=Math.PI;icicle.position.set(7.65+i*.28,1.66,6.04);root.add(icicle);
  }
  return root;
}
