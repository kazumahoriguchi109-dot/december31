import * as THREE from 'three';

/** Presentation only: clothing, face and small gestures never change puzzle state. */
export function poseFigure(actor: THREE.Object3D, options: {
  speaking: boolean; waiting?: boolean; worried?: boolean; holding?: boolean; pulse?: number; walk?: number;
}) {
  const { speaking, waiting = false, worried = false, holding = false, pulse = 0, walk = 0 } = options;
  const head = actor.getObjectByName('rig-head');
  const left = actor.getObjectByName('rig-armL');
  const right = actor.getObjectByName('rig-armR');
  const eyes = actor.getObjectByName('rig-eyes');
  const mouth = actor.getObjectByName('rig-mouth');
  const brows = actor.getObjectByName('rig-brows');
  const toto = actor.name === 'toto';
  const legL = actor.getObjectByName('rig-legL'), legR = actor.getObjectByName('rig-legR');
  if (legL) legL.rotation.x = walk * .32;
  if (legR) legR.rotation.x = -walk * .32;
  if (head) head.rotation.set(worried ? .09 : speaking ? -.04 + pulse * .035 : .025, speaking ? (toto ? -.09 : .08) : waiting ? .13 : 0, speaking ? (toto ? -.045 : .035) : 0);
  if (left) left.rotation.set(holding ? 1.1 : speaking ? .22 + pulse * .12 : .03, 0, holding ? .45 : speaking && !toto ? -.2 : -.035);
  if (right) right.rotation.set(holding ? 1.1 : speaking ? .28 + pulse * .16 : .03, 0, holding ? -.45 : speaking && toto ? .28 : .035);
  if (Math.abs(walk) > .001) { if (left) left.rotation.x = -.25 * walk; if (right) right.rotation.x = .25 * walk; }
  if (eyes) eyes.scale.y = worried ? .8 : 1;
  if (mouth) { mouth.scale.y = speaking ? 1.35 + Math.max(0, pulse) * .65 : .7; mouth.scale.x = worried ? .7 : 1; }
  if (brows) brows.rotation.z = worried ? -.065 : speaking ? .025 : 0;
}
