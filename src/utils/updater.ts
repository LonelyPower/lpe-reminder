import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';

/**
 * 检查应用更新
 * @param silent 是否静默检查（不显示"已是最新版本"的提示）
 */
export async function checkForUpdates(silent = false): Promise<void> {
  try {
    // 获取当前版本
    // const currentVersion = await getVersion();
    // console.log('[更新检查] ==================== 开始检查更新 ====================');
    // console.log('[更新检查] 当前版本:', currentVersion);
    // console.log('[更新检查] 检查目标: https://github.com/LonelyPower/lpe-reminder/releases/latest/download/latest.json');
    // console.log('[更新检查] 时间:', new Date().toLocaleString('zh-CN'));
    
    const update = await check();
    
    // console.log('[更新检查] 检查结果:', update ? '发现新版本 ✓' : '已是最新版本 ✓');
    // if (update) {
    //   console.log('[更新检查] 最新版本:', update.version);
    //   console.log('[更新检查] 当前版本:', update.currentVersion);
    //   console.log('[更新检查] 更新日期:', update.date);
    //   console.log('[更新检查] 更新说明:', update.body || '无');
    // }
    // console.log('[更新检查] ==================== 检查完成 ====================');
    
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
        console.log('[更新检查] 用户同意更新，开始下载...');
        await message('正在下载更新，请稍候...', {
          title: '下载中',
          kind: 'info',
        });

        // 下载并安装更新
        // console.log('[更新检查] 正在下载并安装更新...');
        await update.downloadAndInstall();
        // console.log('[更新检查] 下载完成！');

        // 提示重启
        const shouldRelaunch = await ask(
          '更新已完成！是否立即重启应用以应用更新？',
          {
            title: '更新完成',
            kind: 'info',
          }
        );

        if (shouldRelaunch) {
          console.log('[更新检查] 用户选择立即重启应用');
          await relaunch();
        } else {
          console.log('[更新检查] 用户选择稍后重启');
        }
      } else {
        console.log('[更新检查] 用户取消更新');
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
    console.error('[更新检查] 检查更新失败:', error);
    console.error('[更新检查] 错误详情:', JSON.stringify(error, null, 2));
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
  console.log('[更新检查] 启动后自动检查更新（2秒后执行）');
  // 等待 2 秒后再检查，避免影响启动速度
  setTimeout(() => {
    checkForUpdates(true);
  }, 2000);
}
