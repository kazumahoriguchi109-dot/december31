import atlas from '../../assets/art/characters/dialogue-expressions-v2.png';
import type { DialogueEmotion } from '../ui/portraits';

/** A regular 4 × 2 atlas, displayed without altering its original pixels.
 * Rows retain character identity; columns retain authored expression semantics. */
const COLUMNS: Record<DialogueEmotion, number> = {neutral:0, question:1, surprise:2, relief:3};
export function materialPortrait(speaker: string, emotion: DialogueEmotion): string {
 const row=speaker==='トト'?1:0, column=COLUMNS[emotion];
 return `<img class="journey-material-portrait" src="${atlas}" width="1774" height="887" alt="" data-portrait-row="${row}" data-portrait-column="${column}" style="left:-${column*100}%;top:-${row*100}%"/>`;
}
