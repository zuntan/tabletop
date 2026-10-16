import { randomBytes } from 'node:crypto';

/** Memory-only, single-use bootstrap credential, bound to one acceptance epoch. */
export class HandoffTicket {
  private ticket: { token: string; expires: number; epoch: number } | null = null;
  constructor(private now = () => Date.now()) {}
  issue(epoch: number) {
    const token = randomBytes(24).toString('base64url');
    this.ticket = { token, expires: this.now() + 300_000, epoch };
    return token;
  }
  allows(token: string | null, epoch: number) {
    return !!this.ticket && this.ticket.token === token && this.ticket.epoch === epoch && this.now() < this.ticket.expires;
  }
  clear() { this.ticket = null; }
}
