import { ref, watch, type Ref } from "vue";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { saveSetting } from "../utils/database";
import type { AppSettings } from "./useSettingsDB";

/**
 * 窗口状态管理
 * - 监听 tab 切换自动调整窗口尺寸
 * - 保存/恢复窗口位置和大小
 * - 处理对话框打开时的临时窗口尺寸调整
 */
export function useWindowState(
  activeTab: Ref<"timer" | "statistics">,
  settings: AppSettings
) {
  const tempWindowSize = ref<{ width: number; height: number } | undefined>(undefined);

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
   * 打开对话框时调整窗口大小以确保对话框完整显示
   * @param requiredWidth 对话框所需的最小宽度（像素）
   * @param requiredHeight 对话框所需的最小高度（像素，可选）
   */
  async function handleDialogOpen(requiredWidth: number, requiredHeight?: number): Promise<void> {
    const appWindow = getCurrentWindow();
    try {
      const size = await appWindow.innerSize();
      const factor = await appWindow.scaleFactor();
      const logicalSize = size.toLogical(factor);

      // 保存当前尺寸以便恢复（只在首次保存）
      if (!tempWindowSize.value) {
        tempWindowSize.value = {
          width: logicalSize.width,
          height: logicalSize.height,
        };
      }

      // 计算需要的尺寸（对话框尺寸 + padding + 边框等，留50px余量）
      const newWidth = Math.max(logicalSize.width, requiredWidth + 50);
      const newHeight = requiredHeight 
        ? Math.max(logicalSize.height, requiredHeight + 50)
        : logicalSize.height;

      // 只在需要时调整窗口大小
      if (newWidth !== logicalSize.width || newHeight !== logicalSize.height) {
        await appWindow.setSize(new LogicalSize(newWidth, newHeight));
        console.log(`Adjusted window size for dialog: ${newWidth}x${newHeight}`);
      }
    } catch (e) {
      console.error("Failed to resize window for dialog", e);
    }
  }

  /**
   * 打开设置对话框（兼容旧接口）
   */
  async function handleSettingsOpen(): Promise<void> {
    // 设置对话框：450px 宽 x 550px 高
    await handleDialogOpen(450, 550);
  }

  /**
   * 关闭对话框时恢复原窗口尺寸
   */
  async function handleDialogClose(): Promise<void> {
    const appWindow = getCurrentWindow();
    try {
      if (tempWindowSize.value) {
        // 恢复原尺寸
        await appWindow.setSize(
          new LogicalSize(tempWindowSize.value.width, tempWindowSize.value.height)
        );
        console.log(`Restored window size: ${tempWindowSize.value.width}x${tempWindowSize.value.height}`);
        tempWindowSize.value = undefined;
      }
    } catch (e) {
      console.error("Failed to restore window size", e);
    }
  }

  /**
   * 关闭设置对话框（兼容旧接口）
   */
  async function handleSettingsClose(): Promise<void> {
    await handleDialogClose();
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
    tempWindowSize,
    saveWindowState,
    handleDialogOpen,
    handleDialogClose,
    handleSettingsOpen,
    handleSettingsClose,
    setupTabSwitchWatcher,
  };
}
