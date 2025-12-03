import { ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { safeInvoke, safeExecute } from "../utils/errorHandler";
import type { AppSettings } from "./useSettingsDB";

/**
 * 窗口关闭逻辑管理
 * - 监听窗口关闭请求
 * - 根据 closeBehavior 设置执行对应操作
 * - 关闭前保存状态
 */
export function useWindowClose(
  settings: AppSettings,
  saveWindowState: () => Promise<void>,
  saveFloatingWindowPosition: (forceSaveToDb?: boolean) => Promise<void>,
  saveSettings: () => Promise<void>
) {
  const showCloseConfirm = ref(false);

  /**
   * 设置窗口关闭处理器
   */
  async function setupCloseHandler(): Promise<void> {
    const appWindow = getCurrentWindow();

    await appWindow.onCloseRequested(async (event) => {
      console.log("[CloseRequested] Triggered, behavior:", settings.closeBehavior);
      event.preventDefault(); // 始终阻止默认行为

      // 保存窗口状态
      await saveWindowState();
      // 保存悬浮窗位置
      await saveFloatingWindowPosition();

      const behavior = settings.closeBehavior;
      if (behavior === "quit") {
        console.log("[CloseRequested] Exiting app...");
        await safeInvoke("app_exit");
        console.log("[CloseRequested] App exit called");
        return;
      }
      if (behavior === "minimize") {
        console.log("[CloseRequested] Hiding window...");
        await safeExecute(async () => {
          await appWindow.hide();
          console.log("[CloseRequested] Window hidden successfully");
        }, "Hide window on close request");
        return;
      }

      // behavior === 'ask'
      console.log("[CloseRequested] Showing confirm dialog");
      showCloseConfirm.value = true;
    });
  }

  /**
   * 处理关闭确认对话框的结果
   */
  async function handleCloseConfirm(
    minimize: boolean,
    remember: boolean
  ): Promise<void> {
    console.log("[CloseConfirm] minimize:", minimize, "remember:", remember);
    showCloseConfirm.value = false;

    if (remember) {
      settings.closeBehavior = minimize ? "minimize" : "quit";
      // 立即保存关闭行为偏好
      await saveSettings();
      console.log("[CloseConfirm] Saved closeBehavior:", settings.closeBehavior);
    }

    if (minimize) {
      console.log("[CloseConfirm] Hiding window...");
      await safeExecute(async () => {
        await getCurrentWindow().hide();
        console.log("[CloseConfirm] Window hidden successfully");
      }, "Hide window on close");
    } else {
      console.log("[CloseConfirm] Exiting app...");
      await safeInvoke("app_exit");
      console.log("[CloseConfirm] App exit called");
    }
  }

  return {
    showCloseConfirm,
    setupCloseHandler,
    handleCloseConfirm,
  };
}
