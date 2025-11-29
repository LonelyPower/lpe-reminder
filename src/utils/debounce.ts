/**
 * 防抖函数 - 延迟执行，多次调用只执行最后一次
 * @param fn 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;

  return function (this: any, ...args: Parameters<T>) {
    // 清除之前的定时器
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // 设置新的定时器
    timeoutId = window.setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * 异步防抖函数 - 支持 Promise 返回值
 * @param fn 要防抖的异步函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的异步函数
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<void> {
  let timeoutId: number | null = null;

  return async function (this: any, ...args: Parameters<T>): Promise<void> {
    // 清除之前的定时器
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // 返回 Promise，在延迟后执行
    return new Promise((resolve) => {
      timeoutId = window.setTimeout(async () => {
        try {
          await fn.apply(this, args);
        } catch (error) {
          console.error('[Debounce] Error executing function:', error);
        } finally {
          timeoutId = null;
          resolve();
        }
      }, delay);
    });
  };
}
