const activityColor = '#00ff00';
const onMs = 120, offMs = 60, maxPending = 4;

/** A lossy traffic lamp, independent of command execution or success. */
export function createActivityLed(container: HTMLElement) {
  const lamp = document.createElement('span'); lamp.id = 'ai-activity-led';
  lamp.setAttribute('role', 'img'); lamp.setAttribute('aria-label', 'AIとの通信ランプ');
  lamp.title = 'AIとの通信ランプ'; lamp.dataset.lit = 'false';
  container.append(lamp);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = false;
  const pending: string[] = [];
  function clear() {
    clearTimeout(timer); timer = undefined; pending.length = 0; active = false; lamp.dataset.lit = 'false';
  }
  function light(color: string) {
    lamp.style.setProperty('--activity-color', color); lamp.dataset.lit = 'true';
  }
  function next() {
    const color = pending.shift();
    if (!color || document.hidden) { clear(); return; }
    active = true; light(color);
    timer = setTimeout(() => {
      lamp.dataset.lit = 'false';
      // Always retain a dark interval, even when many commands arrive together.
      timer = setTimeout(next, offMs);
    }, onMs);
  }
  const visibility = () => { if (document.hidden) clear(); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', clear);
  reduced.addEventListener('change', clear);
  return {
    pulse(_method: string) {
      if (document.hidden) return;
      const color = activityColor;
      if (reduced.matches) {
        // Avoid repetitive flashing: remain lit until traffic has been quiet.
        clear(); active = true; light(color); timer = setTimeout(clear, 700); return;
      }
      if (pending.length === maxPending) pending.shift();
      pending.push(color);
      if (!active) next();
    },
    clear,
  };
}
