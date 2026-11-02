// A small in-memory ring of autosave events (start, finish, failure, queueing, timer lag). It has no effect on play. The newest
// entries are mirrored into a data attribute on #savestate so a failing browser test can show what the saver actually did.
const buf: string[] = [];
export function diag(ev: string, extra = ''): void {
  const vis = typeof document === 'undefined' ? 'n/a' : document.visibilityState; // unit tests run without a DOM
  buf.push(`${Math.round(performance.now())}ms ${ev}${extra ? ' ' + extra : ''} vis=${vis}`);
  if (buf.length > 40) buf.shift();
  if (typeof document !== 'undefined') document.getElementById('savestate')?.setAttribute('data-diag', buf.join(' | '));
}
export const diagText = (): string => buf.join(' | ');
