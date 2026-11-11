/** Approved ending beats. All six puzzles are solved before this presentation starts. */
export const ENDING_STORY = [
 {scene:'gate',speaker:'トト',text:'今度は、いっしょに。'},
 {scene:'gate',speaker:'主人公',text:'うん。帰ろう。'},
 {scene:'rewind',speaker:'',text:'ふたりは手をつないだ。光とかけらが帰り道をつくり、立体が色へ、色が白黒へと戻っていく。'},
 {scene:'room',speaker:'トト',text:'……戻ってきた？'},
 {scene:'room',speaker:'主人公',text:'うん。いつもの部屋だ。'},
 {scene:'room',speaker:'トト',text:'よかった。ちゃんと二人とも。'},
 {scene:'room',speaker:'',text:'ただいま。'},
 {scene:'room',speaker:'トト',text:'何回も、待ってもらっちゃったね。'},
 {scene:'room',speaker:'主人公',text:'こっちも。トトが待っててくれなかったら、通れなかった。'},
 {scene:'room',speaker:'トト',text:'じゃあ、おあいこだ。'},
 {scene:'chest',speaker:'',text:'ふたりがテレビを見ると、画面の宝箱が静かに閉じた。'},
 {scene:'room',speaker:'トト',text:'新しくなるたび、なんでもできると思ってた。'},
 {scene:'room',speaker:'主人公',text:'でも、昔の部屋で止まれたから、帰り道ができたね。'},
 {scene:'room',speaker:'トト',text:'今年最後のゲーム、長かったね。'},
 {scene:'room',speaker:'主人公',text:'うん。でも、二人でクリアできた。'},
 {scene:'room',speaker:'トト',text:'来年も？'},
 {scene:'room',speaker:'主人公',text:'もちろん。'},
 {scene:'end',speaker:'',text:'今年の冒険は、おしまい。'},
] as const;
export type EndingScene = typeof ENDING_STORY[number]['scene'];
export const CHEST_BEAT=ENDING_STORY.findIndex(b=>b.scene==='chest');
export function endingLine(value:unknown){return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<ENDING_STORY.length?value:0;}
/** No flashing. Reduced-motion mode uses a single stable colour frame. */
export function rewindStage(progress:number,reducedMotion=false){return reducedMotion?2:progress<.3?3:progress<.6?2:progress<.9?1:0;}
