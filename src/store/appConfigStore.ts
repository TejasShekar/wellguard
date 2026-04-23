import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import type { StateStorage } from 'zustand/middleware';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppConfig = {
  packageName: string;
  appName: string;
  useWindowMinutes: number;
  freezeWindowMinutes: number;
  createdAt: number;
  updatedAt: number;
};

export type AppConfigInput = Pick<
  AppConfig,
  'packageName' | 'appName' | 'useWindowMinutes' | 'freezeWindowMinutes'
>;

type AppConfigState = {
  configs: Record<string, AppConfig>;
  upsert: (input: AppConfigInput) => void;
  remove: (packageName: string) => void;
};

const storage = createMMKV({ id: 'wellguard-config' });

const mmkvStorage: StateStorage = {
  getItem: name => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: name => {
    storage.remove(name);
  },
};

export const useAppConfigStore = create<AppConfigState>()(
  persist(
    set => ({
      configs: {},
      upsert: input =>
        set(state => {
          const now = Date.now();
          const existing = state.configs[input.packageName];
          return {
            configs: {
              ...state.configs,
              [input.packageName]: {
                ...input,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
              },
            },
          };
        }),
      remove: packageName =>
        set(state => {
          if (!(packageName in state.configs)) return state;
          const next = { ...state.configs };
          delete next[packageName];
          return { configs: next };
        }),
    }),
    {
      name: 'appConfigs/v1',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

