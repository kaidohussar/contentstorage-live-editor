import { PendingChangeSimple } from '../types';

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T {
  let timeoutId: number | undefined;
  let lastExecuted = 0;

  return ((...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastExecuted >= delay) {
      lastExecuted = now;
      func(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(
        () => {
          lastExecuted = Date.now();
          func(...args);
        },
        delay - (now - lastExecuted)
      );
    }
  }) as T;
}

let cs_live_editor_pendingChanges: PendingChangeSimple[] = [];

export function setPendingChanges(changes: PendingChangeSimple[]): void {
  cs_live_editor_pendingChanges = [...changes];
}

export function getPendingChanges(): PendingChangeSimple[] {
  return [...cs_live_editor_pendingChanges];
}

export function clearPendingChanges(): void {
  cs_live_editor_pendingChanges = [];
}
