<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { getCustomCategories, addCustomCategory as dbAddCategory, updateCustomCategory as dbUpdateCategory, deleteCustomCategory as dbDeleteCategory } from "../utils/database";

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

// 预设分类
const presetCategories = [
  { value: "work", label: "工作", icon: "💼" },
  { value: "study", label: "学习", icon: "📚" },
  { value: "entertainment", label: "娱乐", icon: "🎮" },
  { value: "meeting", label: "会议", icon: "👥" },
];

// 正计时自定义分类（从数据库加载）
const customCategories = ref<Array<{ value: string; label: string; icon: string }>>([]);

// 加载分类
onMounted(async () => {
  try {
    const dbCategories = await getCustomCategories();
    if (dbCategories.length > 0) {
      // 从数据库加载
      customCategories.value = dbCategories.map(cat => ({
        value: cat.value,
        label: cat.label,
        icon: cat.icon,
      }));
    } else {
      // 首次使用，保存预设分类到数据库
      customCategories.value = [...presetCategories];
      for (const cat of presetCategories) {
        await dbAddCategory(cat.value, cat.label, cat.icon);
      }
    }
  } catch (error) {
    console.error("Failed to load categories:", error);
    // 降级到预设分类
    customCategories.value = [...presetCategories];
  }
});

const showAddCategory = ref(false);
const editingCategory = ref<string | null>(null);
const newCategoryLabel = ref("");
const newCategoryIcon = ref("📝");

// 常用图标列表
const commonIcons = ["📝", "💻", "📱", "🎨", "🎵", "🎬", "📷", "✈️", "🏠", "🍔", "☕", "🎯", "💡", "🔧", "📊"];

async function addCategory() {
  if (!newCategoryLabel.value.trim()) return;
  
  const newValue = `custom_${Date.now()}`;
  const label = newCategoryLabel.value.trim();
  const icon = newCategoryIcon.value;
  
  try {
    await dbAddCategory(newValue, label, icon);
    customCategories.value.push({
      value: newValue,
      label,
      icon,
    });
    
    // 重置表单
    newCategoryLabel.value = "";
    newCategoryIcon.value = "📝";
    showAddCategory.value = false;
  } catch (error) {
    console.error("Failed to add category:", error);
    alert("添加分类失败，请重试");
  }
}

function startEdit(cat: { value: string; label: string; icon: string }) {
  editingCategory.value = cat.value;
  newCategoryLabel.value = cat.label;
  newCategoryIcon.value = cat.icon;
  showAddCategory.value = false;
}

async function saveEdit() {
  if (!newCategoryLabel.value.trim() || !editingCategory.value) return;
  
  const label = newCategoryLabel.value.trim();
  const icon = newCategoryIcon.value;
  
  try {
    await dbUpdateCategory(editingCategory.value, label, icon);
    
    const cat = customCategories.value.find(c => c.value === editingCategory.value);
    if (cat) {
      cat.label = label;
      cat.icon = icon;
    }
    
    // 重置表单
    newCategoryLabel.value = "";
    newCategoryIcon.value = "📝";
    editingCategory.value = null;
  } catch (error) {
    console.error("Failed to update category:", error);
    alert("更新分类失败，请重试");
  }
}

function cancelEdit() {
  editingCategory.value = null;
  newCategoryLabel.value = "";
  newCategoryIcon.value = "📝";
}

