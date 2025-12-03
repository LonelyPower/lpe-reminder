import { ref, watch, type Ref } from "vue";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { saveSetting } from "../utils/database";
import type { AppSettings } from "./useSettingsDB";

/**
 * 窗口状态管理
 * - 监听 tab 切换自动调整窗口尺寸
 * - 保存/恢复窗口位置和大小
 * - 处理设置对话框打开时的临时宽度调整
 */
export function useWindowState(
  activeTab: Ref<"timer" | "statistics">,
  settings: AppSettings
) {
  const tempWindowWidth = ref<number | undefined>(undefined);

  /**
   * 保存窗口状态（尺寸和位置）
   */
  async function saveWindowState(savePosition: boolean = true): Promise<void> {
    const appWindow = getCurrentWindow();
    try {
      const size = await appWindow.innerSize();
      const factor = await appWindow.scaleFactor();
      const logicalSize = size.toLogical(factor);

      // 根据当前选项卡保存对应的窗口尺寸
      if (activeTab.value === "timer") {
        settings.timerWindowWidth = logicalSize.width;
        settings.timerWindowHeight = logicalSize.height;
        await saveSetting("timerWindowWidth", logicalSize.width.toString());
        await saveSetting("timerWindowHeight", logicalSize.height.toString());
        console.log(
          `Saved timer window size: ${logicalSize.width}x${logicalSize.height}`
        );
      } else {
        settings.statisticsWindowWidth = logicalSize.width;
        settings.statisticsWindowHeight = logicalSize.height;
        await saveSetting("statisticsWindowWidth", logicalSize.width.toString());
        await saveSetting("statisticsWindowHeight", logicalSize.height.toString());
        console.log(
          `Saved statistics window size: ${logicalSize.width}x${logicalSize.height}`
        );
      }

      // 保存窗口位置（如果需要）
      if (savePosition) {
        const position = await appWindow.innerPosition();
        const logicalPosition = position.toLogical(factor);
        settings.windowX = logicalPosition.x;
        settings.windowY = logicalPosition.y;
        await saveSetting("windowX", logicalPosition.x.toString());
        await saveSetting("windowY", logicalPosition.y.toString());
      }
    } catch (e) {
      console.error("Failed to save window state", e);
    }
  }

  /**
   * 打开设置对话框时调整窗口宽度为 500px
   */
  async function handleSettingsOpen(): Promise<void> {
    const appWindow = getCurrentWindow();
    try {
      const size = await appWindow.innerSize();
      const factor = await appWindow.scaleFactor();
      const logicalSize = size.toLogical(factor);

      // 保存当前宽度以便恢复
      if (!tempWindowWidth.value) {
        tempWindowWidth.value = logicalSize.width;
      }

      // 设置新宽度为 500px
      await appWindow.setSize(new LogicalSize(500, logicalSize.height));
    } catch (e) {
      console.error("Failed to resize window for settings", e);
    }
  }

  /**
   * 关闭设置对话框时恢复原窗口宽度
   */
  async function handleSettingsClose(): Promise<void> {
    const appWindow = getCurrentWindow();
    try {
      if (tempWindowWidth.value) {
        const size = await appWindow.innerSize();
        const factor = await appWindow.scaleFactor();
        const logicalSize = size.toLogical(factor);

        // 恢复原宽度
        await appWindow.setSize(
          new LogicalSize(tempWindowWidth.value, logicalSize.height)
        );
        tempWindowWidth.value = undefined;
      }
    } catch (e) {
      console.error("Failed to restore window size", e);
    }
  }

  /**
   * 监听选项卡切换，自动调整窗口大小
   */
  function setupTabSwitchWatcher(): () => void {
    return watch(activeTab, async (newTab, oldTab) => {
      const appWindow = getCurrentWindow();
      try {
        // 先保存旧选项卡的窗口尺寸（不保存位置）
        if (oldTab) {
          const size = await appWindow.innerSize();
          const factor = await appWindow.scaleFactor();
          const logicalSize = size.toLogical(factor);

          if (oldTab === "timer") {
            settings.timerWindowWidth = logicalSize.width;
            settings.timerWindowHeight = logicalSize.height;
            await saveSetting("timerWindowWidth", logicalSize.width.toString());
            await saveSetting("timerWindowHeight", logicalSize.height.toString());
            console.log(
              `Saved timer window size: ${logicalSize.width}x${logicalSize.height}`
            );
          } else {
            settings.statisticsWindowWidth = logicalSize.width;
            settings.statisticsWindowHeight = logicalSize.height;
            await saveSetting(
              "statisticsWindowWidth",
              logicalSize.width.toString()
            );
            await saveSetting(
              "statisticsWindowHeight",
              logicalSize.height.toString()
            );
            console.log(
              `Saved statistics window size: ${logicalSize.width}x${logicalSize.height}`
            );
          }
        }

        // 然后切换到目标选项卡的窗口尺寸
        if (newTab === "statistics") {
          const width = settings.statisticsWindowWidth ?? 800;
          const height = settings.statisticsWindowHeight ?? 600;
          console.log(`Switching to statistics, size: ${width}x${height}`);
          await appWindow.setSize(new LogicalSize(width, height));
        } else {
          const width = settings.timerWindowWidth ?? 450;
          const height = settings.timerWindowHeight ?? 550;
          console.log(`Switching to timer, size: ${width}x${height}`);
          await appWindow.setSize(new LogicalSize(width, height));
        }
      } catch (e) {
        console.error("Failed to resize window on tab change", e);
      }
    });
  }

  return {
    tempWindowWidth,
    saveWindowState,
    handleSettingsOpen,
    handleSettingsClose,
    setupTabSwitchWatcher,
  };
}
