import { ref } from "vue";
import { getCurrentWindow, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { initDatabase, migrateFromLocalStorage } from "../utils/database";
import { preloadAudio } from "../utils/audioPlayer";
import { generateTestData } from "../utils/generateTestData";
import type { AppSettings } from "./useSettingsDB";

/**
 * 应用生命周期管理
 * - 数据库初始化和数据迁移
 * - 窗口状态恢复（尺寸和位置）
 * - 音频预加载
 * - 开发环境测试函数注入
 */
export function useAppLifecycle(
  settings: AppSettings,
  activeTab: { value: "timer" | "statistics" },
  initSettings: () => Promise<void>
) {
  const isReady = ref(false);

  async function initialize(): Promise<void> {
    const appWindow = getCurrentWindow();

    try {
      // 1. 初始化数据库
      await initDatabase();
      console.log("✓ Database initialized");

      // 2. 检查是否需要从 localStorage 迁移数据
      const hasOldData =
        localStorage.getItem("lpe-reminder-settings") ||
        localStorage.getItem("lpe-reminder-history");
      if (hasOldData) {
        console.log("Found old localStorage data, starting migration...");
        await migrateFromLocalStorage();
      }

      // 3. 等待设置加载完成（解决竞态问题）
      await initSettings();
      console.log("✓ Settings loaded and ready");

      // 4. 恢复窗口尺寸和位置
      const savedWidth =
        activeTab.value === "timer"
          ? settings.timerWindowWidth || 450
          : settings.statisticsWindowWidth || 800;
      const savedHeight =
        activeTab.value === "timer"
          ? settings.timerWindowHeight || 550
          : settings.statisticsWindowHeight || 600;
      const savedX = settings.windowX;
      const savedY = settings.windowY;

      console.log(
        `Restoring ${activeTab.value} window size to ${savedWidth}x${savedHeight}`
      );
      try {
        await appWindow.setSize(new LogicalSize(savedWidth, savedHeight));
      } catch (e) {
        console.error("Failed to restore window size", e);
      }

      if (savedX !== undefined && savedY !== undefined) {
        console.log(`Restoring window position to (${savedX}, ${savedY})`);
        try {
          await appWindow.setPosition(new LogicalPosition(savedX, savedY));
        } catch (e) {
          console.error("Failed to restore window position", e);
        }
      }

      // 恢复完成后显示窗口（避免闪现）
      console.log("✓ Window state restored, showing window");
      await appWindow.show();

      isReady.value = true;
    } catch (error) {
      console.error("Application initialization failed:", error);
      // 即使出错也要显示窗口
      await appWindow.show();
      isReady.value = true;
    }

    // 预加载音频文件
    preloadAudio(["/notification-piano.mp3", "/notification-chime.mp3"]);

    // 开发环境：暴露测试数据生成函数到全局
    if (import.meta.env.DEV) {
      (window as any).generateTestData = async () => {
        console.log("开始生成测试数据...");
        try {
          await generateTestData();
          console.log("测试数据生成完成！请刷新或切换标签页查看。");
        } catch (error) {
          console.error("生成测试数据失败:", error);
        }
      };
      console.log("💡 开发提示: 在控制台输入 generateTestData() 来生成测试数据");
    }
  }

  return {
    isReady,
    initialize,
  };
}
