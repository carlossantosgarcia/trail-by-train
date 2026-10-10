// The phone's back button closes what is open before it leaves the page.
//
// Each open surface pushes a history entry (same URL) tagged with an
// increasing id. On popstate, every surface whose id is above the entry now
// current is closed, topmost first. A surface closed by other means consumes
// its own entry with history.back() when it is on top; one closed out of
// order just leaves the stack, and its entry is skipped over harmlessly later.

interface Entry {
  id: number;
  close: () => void;
}

const stack: Entry[] = [];
let nextId = 1;
let installed = false;
// While a history.back() of ours is in flight, a pushState would land before
// it and be undone by it; such pushes wait for the popstate.
let backPending = false;
const deferred: Entry[] = [];

function currentId(state: unknown): number {
  const id = (state as { backStack?: unknown } | null)?.backStack;
  return typeof id === 'number' ? id : 0;
}

function onPopState(e: PopStateEvent): void {
  const cur = currentId(e.state);
  backPending = false;
  while (stack.length && stack[stack.length - 1].id > cur) {
    stack.pop()!.close();
  }
  for (const entry of deferred.splice(0)) push(entry);
}

function install(): void {
  if (installed) return;
  installed = true;
  // Entries from before a reload are still in the history; start above them.
  nextId = currentId(history.state) + 1;
  window.addEventListener('popstate', onPopState);
}

function push(entry: Entry): void {
  if (backPending) {
    deferred.push(entry);
    return;
  }
  history.pushState({ ...(history.state ?? {}), backStack: entry.id }, '');
  stack.push(entry);
}

/**
 * Register an open surface. `close` runs when the user presses back while it
 * is the topmost one. Call the returned function when the surface closes by
 * any other means.
 */
export function pushBack(close: () => void): () => void {
  install();
  const entry: Entry = { id: nextId++, close };
  push(entry);
  return () => {
    const d = deferred.indexOf(entry);
    if (d >= 0) {
      deferred.splice(d, 1);
      return;
    }
    const i = stack.indexOf(entry);
    if (i < 0) return; // already closed by back
    stack.splice(i, 1);
    if (i === stack.length) {
      backPending = true;
      history.back();
    }
  };
}
