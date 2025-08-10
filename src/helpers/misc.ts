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
      timeoutId = window.setTimeout(() => {
        lastExecuted = Date.now();
        func(...args);
      }, delay - (now - lastExecuted));
    }
  }) as T;
}