import type {JourneyState} from './contract';
/** Authoritative model remains untouched; presentation derives from the saved switch states. */
export function millVisual(s:Pick<JourneyState,'p2Drain'|'p2Stopper'|'solved'>) {
 return {bypass:s.p2Drain,wheelChannel:!s.p2Drain,locked:s.p2Stopper,turning:!!s.solved[1],bridgeDown:!!s.solved[1]};
}
