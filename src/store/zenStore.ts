import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import type { StateStorage } from 'zustand/middleware';
import { createJSONStorage, persist } from 'zustand/middleware';

import Zen from '../modules/Zen';

/** Mirrors the Kotlin ZenSchedule JSON shape exactly. */
export type ZenSchedule = {
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  daysOfWeek: number[]; // 0=Sun..6=Sat; [] means every day
  allowedPackages: string[];
  allowBrowser: boolean;
  isActive: boolean;
};

type ZenStoreState = {
  schedule: ZenSchedule | null;
  _setLocal: (schedule: ZenSchedule | null) => void;
};

const storage = createMMKV({ id: 'wellguard-zen' });

const mmkvStorage: StateStorage = {
  getItem: name => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: name => {
    storage.remove(name);
  },
};

/**
 * UI-side persistence for the Zen schedule. The native layer is the enforcement
 * source of truth (via Zen.setSchedule); this store just hydrates the editor.
 */
export const useZenStore = create<ZenStoreState>()(
  persist(
    set => ({
      schedule: null,
      _setLocal: schedule => set({ schedule }),
    }),
    { name: 'zenSchedule/v1', storage: createJSONStorage(() => mmkvStorage) },
  ),
);

/** Persist locally AND push to the native enforcement layer. */
export async function saveZenSchedule(schedule: ZenSchedule): Promise<void> {
  useZenStore.getState()._setLocal(schedule);
  await Zen.setSchedule(JSON.stringify(schedule));
}

export async function clearZenSchedule(): Promise<void> {
  useZenStore.getState()._setLocal(null);
  await Zen.clearSchedule();
}
