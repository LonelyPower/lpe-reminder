<script setup lang="ts">
interface Props {
    visible: boolean;
    width?: string;
    height?: string;
    title?: string;
    showHeader?: boolean;
    showFooter?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    width: '480px',
    showHeader: true,
    showFooter: true,
});

const emit = defineEmits<{
    (e: "close"): void;
}>();
</script>

<template>
    <!-- <Teleport to="body"> -->
    <Transition name="dialog-fade">
        <div v-if="visible" class="backdrop" @click.self="emit('close')" data-tauri-drag-region>
            <div class="dialog" :style="{ width: props.width, height: props.height }">
                <!-- 头部 -->
                <div v-if="showHeader" class="dialog-header">
                    <slot name="header">
                        <h2 v-if="title">{{ title }}</h2>
                    </slot>
                    <button type="button" class="close-btn" @click="emit('close')" aria-label="关闭">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <!-- 内容区 -->
                <div class="dialog-body">
                    <slot></slot>
                </div>

                <!-- 底部 -->
                <div v-if="showFooter" class="dialog-footer">
                    <slot name="footer"></slot>
                </div>
            </div>
        </div>
    </Transition>
    <!-- </Teleport> -->
</template>

<style scoped>
.backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    cursor: move;
}

.dialog {
    box-sizing: border-box;
    max-width: calc(100% - 48px);
    max-height: calc(100% - 48px);
    border-radius: 16px;
    background: var(--bg-card);
    box-shadow: 0 18px 40px var(--shadow-color);
    display: flex;
    cursor: default;
    flex-direction: column;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    overflow: hidden;
}

.dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
}

.dialog-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
}

.close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
    flex-shrink: 0;
}

.close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
}

.dialog-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
}

.dialog-footer {
    display: flex;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;
}

/* 动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
    transition: opacity 0.3s ease;
}

.dialog-fade-enter-active .dialog,
.dialog-fade-leave-active .dialog {
    transition: transform 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
    opacity: 0;
}

.dialog-fade-enter-from .dialog,
.dialog-fade-leave-to .dialog {
    transform: scale(0.9);
}
</style>
