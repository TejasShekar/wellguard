import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** Persist the schedule (JSON) natively and (re)arm the Zen alarms. */
  setSchedule(scheduleJson: string): Promise<void>;
  /** Returns the persisted schedule JSON, or "" when none is set. */
  getSchedule(): Promise<string>;
  /** Remove the schedule and disengage any active session. */
  clearSchedule(): Promise<void>;
  /** True while a Zen session is currently engaged. */
  isZenActive(): Promise<boolean>;
  /** Manually engage Zen for a fixed duration using the saved allowlist (dev/test + demo). */
  startZenNow(durationMinutes: number): Promise<void>;
  /** End the active Zen session now. */
  endZenNow(): Promise<void>;
  /** Package name of the default browser, or "" if none resolves. */
  getDefaultBrowserPackage(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Zen');
