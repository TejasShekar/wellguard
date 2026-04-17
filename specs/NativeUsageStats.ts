import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type UsageRecord = {
  packageName: string;
  totalTimeInForegroundMs: number;
  lastTimeUsed: number;
};

export interface Spec extends TurboModule {
  getUsageStats(startTime: number, endTime: number): Promise<UsageRecord[]>;
  hasUsageStatsPermission(): Promise<boolean>;
  openUsageStatsSettings(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UsageStats');
