<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getUserPhone, updateUserPhone, getDeviceId, saveSettingsBatch, addTimerRecord, addCustomCategory } from "../utils/database";
import { exportUserData, importUserData, validateImportData, getImportSummary, ExportData } from "../utils/importExport";
import { message, confirm } from '@tauri-apps/plugin-dialog';

const phone = ref("");
const deviceId = ref("");
const isSaving = ref(false);
const isExporting = ref(false);
const isImporting = ref(false);

onMounted(async () => {
  // 加载设备 ID
  deviceId.value = await getDeviceId();
  
  // 加载手机号
  const userPhone = await getUserPhone();
  if (userPhone) {
    phone.value = userPhone;
  }
});

async function savePhone() {
  isSaving.value = true;
  try {
    await updateUserPhone(phone.value || null);
    await message("手机号保存成功！", { title: "成功", kind: "info" });
  } catch (error) {
    console.error("Failed to save phone:", error);
    await message("保存失败，请重试", { title: "错误", kind: "error" });
  } finally {
    isSaving.value = false;
  }
}

async function handleExport() {
  isExporting.value = true;
  try {
    const success = await exportUserData();
    if (success) {
      await message("数据导出成功！", { title: "成功", kind: "info" });
    }
  } catch (error) {
    console.error("Export failed:", error);
    await message(`导出失败: ${error}`, { title: "错误", kind: "error" });
  } finally {
    isExporting.value = false;
  }
}

async function handleImport() {
  isImporting.value = true;
  try {
    // 1. 选择并读取文件
    const importData = await importUserData();
    if (!importData) {
      isImporting.value = false;
      return; // 用户取消了选择
    }

    // 2. 验证数据
    const validation = validateImportData(importData);
    if (!validation.valid) {
      await message(`导入数据无效:\n${validation.errors.join('\n')}`, { title: "错误", kind: "error" });
      isImporting.value = false;
      return;
    }

    // 3. 显示摘要并确认
    const summary = getImportSummary(importData);
    const confirmed = await confirm(
      `即将导入以下数据:\n\n${summary}\n\n警告: 导入会覆盖当前的设置，记录和分类会合并。是否继续？`,
      { title: "确认导入", kind: "warning" }
    );

    if (!confirmed) {
      isImporting.value = false;
      return;
    }

    // 4. 执行导入
    await performImport(importData);

    await message("数据导入成功！请重启应用以应用所有更改。", { title: "成功", kind: "info" });
  } catch (error) {
    console.error("Import failed:", error);
    await message(`导入失败: ${error}`, { title: "错误", kind: "error" });
  } finally {
    isImporting.value = false;
  }
}

async function performImport(data: ExportData) {
  // 导入设置
  if (data.settings) {
    const settingsArray: Array<[string, string]> = Object.entries(data.settings).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value)
    ]);
    await saveSettingsBatch(settingsArray);
  }

  // 导入记录
  if (data.records && Array.isArray(data.records)) {
    for (const record of data.records) {
      try {
        await addTimerRecord({
          id: record.id,
          record_type: record.record_type,
          mode: record.mode,
          name: record.name,
          category: record.category,
          start_time: record.start_time,
          end_time: record.end_time,
          duration: record.duration,
          created_at: record.created_at,
        });
      } catch (error) {
        console.warn("Failed to import record:", record.id, error);
      }
    }
  }

  // 导入自定义分类
  if (data.categories && Array.isArray(data.categories)) {
    for (const category of data.categories) {
      try {
        await addCustomCategory(category.value, category.label, category.icon);
      } catch (error) {
        console.warn("Failed to import category:", category.value, error);
      }
    }
  }
}

function formatDeviceId(id: string): string {
  if (id.length > 20) {
    return id.substring(0, 10) + "..." + id.substring(id.length - 10);
  }
  return id;
}
</script>

<template>
  <div class="user-info-section">
    <h3 class="section-title">用户信息</h3>
    
    <div class="info-row">
      <label class="info-label">设备标识</label>
      <div class="device-id" :title="deviceId">
        {{ formatDeviceId(deviceId) }}
      </div>
    </div>
    
    <div class="info-row">
      <label class="info-label">手机号（可选）</label>
      <input
        v-model="phone"
        type="tel"
        placeholder="请输入手机号"
        class="phone-input"
        maxlength="11"
      />
    </div>
    
    <button 
      type="button" 
      class="save-btn"
      :disabled="isSaving"
      @click="savePhone"
    >
      {{ isSaving ? "保存中..." : "保存手机号" }}
    </button>

    <div class="divider"></div>

    <h3 class="section-title">数据管理</h3>
    
    <div class="action-buttons">
      <button 
        type="button" 
        class="action-btn export-btn"
        :disabled="isExporting"
        @click="handleExport"
      >
        <span class="icon">📤</span>
        {{ isExporting ? "导出中..." : "导出数据" }}
      </button>

      <button 
        type="button" 
        class="action-btn import-btn"
        :disabled="isImporting"
        @click="handleImport"
      >
        <span class="icon">📥</span>
        {{ isImporting ? "导入中..." : "导入数据" }}
      </button>
    </div>

    <div class="info-text">
      导出包含: 所有设置、工作记录、自定义分类
    </div>
  </div>
</template>

<style scoped>
.user-info-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
}

.info-row {
  margin-bottom: 16px;
}

.info-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.device-id {
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 13px;
  font-family: 'Courier New', monospace;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

.phone-input {
  width: 100%;
  max-width: 280px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
  background: var(--bg-card);
  color: var(--text-primary);
  box-sizing: border-box;
}

.phone-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--shadow-color);
}

.save-btn {
  width: 100%;
  padding: 10px 16px;
  background: var(--primary-color);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--primary-hover);
  box-shadow: 0 4px 12px var(--shadow-color);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.divider {
  height: 1px;
  background: var(--border-color);
  margin: 24px 0;
}

.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-card);
  color: var(--text-primary);
}

.action-btn .icon {
  font-size: 18px;
}

.export-btn:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: var(--bg-secondary);
}

.import-btn:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: var(--bg-secondary);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.info-text {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
}
</style>
