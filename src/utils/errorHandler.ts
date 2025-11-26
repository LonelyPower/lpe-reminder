import { invoke } from "@tauri-apps/api/core";

/**
 * 安全调用 Tauri 命令，自动捕获并记录错误
 * @param command 命令名称
 * @param args 命令参数
 * @returns 命令执行结果，失败时返回 null
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`[Tauri] Command "${command}" failed:`, error);
    return null;
  }
}

/**
 * 安全执行异步函数，捕获并记录错误
 * @param fn 要执行的异步函数
 * @param context 错误上下文描述
 * @returns 函数执行结果，失败时返回 null
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[Error] ${context}:`, error);
    return null;
  }
}

/**
 * 安全执行同步函数，捕获并记录错误
 * @param fn 要执行的同步函数
 * @param context 错误上下文描述
 * @returns 函数执行结果，失败时返回 null
 */
export function safeSyncExecute<T>(
  fn: () => T,
  context: string
): T | null {
  try {
    return fn();
  } catch (error) {
    console.error(`[Error] ${context}:`, error);
    return null;
  }
}

/**
 * 创建一个带错误边界的异步函数包装器
 * @param fn 原始函数
 * @param context 错误上下文
 * @param fallback 失败时的回退值
 * @returns 包装后的函数
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string,
  fallback?: any
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`[Error] ${context}:`, error);
      return fallback;
    }
  }) as T;
}
