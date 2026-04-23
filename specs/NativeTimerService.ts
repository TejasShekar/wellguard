import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  startCycle(
    packageName: string,
    useMinutes: number,
    freezeMinutes: number,
  ): Promise<void>;
  stopCycle(packageName: string): Promise<void>;
  isRunning(packageName: string): Promise<boolean>;
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('TimerService');
