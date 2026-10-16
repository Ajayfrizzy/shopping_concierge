import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytesAsync } from 'expo-crypto';
import { createGuestCredential } from './credential';
import * as FileSystem from 'expo-file-system/legacy';
import { createShoppingAPI } from './client';
import { createShoppingSession, type ShoppingSessionController } from './session';

export const guestCredential = createGuestCredential(
  {
    read: () => SecureStore.getItemAsync('shopping-guest-v1'),
    write: (value) => SecureStore.setItemAsync('shopping-guest-v1', value),
  },
  () => getRandomBytesAsync(32),
);
export const shoppingAPI = createShoppingAPI(
  process.env.EXPO_PUBLIC_API_URL ??
    (__DEV__ ? 'http://10.0.2.2:4000' : 'https://shoppingconcierge.rumptycloud.app'),
  fetch,
  40_000,
  guestCredential,
);
const Context = createContext<ShoppingSessionController | null>(null);
const journalPath = `${FileSystem.documentDirectory}shopping-session-v1.json`;
const storage = {
  async read() {
    const info = await FileSystem.getInfoAsync(journalPath);
    return info.exists ? FileSystem.readAsStringAsync(journalPath) : null;
  },
  async write(value: string) {
    const temporary = `${journalPath}.tmp`;
    await FileSystem.writeAsStringAsync(temporary, value);
    await FileSystem.moveAsync({ from: temporary, to: journalPath });
  },
};
let sequence = 0;
export function ShoppingProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() =>
    createShoppingSession(
      shoppingAPI,
      storage,
      () => `${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`,
    ),
  );
  useEffect(() => {
    void controller.boot();
  }, [controller]);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useShopping() {
  const controller = useContext(Context);
  if (!controller) throw new Error('ShoppingProvider missing');
  const view = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { controller, ...view };
}
