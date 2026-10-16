export const HUMAN_SCROLL_QUIET_MS = 400;
export const HUMAN_SCROLL_CAMERA_REFUSAL = 'Human scrolling in progress. Camera action cancelled; do not retry automatically.';

/** Conservative, receipt-time guard. No timers, queued requests or automatic replay. */
export class HumanScrollGuard {
  private quietUntil = -Infinity;
  constructor(private now = () => performance.now()) {}
  record() { this.quietUntil = this.now() + HUMAN_SCROLL_QUIET_MS; }
  assertIdle() {
    if (this.now() < this.quietUntil) throw new Error(HUMAN_SCROLL_CAMERA_REFUSAL);
  }
}
