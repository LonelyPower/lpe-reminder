/**
 * 播放音频文件的工具函数
 * @param audioPath 音频文件路径 (相对于 public 目录)
 * @param volume 音量 (0.0 - 1.0)
 * @returns Promise<void>
 */
export async function playAudio(
  audioPath: string,
  volume: number = 0.5
): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.volume = Math.max(0, Math.min(1, volume)); // 限制在 0-1 范围

    // 错误处理
    const handleError = (error: Event | string | Error) => {
      console.error(`[Audio] Failed to play ${audioPath}:`, error);
      cleanup();
      // 不 reject，避免阻塞主流程，只是打印错误
      resolve(); 
    };

    // 清理函数
    const cleanup = () => {
      audio.removeEventListener("canplaythrough", handleCanPlay);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
      audio.src = "";
    };

    // 音频可以播放
    const handleCanPlay = async () => {
      try {
        console.log(`[Audio] Playing ${audioPath}...`);
        await audio.play();
        console.log(`[Audio] ${audioPath} started`);
      } catch (error) {
        handleError(error as Error);
      }
    };

    // 播放结束
    const handleEnded = () => {
      console.log(`[Audio] ${audioPath} finished`);
      cleanup();
      resolve();
    };

    // 注册事件监听器
    audio.addEventListener("canplaythrough", handleCanPlay, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.addEventListener("ended", handleEnded, { once: true });

    // 设置源，开始加载
    audio.src = audioPath;
    audio.load();
  });
}

/**
 * 预加载音频文件
 * @param audioPaths 音频文件路径数组
 */
export function preloadAudio(audioPaths: string[]): void {
  audioPaths.forEach((path) => {
    const audio = new Audio(path);
    audio.preload = "auto";
    audio.load();
    console.log(`[Audio] Preloaded ${path}`);
  });
}
