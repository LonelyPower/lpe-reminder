import { watch } from "vue";
import type { AppSettings } from "./useSettingsDB";

/**
 * 主题管理
 * - 监听 settings.theme 变化切换主题
 * - 监听系统主题变化（仅在 system 模式下）
 * - 应用主题到 document.documentElement
 */
export function useTheme(settings: AppSettings) {
  /**
   * 应用主题到 DOM
   */
  function applyTheme(theme: "light" | "dark" | "system"): void {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // System theme
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }

  /**
   * 设置主题监听器
   * 返回停止函数
   */
  function setupThemeWatcher(): () => void {
    // 监听设置中的主题变化
    const stopWatch = watch(
      () => settings.theme,
      (newTheme) => {
        applyTheme(newTheme);
      },
      { immediate: true }
    );

    // 监听系统主题变化
    let mediaQueryList: MediaQueryList | null = null;
    let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

    if (window.matchMedia) {
      mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQueryListener = (e: MediaQueryListEvent) => {
        if (settings.theme === "system") {
          if (e.matches) {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }
      };
      mediaQueryList.addEventListener("change", mediaQueryListener);
    }

    // 返回清理函数
    return () => {
      stopWatch();
      if (mediaQueryList && mediaQueryListener) {
        mediaQueryList.removeEventListener("change", mediaQueryListener);
      }
    };
  }

  return {
    setupThemeWatcher,
  };
}
