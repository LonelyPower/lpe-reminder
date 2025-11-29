<script setup lang="ts">
import { computed } from "vue";

interface Props {
  visible: boolean;
  x: number;
  y: number;
  mode: "idle" | "work" | "break";
  isRunning: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "start"): void;
  (e: "pause"): void;
  (e: "reset"): void;
  (e: "settings"): void;
  (e: "close"): void;
}>();

const menuItems = computed(() => {
  if (props.mode === "idle") {
    return [
      { label: "开始工作", action: "start" },
      { label: "设置", action: "settings" },
    ];
  } else if (props.mode === "work") {
    return [
      props.isRunning 
        ? { label: "暂停", action: "pause" }
        : { label: "继续", action: "start" },
      { label: "重置", action: "reset" },
      { label: "设置", action: "settings" },
    ];
  } else {
    // break 模式
    return [
      { label: "跳过休息", action: "reset" },
      { label: "设置", action: "settings" },
    ];
  }
});

function handleClick(action: string) {
  emit(action as any);
  emit("close");
}
</script>

<template>
  <teleport to="body">
    <div
      v-if="props.visible"
      class="context-menu-backdrop"
      @click="emit('close')"
      @contextmenu.prevent="emit('close')"
    >
      <div
        class="context-menu"
        :style="{ left: `${props.x}px`, top: `${props.y}px` }"
        @click.stop
      >
        <div
          v-for="item in menuItems"
          :key="item.action"
          class="menu-item"
          @click="handleClick(item.action)"
        >
          {{ item.label }}
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.context-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  /* 透明背景，只用于捕获点击事件 */
}

.context-menu {
  position: fixed;
  min-width: 140px;
  background: var(--bg-card);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  padding: 4px 0;
  z-index: 10001;
  border: 1px solid var(--border-color);
}

.menu-item {
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.15s;
}

.menu-item:hover {
  background: var(--bg-hover);
}

.menu-item:first-child {
  border-radius: 8px 8px 0 0;
}

.menu-item:last-child {
  border-radius: 0 0 8px 8px;
}
</style>
