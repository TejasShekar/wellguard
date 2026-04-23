import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type InstalledApp = {
  packageName: string;
  appName: string;
  isSystem: boolean;
};

export interface Spec extends TurboModule {
  isDeviceOwner(): Promise<boolean>;
  clearDeviceOwner(): Promise<void>;
  setPackagesSuspended(
    packageNames: string[],
    suspended: boolean,
  ): Promise<string[]>;
  getInstalledUserApps(): Promise<InstalledApp[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('DevicePolicy');
