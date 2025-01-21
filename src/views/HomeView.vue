<template>
  <div class="home">
    <div class="main-content">
      <MemoEditor @create="handleCreate" />
      <div class="memo-header">
        <h2>
          {{ selectedDate ? `${formatDisplayDate(selectedDate)}的记录` : '全部记录' }}
          <button 
            v-if="selectedDate" 
            class="clear-filter"
            @click="clearDateFilter"
          >
            显示全部
          </button>
        </h2>
      </div>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <MemoList v-else :memos="selectedDateMemos.length > 0 ? selectedDateMemos : memos" />
    </div>
    <div class="sidebar">
      <ContributionCalendar @dateSelect="handleDateSelect" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMemoStore } from '../stores/memos'
import MemoEditor from '../components/MemoEditor.vue'
import MemoList from '../components/MemoList.vue'
import ContributionCalendar from '../components/ContributionCalendar.vue'
import { ref } from 'vue'

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
    const newMemo = await createMemo(content, resources, tags)
    // 如果当前显示的是按日期筛选的记录
    if (selectedDate.value) {
      const memoDate = new Date(newMemo.createdAt).toISOString().split('T')[0]
      // 如果新创建的记录日期与当前选中日期相同，则添加到列表中
      if (memoDate === selectedDate.value) {
        // 确保 selectedDateMemos 是响应式的
        selectedDateMemos.value = [newMemo, ...selectedDateMemos.value]
      }
    }
    // 不再需要手动添加到 memos，因为 store 已经处理了
  } catch (error) {
    console.error('Failed to create memo:', error)
  }
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
</style> 