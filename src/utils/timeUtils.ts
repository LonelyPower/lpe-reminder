/**
 * 将分钟和秒转换为毫秒
 * @param minutes 分钟数
 * @param seconds 秒数
 * @returns 总毫秒数
 */
export function minutesSecondsToMs(minutes: number, seconds: number): number {
  return (minutes * 60 + seconds) * 1000;
}

/**
 * 将毫秒转换为分钟和秒
 * @param ms 毫秒数
 * @returns 包含分钟和秒的对象
 */
export function msToMinutesSeconds(ms: number): { minutes: number; seconds: number } {
  const totalSeconds = Math.floor(ms / 1000);
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * 格式化时间显示 (mm:ss)
 * @param ms 毫秒数
 * @returns 格式化的时间字符串
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
