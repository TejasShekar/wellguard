import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  sendSms(phoneNumber: string, message: string): Promise<void>;
  hasSmsPermission(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Sms');
