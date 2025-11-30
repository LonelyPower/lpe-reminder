<script setup lang="ts">
import { ref, computed } from "vue";

interface Props {
  modelValue: string;
  mode: "countdown" | "stopwatch";
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

// 倒计时预设分类
const countdownCategories = [
  { value: "work", label: "工作", icon: "💼" },
  { value: "entertainment", label: "娱乐", icon: "🎮" },
];

// 正计时自定义分类（可扩展）
const customCategories = ref<Array<{ value: string; label: string; icon: string }>>([
  { value: "work", label: "工作", icon: "💼" },
  { value: "study", label: "学习", icon: "📚" },
  { value: "entertainment", label: "娱乐", icon: "🎮" },
  { value: "exercise", label: "运动", icon: "🏃" },
  { value: "reading", label: "阅读", icon: "📖" },
  { value: "meeting", label: "会议", icon: "👥" },
]);

const categories = computed(() => {
  return props.mode === "countdown" ? countdownCategories : customCategories.value;
});

const selectedCategory = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

function handleSelect(value: string) {
  selectedCategory.value = value;
}
</script>

<template>
  <div class="category-selector">
    <div class="category-grid">
      <button
        v-for="cat in categories"
        :key="cat.value"
        type="button"
        class="category-item"
        :class="{ active: selectedCategory === cat.value }"
        @click="handleSelect(cat.value)"
      >
        <span class="category-icon">{{ cat.icon }}</span>
        <span class="category-label">{{ cat.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.category-selector {
  width: 100%;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 12px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  min-height: 90px;
}

.category-item:hover {
  border-color: var(--primary-color);
  background: var(--bg-hover);
  transform: translateY(-2px);
}

.category-item.active {
  border-color: var(--primary-color);
  background: var(--primary-color);
  color: #ffffff;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.category-icon {
  font-size: 28px;
  line-height: 1;
}

.category-label {
  font-size: 14px;
  font-weight: 500;
  text-align: center;
}
</style>
