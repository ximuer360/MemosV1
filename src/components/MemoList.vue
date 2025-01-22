<template>
  <div class="memo-list">
    <div v-for="memo in memos" :key="memo._id" class="memo-item">
      <div class="memo-content markdown-body" v-html="memo.content.html"></div>
      <div v-if="memo.tags?.length" class="memo-tags">
        <span v-for="tag in memo.tags" 
              :key="tag" 
              class="tag"
              @click="$emit('tagClick', tag)">
          #{{ tag }}
        </span>
      </div>
      <div class="memo-resources" v-if="memo.resources?.length">
        <div v-for="resource in memo.resources" :key="resource.url" class="resource-item">
          <img v-if="resource.type?.startsWith('image/')" 
               :src="resource.url" 
               :alt="resource.name"
               @click="showImage(memo.resources, resource.url)"
               @error="handleImageError">
        </div>
      </div>
      <div class="memo-meta">
        <span class="memo-time">{{ formatDate(memo.createdAt) }}</span>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <div v-if="previewVisible" class="image-viewer" @click="closePreview">
      <button class="nav-btn prev" @click.stop="prevImage" v-show="currentIndex > 0">
        <i class="fas fa-chevron-left"></i>
      </button>
      
      <img :src="currentImage" :alt="currentImage" @click.stop>
      
      <button class="nav-btn next" @click.stop="nextImage" 
              v-show="currentIndex < totalImages - 1">
        <i class="fas fa-chevron-right"></i>
      </button>

      <div class="preview-counter">
        {{ currentIndex + 1 }} / {{ totalImages }}
      </div>

      <button class="close-btn" @click.stop="closePreview">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Memo } from '../types/memo'
import { formatDate } from '../utils/date'

defineProps<{
  memos: Memo[]
}>()

defineEmits(['tagClick'])  // 添加 tagClick 事件

const previewVisible = ref(false)
const currentImage = ref('')
const currentImages = ref<string[]>([])
const currentIndex = ref(0)

const totalImages = computed(() => currentImages.value.length)

const showImage = (resources: any[], clickedUrl: string) => {
  // 过滤出所有图片资源的URL
  currentImages.value = resources
    .filter(r => r.type.startsWith('image/'))
    .map(r => r.url)
  
  // 设置当前图片索引
  currentIndex.value = currentImages.value.findIndex(url => url === clickedUrl)
  currentImage.value = clickedUrl
  previewVisible.value = true
}

const closePreview = () => {
  previewVisible.value = false
}

const prevImage = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    currentImage.value = currentImages.value[currentIndex.value]
  }
}

const nextImage = () => {
  if (currentIndex.value < currentImages.value.length - 1) {
    currentIndex.value++
    currentImage.value = currentImages.value[currentIndex.value]
  }
}

// 添加键盘事件监听
const handleKeydown = (e: KeyboardEvent) => {
  if (!previewVisible.value) return
  
  switch (e.key) {
    case 'ArrowLeft':
      prevImage()
      break
    case 'ArrowRight':
      nextImage()
      break
    case 'Escape':
      closePreview()
      break
  }
}

// 挂载时添加键盘事件监听
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

// 卸载时移除键盘事件监听
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// 添加图片错误处理
const handleImageError = (e: Event) => {
  const img = e.target as HTMLImageElement
  console.error('Image failed to load:', img.src)
}
</script>

<style scoped>
.memo-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.memo-item {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.memo-content {
  font-size: 16px;
  margin-bottom: 8px;
}

.memo-meta {
  font-size: 14px;
  color: #666;
}

.memo-time {
  color: #888;
}

/* Markdown 样式 */
.markdown-body :deep(h1) {
  font-size: 1.5em;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-body :deep(h2) {
  font-size: 1.3em;
  margin-top: 0.8em;
  margin-bottom: 0.4em;
}

.markdown-body :deep(p) {
  margin: 0.5em 0;
  line-height: 1.6;
}

.markdown-body :deep(code) {
  background: rgba(175, 184, 193, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  font-size: 0.85em;
}

.markdown-body :deep(pre) {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1em 0;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  font-size: 0.9em;
  line-height: 1.5;
  white-space: pre;
}

.markdown-body :deep(a) {
  color: #0366d6;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.markdown-body :deep(ul), .markdown-body :deep(ol) {
  padding-left: 2em;
  margin: 0.5em 0;
}

.markdown-body :deep(li) {
  margin: 0.3em 0;
}

.memo-resources {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.resource-item {
  position: relative;
  width: 150px;
  height: 150px;
  border-radius: 4px;
  overflow: hidden;
  cursor: zoom-in;
}

.resource-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.resource-item img:hover {
  transform: scale(1.05);
}

/* 高亮代码块的行样式 */
.markdown-body :deep(.hljs) {
  display: block;
  overflow-x: auto;
  padding: 1em;
  color: #24292e;
  background: #f6f8fa;
}

.markdown-body :deep(.hljs-comment),
.markdown-body :deep(.hljs-quote) {
  color: #6a737d;
  font-style: italic;
}

.markdown-body :deep(.hljs-keyword),
.markdown-body :deep(.hljs-selector-tag) {
  color: #d73a49;
}

.markdown-body :deep(.hljs-string),
.markdown-body :deep(.hljs-literal) {
  color: #032f62;
}

.markdown-body :deep(.hljs-number),
.markdown-body :deep(.hljs-variable),
.markdown-body :deep(.hljs-template-variable) {
  color: #005cc5;
}

.markdown-body :deep(.hljs-function) {
  color: #6f42c1;
}

.image-viewer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.image-viewer img {
  max-width: 90%;
  max-height: 90vh;
  object-fit: contain;
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.prev {
  left: 20px;
}

.next {
  right: 20px;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-counter {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  background: rgba(0, 0, 0, 0.5);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
}

.memo-tags {
  margin: 8px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  color: #1890ff;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 8px;
  background: #e6f4ff;
  border-radius: 4px;
}

.tag:hover {
  background: #1890ff;
  color: white;
}
</style> 