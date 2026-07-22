/**
 * Token-bucket pacer. `reserve(now)` returns how many ms the caller must wait
 * before its slot is free (0 = go now). Callers that await the returned delay
 * are spaced to at most `refillPerHour` over time, after an initial burst of up
 * to `capacity`. Reservations chain correctly across concurrent callers because
 * each reserve() advances the frontier synchronously.
 *
 * Used to keep Braze media uploads under its 100-requests/hour quota.
 */
export interface Pacer {
  reserve(now: number): number;
}

export function createPacer(capacity: number, refillPerHour: number): Pacer {
  const refillMs = 3_600_000 / refillPerHour;
  let tokens = capacity;
  let last = 0;
  let started = false;
  return {
    reserve(now: number): number {
      if (!started) {
        started = true;
        last = now;
      }
      // Refill for real elapsed time (never beyond an outstanding reservation).
      if (now > last) {
        tokens = Math.min(capacity, tokens + (now - last) / refillMs);
        last = now;
      }
      if (tokens >= 1) {
        tokens -= 1;
        return 0;
      }
      // No token now: reserve the next one at the frontier and return the
      // absolute wait from `now` so concurrent callers don't bunch up.
      const frontier = Math.max(now, last);
      last = frontier + Math.ceil((1 - tokens) * refillMs);
      tokens = 0;
      return last - now;
    },
  };
}
