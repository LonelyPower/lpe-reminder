import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { emit } from '@tauri-apps/api/event';

export interface UpdateInfo {
  available: boolean;
  version?: string;
  currentVersion?: string;
  body?: string;
  date?: string;
}

export interface UpdateState {
  type: 'found' | 'latest' | 'downloading' | 'complete' | 'error';
  info?: UpdateInfo;
  error?: string;
}

let currentUpdate: Update | null = null;

/**
 * 检查应用更新
 * @param silent 是否静默检查（不显示"已是最新版本"的提示）
 * @returns UpdateInfo 更新信息
 */
export async function checkForUpdates(silent = false): Promise<UpdateInfo | null> {
  try {
    const currentVersion = await getVersion();
    const update = await check();
    
    if (update) {
      // 发现新版本
      currentUpdate = update;
      const updateInfo: UpdateInfo = {
        available: true,
        version: update.version,
        currentVersion: update.currentVersion,
        body: update.body || '暂无更新说明',
        date: update.date,
      };
      
      // 发送事件通知前端
      await emit('update-found', updateInfo);
      return updateInfo;
    } else {
      // 已是最新版本
      if (!silent) {
        await emit('update-latest', { available: false, currentVersion });
      }
      return null;
    }
  } catch (error) {
    console.error('[更新检查] 检查更新失败:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    await emit('update-error', { error: errorMsg });
    return null;
  }
}

/**
 * 下载并安装更新
 */
export async function downloadAndInstallUpdate(): Promise<boolean> {
  if (!currentUpdate) {
    console.error('[更新检查] 没有可用的更新');
    await emit('update-error', { error: '没有可用的更新' });
    return false;
  }

  try {
    // 通知开始下载
    await emit('update-downloading', {});
    
    // 下载并安装更新
    await currentUpdate.downloadAndInstall();
    
    // 通知下载完成
    await emit('update-complete', {});
    return true;
  } catch (error) {
    console.error('[更新检查] 下载更新失败:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    await emit('update-error', { error: `下载失败: ${errorMsg}` });
    return false;
  }
}

/**
 * 重启应用
 */
export async function relaunchApp(): Promise<void> {
  try {
    await relaunch();
  } catch (error) {
    console.error('[更新检查] 重启应用失败:', error);
  }
}

/**
 * 在应用启动时自动检查更新（静默）
 */
export async function checkUpdatesOnStartup(): Promise<void> {
  // 等待 2 秒后再检查，避免影响启动速度
  setTimeout(() => {
    checkForUpdates(true);
  }, 2000);
}
