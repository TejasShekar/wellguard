import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  isDeviceOwner(): Promise<boolean>;
  clearDeviceOwner(): Promise<void>;
  setPackagesSuspended(
    packageNames: string[],
    suspended: boolean,
  ): Promise<string[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('DevicePolicy');
