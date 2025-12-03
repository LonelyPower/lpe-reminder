import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * 检查应用更新
 * @param silent 是否静默检查（不显示"已是最新版本"的提示）
 */
export async function checkForUpdates(silent = false): Promise<void> {
  try {
    const update = await check();
    
    if (update) {
      // 发现新版本
      const yes = await ask(
        `发现新版本 ${update.version}！\n\n更新内容：\n${update.body || '无更新说明'}\n\n是否立即下载并安装？`,
        {
          title: '应用更新',
          kind: 'info',
        }
      );

      if (yes) {
        // 用户同意更新
        await message('正在下载更新，请稍候...', {
          title: '下载中',
          kind: 'info',
        });

        // 下载并安装更新
        await update.downloadAndInstall();

        // 提示重启
        const shouldRelaunch = await ask(
          '更新已完成！是否立即重启应用以应用更新？',
          {
            title: '更新完成',
            kind: 'info',
          }
        );

        if (shouldRelaunch) {
          await relaunch();
        }
      }
    } else {
      // 已是最新版本
      if (!silent) {
        await message('您已经在使用最新版本！', {
          title: '检查更新',
          kind: 'info',
        });
      }
    }
  } catch (error) {
    console.error('检查更新失败:', error);
    await message(`检查更新失败: ${error}`, {
      title: '错误',
      kind: 'error',
    });
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
