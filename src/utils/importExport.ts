import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { getSettings, getTimerRecords, getCustomCategories, CustomCategory, TimerRecord } from './database';

export interface ExportData {
  version: string;
  exportTime: string;
  settings: Record<string, any>;
  records: TimerRecord[];
  categories: CustomCategory[];
}

/**
 * 导出用户数据到 JSON 文件
 */
export async function exportUserData(): Promise<boolean> {
  try {
    // 1. 收集所有数据
    const settings = await getSettings();
    const records = await getTimerRecords(1000); // 导出最近 1000 条记录
    const categories = await getCustomCategories();

    // 2. 构建导出数据
    const exportData: ExportData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      settings: settings,
      records: records,
      categories: categories,
    };

    // 3. 转换为 JSON 字符串
    const jsonContent = JSON.stringify(exportData, null, 2);

    // 4. 打开保存对话框
    const defaultFileName = `lpe-reminder-backup-${new Date().toISOString().split('T')[0]}.json`;
    const filePath = await save({
      defaultPath: defaultFileName,
      filters: [{
        name: 'JSON',
        extensions: ['json']
      }]
    });

    if (!filePath) {
      // 用户取消了保存
      return false;
    }

    // 5. 写入文件
    await writeTextFile(filePath as string, jsonContent);

    return true;
  } catch (error) {
    console.error('导出失败:', error);
    throw new Error(`导出失败: ${error}`);
  }
}

/**
 * 从 JSON 文件导入用户数据
 */
export async function importUserData(): Promise<ExportData | null> {
  try {
    // 1. 打开文件选择对话框
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'JSON',
        extensions: ['json']
      }]
    });

    if (!selected || typeof selected !== 'string') {
      // 用户取消了选择
      return null;
    }

    // 2. 读取文件内容
    const fileContent = await readTextFile(selected);

    // 3. 解析 JSON
    const importData: ExportData = JSON.parse(fileContent);

    // 4. 验证数据格式
    if (!importData.version || !importData.settings) {
      throw new Error('无效的备份文件格式');
    }

    return importData;
  } catch (error) {
    console.error('导入失败:', error);
    throw new Error(`导入失败: ${error}`);
  }
}

/**
 * 验证导入数据的有效性
 */
export function validateImportData(data: ExportData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.version) {
    errors.push('缺少版本信息');
  }

  if (!data.settings || typeof data.settings !== 'object') {
    errors.push('设置数据无效');
  }

  if (!Array.isArray(data.records)) {
    errors.push('记录数据无效');
  }

  if (!Array.isArray(data.categories)) {
    errors.push('分类数据无效');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取导入数据的摘要信息
 */
export function getImportSummary(data: ExportData): string {
  const recordCount = data.records?.length || 0;
  const categoryCount = data.categories?.length || 0;
  const exportDate = data.exportTime ? new Date(data.exportTime).toLocaleString('zh-CN') : '未知';

  return `导出时间: ${exportDate}\n设置项: ${Object.keys(data.settings || {}).length} 项\n工作记录: ${recordCount} 条\n自定义分类: ${categoryCount} 个`;
}
