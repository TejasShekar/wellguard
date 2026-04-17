import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  startCycle(packageName: string): Promise<void>;
  stopCycle(packageName: string): Promise<void>;
  isRunning(packageName: string): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('TimerService');
