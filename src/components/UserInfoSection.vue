<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getUserPhone, updateUserPhone, getDeviceId } from "../utils/database";

const phone = ref("");
const deviceId = ref("");
const isSaving = ref(false);

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
    alert("手机号保存成功！");
  } catch (error) {
    console.error("Failed to save phone:", error);
    alert("保存失败，请重试");
  } finally {
    isSaving.value = false;
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
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
  background: var(--bg-card);
  color: var(--text-primary);
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
</style>