async function removeCategory(value: string) {
  // 不允许删除预设分类
  if (["work", "study", "entertainment", "meeting"].includes(value)) return;
  
  try {
    await dbDeleteCategory(value);
    customCategories.value = customCategories.value.filter(cat => cat.value !== value);
    
    // 如果删除的是当前选中的分类，切换到工作
    if (selectedCategory.value === value) {
      selectedCategory.value = "work";
    }
  } catch (error) {
    console.error("Failed to delete category:", error);
    alert("删除分类失败，请重试");
  }
}

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
  <div class="category-selector" :class="{ 'stopwatch-mode': mode === 'stopwatch', 'countdown-mode': mode === 'countdown' }">
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
        <div v-if="mode === 'stopwatch' && !['work', 'study', 'entertainment', 'meeting'].includes(cat.value)" class="action-btns">
          <button
            type="button"
            class="edit-btn"
            @click.stop="startEdit(cat)"
            title="编辑分类"
          >
            ✏️
          </button>
          <button
            type="button"
            class="remove-btn"
            @click.stop="removeCategory(cat.value)"
            title="删除分类"
          >
            ×
          </button>
        </div>
      </button>
      
      <!-- 添加分类按钮 (仅正计时模式) -->
      <button
        v-if="mode === 'stopwatch' && !showAddCategory"
        type="button"
        class="category-item add-btn"
        @click="showAddCategory = true"
      >
        <span class="category-icon">➕</span>
        <span class="category-label">添加</span>
      </button>
    </div>

    <!-- 添加分类表单 -->
    <div v-if="mode === 'stopwatch' && showAddCategory" class="add-category-form">
      <div class="form-header">新建分类</div>
      <div class="form-row">
        <input
          v-model="newCategoryLabel"
          type="text"
          class="category-input"
          placeholder="分类名称"
          maxlength="6"
          @keyup.enter="addCategory"
        />
        <select v-model="newCategoryIcon" class="icon-select">
          <option v-for="icon in commonIcons" :key="icon" :value="icon">{{ icon }}</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-cancel" @click="showAddCategory = false">取消</button>
        <button type="button" class="btn-add" @click="addCategory">添加</button>
      </div>
    </div>

    <!-- 编辑分类表单 -->
    <div v-if="mode === 'stopwatch' && editingCategory" class="add-category-form">
      <div class="form-header">编辑分类</div>
      <div class="form-row">
        <input
          v-model="newCategoryLabel"
          type="text"
          class="category-input"
          placeholder="分类名称"
          maxlength="6"
          @keyup.enter="saveEdit"
        />
        <select v-model="newCategoryIcon" class="icon-select">
          <option v-for="icon in commonIcons" :key="icon" :value="icon">{{ icon }}</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-cancel" @click="cancelEdit">取消</button>
        <button type="button" class="btn-add" @click="saveEdit">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-selector {
  width: 100%;
}

.category-grid {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
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
  min-width: 100px;
  position: relative;
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

.category-item.add-btn {
  border-style: dashed;
  opacity: 0.7;
}

.category-item.add-btn:hover {
  opacity: 1;
}

.action-btns {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.category-item:hover .action-btns {
  opacity: 1;
}

.edit-btn,
.remove-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-btn:hover {
  background: rgba(59, 130, 246, 0.8);
}

.remove-btn {
  font-size: 14px;
}

.remove-btn:hover {
  background: rgba(255, 0, 0, 0.8);
}

.add-category-form {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.form-header {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.form-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.category-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-card);
  color: var(--text-primary);
}

.icon-select {
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 18px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  min-width: 50px;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-add {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-add {
  background: var(--primary-color);
  color: white;
}

.btn-add:hover {
  background: var(--primary-hover);
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

/* 正计时模式缩小样式 */
.category-selector.stopwatch-mode .category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}

.category-selector.stopwatch-mode .category-item {
  padding: 12px 8px;
  min-height: 70px;
  min-width: 80px;
}

.category-selector.stopwatch-mode .category-icon {
  font-size: 20px;
}

.category-selector.stopwatch-mode .category-label {
  font-size: 12px;
}

/* 倒计时模式 - 分段式控件 */
.category-selector.countdown-mode .category-grid {
  display: inline-flex;
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 4px;
  gap: 0;
}

.category-selector.countdown-mode .category-item {
  flex-direction: row;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  min-height: auto;
  min-width: auto;
  transition: all 0.2s;
}

.category-selector.countdown-mode .category-item:hover {
  background: var(--bg-hover);
  transform: none;
}

.category-selector.countdown-mode .category-item.active {
  background: var(--bg-card);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.category-selector.countdown-mode .category-icon {
  font-size: 16px;
}

.category-selector.countdown-mode .category-label {
  font-size: 13px;
  font-weight: 500;
}
</style>
