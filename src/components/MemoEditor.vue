<template>
  <div class="memo-editor">
    <div class="editor-content">
      <textarea
        v-model="content"
        placeholder="写点什么..."
        rows="3"
        :disabled="isSubmitting"
        @paste="handlePaste"
      ></textarea>
      
      <!-- 添加标签输入区域 -->
      <div class="tags-input">
        <div class="tags-list">
          <span v-for="tag in tags" :key="tag" class="tag">
            {{ tag }}
            <button @click="removeTag(tag)" class="remove-tag">×</button>
          </span>
        </div>
        <input
          v-model="tagInput"
          @keydown.enter.prevent="addTag"
          @keydown.space.prevent="addTag"
          @keydown.tab.prevent="addTag"
          placeholder="输入标签，回车添加"
          type="text"
        >
      </div>

      <div class="editor-toolbar">
        <input
          type="file"
          ref="fileInput"
          @change="handleFileChange"
          accept="image/*"
          class="hidden"
          multiple
        >
        <button class="toolbar-btn" @click="triggerFileInput">
          <i class="fas fa-image"></i>
        </button>
      </div>
    </div>
    <div class="preview" v-if="uploadedFiles.length">
      <div class="preview-list"
           @dragover="handleDragOver"
      >
        <div v-for="(file, index) in uploadedFiles" 
             :key="file.url" 
             class="preview-item"
             draggable="true"
             @dragstart="handleDragStart(index)"
             @drop="handleDrop(index)">
          <img 
            :src="file.url" 
            :alt="file.name"
            @error="(e) => { console.error('Preview image load error:', e); }"
          >
          <div class="drag-handle">⋮⋮</div>
          <button class="remove-btn" @click="removeFile(file)">×</button>
        </div>
      </div>
    </div>
    <div class="actions">
      <div v-if="error" class="error">{{ error }}</div>
      <button 
        @click="handleSubmit" 
        :disabled="isSubmitting || !content.trim()"
        class="submit-btn"
      >
        {{ isSubmitting ? '发布中...' : '发布' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const content = ref('')
const error = ref('')
const isSubmitting = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadedFiles = ref<Array<{ url: string, name: string, type: string, size: number }>>([])
const draggedItem = ref<number | null>(null)
const tags = ref<string[]>([])
const tagInput = ref('')

const emit = defineEmits<{
  (e: 'create', content: string, resources: Array<{ url: string, name: string, type: string, size: number }>, tags: string[]): void
}>()

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileUpload = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/resources`, {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }

    const clonedResponse = response.clone()
    
    try {
      const data = await response.json()
      console.log('Upload response:', data)
      
      if (!data.url || !data.type || !data.name || !data.size) {
        throw new Error('Invalid response data')
      }
      
      uploadedFiles.value.push({
        url: data.url,
        name: data.name,
        type: data.type,
        size: data.size
      })
      error.value = ''
    } catch (parseError) {
      console.error('Error parsing response:', parseError)
      const text = await clonedResponse.text()
      console.error('Response text:', text)
      throw new Error('Invalid response format')
    }
  } catch (e) {
    console.error('Upload error:', e)
    error.value = '图片上传失败'
  }
}

const handleFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  for (const file of Array.from(input.files)) {
    await handleFileUpload(file)
  }
  
  input.value = ''
}

const removeFile = (file: { url: string, name: string }) => {
  uploadedFiles.value = uploadedFiles.value.filter(f => f.url !== file.url)
}

const handlePaste = async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        await handleFileUpload(file)
      }
    }
  }
}

const addTag = () => {
  const tag = tagInput.value.trim()
  if (tag && !tags.value.includes(tag)) {
    tags.value.push(tag)
  }
  tagInput.value = ''
}

const removeTag = (tag: string) => {
  tags.value = tags.value.filter(t => t !== tag)
}

const handleSubmit = async () => {
  if (!content.value.trim()) return
  
  isSubmitting.value = true
  error.value = ''
  
  try {
    // 确保资源数据结构正确
    const processedResources = uploadedFiles.value.map(file => ({
      url: file.url,
      name: file.name,
      type: file.type,
      size: file.size
    }))
    
    // 确保标签是字符串数组
    const processedTags = tags.value.map(tag => String(tag))
    
    await emit('create', content.value, processedResources, processedTags)
    content.value = ''
    uploadedFiles.value = []
    tags.value = []
    error.value = ''
  } catch (e) {
    console.error('Failed to create memo:', e)
    error.value = '发布失败，请重试'
  } finally {
    isSubmitting.value = false
  }
}

const handleDragStart = (index: number) => {
  draggedItem.value = index
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
}

const handleDrop = (index: number) => {
  if (draggedItem.value === null) return
  
  const files = [...uploadedFiles.value]
  const [moved] = files.splice(draggedItem.value, 1)
  files.splice(index, 0, moved)
  uploadedFiles.value = files
  draggedItem.value = null
}
</script>

<style scoped>
.memo-editor {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.editor-content {
  position: relative;
}

textarea {
  width: 100%;
  border: none;
  resize: none;
  outline: none;
  font-size: 16px;
  min-height: 100px;
}

.editor-toolbar {
  border-top: 1px solid #eee;
  padding-top: 8px;
  display: flex;
  gap: 8px;
}

.toolbar-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  cursor: pointer;
  color: #666;
}

.toolbar-btn:hover {
  color: #007bff;
}

.hidden {
  display: none;
}

.preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.preview-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-item {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #eee;
  cursor: move;
  transition: transform 0.2s;
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-item:hover {
  transform: scale(1.05);
}

.preview-item.dragging {
  opacity: 0.5;
}

.drag-handle {
  position: absolute;
  top: 4px;
  left: 4px;
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 4px;
  cursor: move;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.preview-item:hover .drag-handle {
  opacity: 1;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.error {
  color: #dc3545;
  font-size: 14px;
}

.submit-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.tags-input {
  margin-top: 8px;
  border-top: 1px solid #eee;
  padding-top: 8px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #e6f4ff;
  color: #1890ff;
  border-radius: 4px;
  font-size: 14px;
}

.remove-tag {
  background: none;
  border: none;
  color: #1890ff;
  cursor: pointer;
  padding: 0 2px;
}

.remove-tag:hover {
  color: #ff4d4f;
}

input[type="text"] {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

input[type="text"]:focus {
  outline: none;
  border-color: #1890ff;
}
</style> 