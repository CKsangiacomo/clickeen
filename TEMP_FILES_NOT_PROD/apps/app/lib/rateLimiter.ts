export class RateLimiter {
  private attempts = new Map<string, number[]>();
  constructor(private windowMs: number, private max: number) {}

  check(key: string) {
    const now = Date.now();
    const arr = this.attempts.get(key) || [];
    const recent = arr.filter(t => t > now - this.windowMs);
    if (recent.length >= this.max) return false;
    recent.push(now);
    this.attempts.set(key, recent);
    if (recent.length === 1 || Math.random() < 0.01) this.cleanup();
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [k, v] of this.attempts.entries()) {
      const keep = v.filter(t => t > now - this.windowMs);
      if (keep.length) this.attempts.set(k, keep);
      else this.attempts.delete(k);
    }
  }
}
