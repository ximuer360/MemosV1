<template>
  <div class="home">
    <div class="main-content">
      <MemoEditor @create="handleCreate" />
      <div class="memo-header">
        <h2>
          {{ getHeaderText }}
          <button 
            v-if="selectedDate || selectedTag" 
            class="clear-filter"
            @click="clearFilters"
          >
            显示全部
          </button>
        </h2>
        <div v-if="selectedTag" class="current-tag">
          #{{ selectedTag }}
        </div>
      </div>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <MemoList 
        v-else 
        :memos="filteredMemos" 
        @tagClick="handleTagClick"
      />
    </div>
    <div class="sidebar">
      <ContributionCalendar @dateSelect="handleDateSelect" />
      <div v-if="allTags.length" class="tags-cloud">
        <h3>标签云</h3>
        <div class="tags-list">
          <span 
            v-for="tag in allTags" 
            :key="tag"
            :class="['tag', { active: selectedTag === tag }]"
            @click="handleTagClick(tag)"
          >
            #{{ tag }}
            <span class="tag-count">{{ getTagCount(tag) }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMemoStore } from '../stores/memos'
import MemoEditor from '../components/MemoEditor.vue'
import MemoList from '../components/MemoList.vue'
import ContributionCalendar from '../components/ContributionCalendar.vue'
import { ref, computed } from 'vue'

const { 
  memos, 
  loading, 
  error, 
  selectedDate,
  createMemo, 
  fetchMemosByDate,
  clearDateFilter 
} = useMemoStore()

const selectedDateMemos = ref([])
const selectedTag = ref<string | null>(null)

const allTags = computed(() => {
  const tags = new Set<string>()
  memos.value.forEach(memo => {
    memo.tags?.forEach(tag => tags.add(tag))
  })
  return Array.from(tags)
})

const filteredMemos = computed(() => {
  let result = memos.value

  if (selectedTag.value) {
    result = result.filter(memo => memo.tags?.includes(selectedTag.value!))
  }

  if (selectedDate.value) {
    const date = new Date(selectedDate.value)
    const nextDate = new Date(date)
    nextDate.setDate(date.getDate() + 1)
    
    result = result.filter(memo => {
      const memoDate = new Date(memo.createdAt)
      return memoDate >= date && memoDate < nextDate
    })
  }

  return result
})

const handleDateSelect = async (date: string) => {
  selectedDate.value = date
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/memos/date/${date}`)
    if (!response.ok) {
      throw new Error('Failed to fetch memos')
    }
    const data = await response.json()
    selectedDateMemos.value = data
    console.log('Fetched memos for date:', date, data)
  } catch (error) {
    console.error('Error fetching memos:', error)
    selectedDateMemos.value = []
  }
}

const formatDisplayDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const handleCreate = async (content: string, resources: any[], tags: string[]) => {
  try {
    // 确保资源数据结构正确
    const processedResources = resources.map(resource => ({
      url: resource.url,
      name: resource.name,
      type: resource.type,
      size: resource.size
    }))

    const newMemo = await createMemo(content, processedResources, tags)
    if (selectedDate.value) {
      const memoDate = new Date(newMemo.createdAt).toISOString().split('T')[0]
      if (memoDate === selectedDate.value) {
        selectedDateMemos.value = [newMemo, ...selectedDateMemos.value]
      }
    }
  } catch (error) {
    console.error('Failed to create memo:', error)
  }
}

const handleTagClick = (tag: string) => {
  if (selectedTag.value === tag) {
    selectedTag.value = null
  } else {
    selectedTag.value = tag
  }
}

const clearFilters = () => {
  selectedTag.value = null
  selectedDate.value = null
  selectedDateMemos.value = []
}

const getHeaderText = computed(() => {
  if (selectedTag.value && selectedDate.value) {
    return `${formatDisplayDate(selectedDate.value)}的 #${selectedTag.value} 记录`
  }
  if (selectedTag.value) {
    return `标签: #${selectedTag.value}`
  }
  if (selectedDate.value) {
    return `${formatDisplayDate(selectedDate.value)}的记录`
  }
  return '全部记录'
})

const getTagCount = (tag: string) => {
  return memos.value.filter(memo => memo.tags?.includes(tag)).length
}
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
}

.main-content {
  min-width: 0;
}

.sidebar {
  position: sticky;
  top: 20px;
}

@media (max-width: 768px) {
  .home {
    grid-template-columns: 1fr;
  }
  
  .sidebar {
    position: static;
  }
}

.loading, .error {
  text-align: center;
  padding: 20px;
  color: #666;
}

.error {
  color: #dc3545;
}

.memo-header {
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.memo-header h2 {
  font-size: 1.2em;
  color: #333;
  display: flex;
  align-items: center;
  gap: 10px;
}

.clear-filter {
  background: none;
  border: 1px solid #ddd;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8em;
  color: #666;
}

.clear-filter:hover {
  background: #f5f5f5;
}

.selected-date-memos {
  margin-top: 20px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.memos-list {
  margin-top: 16px;
}

.memo-item {
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.memo-item:last-child {
  border-bottom: none;
}

.no-memos {
  color: #999;
  text-align: center;
  padding: 20px;
}

.tags-cloud {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-top: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.tags-cloud h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  padding: 4px 8px;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tag:hover {
  background: #e6f4ff;
  color: #1890ff;
}

.tag.active {
  background: #1890ff;
  color: white;
}

.current-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  background: #e6f4ff;
  color: #1890ff;
  border-radius: 16px;
  font-size: 14px;
  margin-left: 12px;
}

.tag-count {
  font-size: 12px;
  margin-left: 4px;
  opacity: 0.7;
}
</style> 