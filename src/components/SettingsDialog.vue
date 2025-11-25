<script setup lang="ts">
import { defineProps, defineEmits } from "vue";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>

<template>
  <teleport to="body">
    <div v-if="props.visible" class="backdrop">
      <div class="dialog" role="dialog" aria-modal="true">
        <header class="dialog-header">
          <h2>设置</h2>
        </header>
        <section class="dialog-body">
          <!-- 阶段0：先放占位文案，后续用真正表单替换 -->
          <p>这里将来可以配置工作/休息时长、音乐等选项。</p>
        </section>
        <footer class="dialog-footer">
          <button type="button" @click="emit('close')">关闭</button>
        </footer>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}

.dialog {
  width: min(480px, 90vw);
  border-radius: 16px;
  background: #ffffff;
  padding: 20px 20px 16px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
}

.dialog-header h2 {
  font-size: 18px;
  margin-bottom: 12px;
}

.dialog-body {
  font-size: 14px;
  color: #4b5563;
  margin-bottom: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.dialog-footer button {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.dialog-footer button:hover {
  background: #f3f4f6;
}
</style>
