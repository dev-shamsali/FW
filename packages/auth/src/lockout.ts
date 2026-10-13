export interface LockoutState {
  failedLogins: number;
  lockedUntil: Date | null;
}

export interface LockoutConfig {
  /** Consecutive wrong passwords before the account locks. Default 5. */
  maxFailures?: number;
  /** How long the lock lasts, in seconds. Default 900 (15 minutes). */
  lockSec?: number;
}

export interface Lockout {
  /** Is the account locked right now, and for how many more seconds. */
  status(state: LockoutState, now?: Date): { locked: boolean; retryAfterSec: number };
  /** The state to save after a wrong password. */
  afterFailure(state: LockoutState, now?: Date): LockoutState;
  /** The state to save after a correct password. */
  afterSuccess(): LockoutState;
}

/**
 * Pure account-lockout rules: no storage, so you decide where `failedLogins` and `lockedUntil` live.
 * While an account is locked, do not verify passwords and do not call `afterFailure`, so an attacker cannot extend the lock.
 */
export function createLockout(config: LockoutConfig = {}): Lockout {
  const max = config.maxFailures ?? 5;
  const lockMs = (config.lockSec ?? 900) * 1000;
  return {
    status(state, now = new Date()) {
      const until = state.lockedUntil;
      if (!until || until <= now) return { locked: false, retryAfterSec: 0 };
      return { locked: true, retryAfterSec: Math.ceil((until.getTime() - now.getTime()) / 1000) };
    },
    afterFailure(state, now = new Date()) {
      // A finished lock starts a fresh count.
      const base = state.lockedUntil && state.lockedUntil <= now ? 0 : state.failedLogins;
      const failedLogins = base + 1;
      return failedLogins >= max ? { failedLogins, lockedUntil: new Date(now.getTime() + lockMs) } : { failedLogins, lockedUntil: null };
    },
    afterSuccess() {
      return { failedLogins: 0, lockedUntil: null };
    },
  };
}
