import { useSyncExternalStore } from "octane"
import { SIGNAL_BINDING_SUBSCRIBE, type SignalHandle } from "octane/signals"

/** Read a signal as a plain value in setup code (templates can read handles directly). */
export function useSignal<T>(handle: SignalHandle<T>): T {
  return useSyncExternalStore((notify) => handle[SIGNAL_BINDING_SUBSCRIBE](notify), () => handle.get())
}
