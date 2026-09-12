import type {
  RegionLifecycle,
  RegionEvent,
  RegionTimingConfig,
} from '../artwork/artworkTypes';
import { DEFAULT_TIMING } from '../artwork/artworkTypes';

/** Internal state for the state machine */
interface InternalState {
  regionId: string | null;
  lifecycle: RegionLifecycle;
  /** Timestamp when the current lifecycle state was entered */
  since: number;
  /** Timestamp when the last ACTIVE period ended (for cooldown) */
  lastExitAt: number;
}

/**
 * Region state machine (spec §7.1).
 *
 * Lifecycle: INACTIVE → ENTER_CANDIDATE → ACTIVE → EXIT_CANDIDATE → INACTIVE
 *
 * MVP constraint: only one region can be active at a time.
 */
export class RegionStateMachine {
  private state: InternalState;
  private config: RegionTimingConfig;

  constructor(config: Partial<RegionTimingConfig> = {}) {
    this.config = { ...DEFAULT_TIMING, ...config };
    this.state = {
      regionId: null,
      lifecycle: 'INACTIVE',
      since: 0,
      lastExitAt: 0,
    };
  }

  /** Current active region ID, or null */
  get activeRegionId(): string | null {
    return this.state.lifecycle === 'ACTIVE' || this.state.lifecycle === 'EXIT_CANDIDATE'
      ? this.state.regionId
      : null;
  }

  /** Current lifecycle state */
  get lifecycle(): RegionLifecycle {
    return this.state.lifecycle;
  }

  /** Current candidate/active region ID (including candidates) */
  get currentRegionId(): string | null {
    return this.state.regionId;
  }

  /** How long (ms) we've been in the current lifecycle state */
  dwellTime(now: number): number {
    if (this.state.lifecycle === 'INACTIVE') return 0;
    return now - this.state.since;
  }

  /** Update the state machine with the current hit region. Returns emitted events. */
  update(hitRegionId: string | null, now: number): RegionEvent[] {
    const events: RegionEvent[] = [];
    const s = this.state;

    switch (s.lifecycle) {
      case 'INACTIVE': {
        if (hitRegionId) {
          // Check retrigger cooldown
          if (
            hitRegionId === s.regionId &&
            s.lastExitAt > 0 &&
            now - s.lastExitAt < this.config.retriggerCooldownMs
          ) {
            // Still in cooldown for this region — ignore
            break;
          }
          s.regionId = hitRegionId;
          s.lifecycle = 'ENTER_CANDIDATE';
          s.since = now;
        }
        break;
      }

      case 'ENTER_CANDIDATE': {
        if (hitRegionId !== s.regionId) {
          // Moved away before dwell completed
          if (hitRegionId) {
            // Switched to a different region — restart candidate
            s.regionId = hitRegionId;
            s.since = now;
          } else {
            // Left all regions
            s.lifecycle = 'INACTIVE';
            s.regionId = null;
          }
        } else if (now - s.since >= this.config.entryDwellMs) {
          // Dwell completed → activate
          s.lifecycle = 'ACTIVE';
          s.since = now;
          events.push({ type: 'enter', regionId: s.regionId! });
        }
        break;
      }

      case 'ACTIVE': {
        if (hitRegionId !== s.regionId) {
          // Finger left the active region
          s.lifecycle = 'EXIT_CANDIDATE';
          s.since = now;
        }
        // If still in the same region, stay ACTIVE — no event
        break;
      }

      case 'EXIT_CANDIDATE': {
        if (hitRegionId === s.regionId) {
          // Returned to the region — cancel exit
          s.lifecycle = 'ACTIVE';
          s.since = now;
        } else if (now - s.since >= this.config.exitDwellMs) {
          // Grace period expired → exit
          const exitId = s.regionId!;
          s.lifecycle = 'INACTIVE';
          s.lastExitAt = now;
          events.push({ type: 'exit', regionId: exitId });

          // If a new region is already being hit, immediately start candidate
          if (hitRegionId) {
            s.regionId = hitRegionId;
            s.lifecycle = 'ENTER_CANDIDATE';
            s.since = now;
          } else {
            s.regionId = null;
          }
        }
        break;
      }
    }

    return events;
  }

  /** Force-exit the current region and reset to INACTIVE */
  reset(): RegionEvent[] {
    const events: RegionEvent[] = [];
    if (
      this.state.regionId &&
      (this.state.lifecycle === 'ACTIVE' || this.state.lifecycle === 'EXIT_CANDIDATE')
    ) {
      events.push({ type: 'exit', regionId: this.state.regionId });
    }
    this.state = {
      regionId: null,
      lifecycle: 'INACTIVE',
      since: 0,
      lastExitAt: 0,
    };
    return events;
  }

  /** Update timing config at runtime */
  setConfig(partial: Partial<RegionTimingConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** Get current config (for debug display) */
  getConfig(): Readonly<RegionTimingConfig> {
    return { ...this.config };
  }
}
