<template>
  <div class="calendar-wrapper">
    <!-- 修改调试信息显示的条件 -->
    <!-- <div v-if="isDev" class="debug-info">
      <pre>{{ debugInfo }}</pre>
    </div> -->
    
    <div class="calendar-header">
      <button @click="changeMonth(-1)">&lt;</button>
      <span>{{ currentYear }}年{{ currentMonth + 1 }}月</span>
      <button @click="changeMonth(1)">&gt;</button>
    </div>
    <div class="calendar">
      <div class="weekdays">
        <div v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day">{{ day }}</div>
      </div>
      <div class="days">
        <div
          v-for="{ date, count, isCurrentMonth } in calendarDays"
          :key="date"
          class="day"
          :class="getDayClasses(date, count, isCurrentMonth)"
          @click="handleDateClick(date, count)"
        >
          <span>{{ new Date(date).getDate() }}</span>
          <!-- 添加调试信息 -->
          <span v-if="count > 0" class="count-badge">{{ count }}</span>
        </div>
      </div>
    </div>
    <div class="legend">
      <div class="legend-item">
        <div class="legend-box level-0"></div>
        <span>0</span>
      </div>
      <div class="legend-item">
        <div class="legend-box level-1"></div>
        <span>1-3</span>
      </div>
      <div class="legend-item">
        <div class="legend-box level-2"></div>
        <span>4-7</span>
      </div>
      <div class="legend-item">
        <div class="legend-box level-3"></div>
        <span>8-10</span>
      </div>
      <div class="legend-item">
        <div class="legend-box level-4"></div>
        <span>10+</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const currentDate = ref(new Date())
const memoStats = ref<Record<string, number>>({})

// 添加开发环境判断
const isDev = computed(() => import.meta.env.DEV)

// 添加调试信息计算属性
const debugInfo = computed(() => JSON.stringify({
  currentYear: currentYear.value,
  currentMonth: currentMonth.value + 1,
  sampleStats: Object.entries(memoStats.value).slice(0, 3)
}, null, 2))

const emit = defineEmits<{
  (e: 'dateSelect', date: string): void
}>()

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  
  // 获取当月第一天是星期几（0是星期日）
  let firstDayOfWeek = firstDay.getDay() || 7 // 转换为星期一为1
  firstDayOfWeek = firstDayOfWeek === 7 ? 0 : firstDayOfWeek // 调整星期日的位置
  
  const days = []
  
  // 添加上个月的日期
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i)
    days.push({
      date: formatDate(date),
      count: memoStats.value[formatDate(date)] || 0,
      isCurrentMonth: false
    })
  }
  
  // 添加当月的日期
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i)
    days.push({
      date: formatDate(date),
      count: memoStats.value[formatDate(date)] || 0,
      isCurrentMonth: true
    })
  }
  
  // 添加下个月的日期
  const remainingDays = 42 - days.length // 保持6行
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i)
    days.push({
      date: formatDate(date),
      count: memoStats.value[formatDate(date)] || 0,
      isCurrentMonth: false
    })
  }
  
  // 在返回之前添加日志
  console.log('Calendar days calculation:', {
    year: currentYear.value,
    month: currentMonth.value,
    statsData: memoStats.value,
    firstDay: days[0],
    lastDay: days[days.length - 1],
    sampleDay: days.find(d => d.count > 0) // 找一个有数据的日期作为样本
  })
  
  return days
})

const changeMonth = (delta: number) => {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + delta)
  currentDate.value = newDate
  fetchMemoStats()
}

const handleDateClick = (date: string, count: number) => {
  console.log('Clicked date:', date, 'with count:', count)
  emit('dateSelect', date)
}

const getLevel = (count: number): number => {
  if (count === 0) return 0
  if (count <= 3) return 1
  if (count <= 7) return 2
  if (count <= 10) return 3
  return 4
}

const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fetchMemoStats = async () => {
  try {
    const url = `${import.meta.env.VITE_API_URL}/api/memos/stats/${currentYear.value}/${currentMonth.value + 1}`
    console.log('Fetching stats from:', url)
    
    const response = await fetch(url)
    const data = await response.json()
    console.log('Raw stats data:', data)
    
    // 确保数据格式正确
    if (typeof data === 'object' && data !== null) {
      memoStats.value = data
      console.log('Updated memoStats:', memoStats.value)
    } else {
      console.error('Invalid stats data format:', data)
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }
}

const isToday = (dateStr: string) => {
  const today = new Date()
  const date = new Date(dateStr)
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

// 添加一个测试函数
const testDate = () => {
  const testDay = new Date('2025-01-19')
  console.log('2025-01-19 是星期:', testDay.getDay()) // 0 表示周日
  // 也可以用更直观的方式显示
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  console.log('2025-01-19 是:', weekdays[testDay.getDay()])
}

// 在 onMounted 中调用
onMounted(() => {
  testDate()
  fetchMemoStats()
})

// 修改获取日期类名的方法
const getDayClasses = (date: string, count: number, isCurrentMonth: boolean) => {
  const level = getLevel(count)
  console.log(`Date: ${date}, Count: ${count}, Level: ${level}`) // 调试日志
  
  return {
    'has-memos': count > 0,
    'different-month': !isCurrentMonth,
    'today': isToday(date),
    'level-0': level === 0,
    'level-1': level === 1,
    'level-2': level === 2,
    'level-3': level === 3,
    'level-4': level === 4
  }
}

// 添加监听器以在月份变化时更新数据
watch([currentYear, currentMonth], () => {
  fetchMemoStats()
})
</script>

<style scoped>
.calendar-wrapper {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.calendar-header button {
  background: none;
  border: none;
  padding: 4px 8px;
  cursor: pointer;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 8px;
}

.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day {
  position: relative;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.3s;
  margin: 2px;
  background-color: #ebedf0; /* 默认颜色 - 无贡献 */
}

.different-month {
  color: #ccc;
}

/* 贡献度日历的颜色等级
 * level-0: 灰色底色，表示当天无记录
 * level-1: 最浅绿色，表示1-3条记录
 * level-2: 浅绿色，表示4-7条记录
 * level-3: 中绿色，表示8-10条记录
 * level-4: 深绿色，表示10条以上记录
 */
.day.level-0 { background-color: #ebedf0 !important; }  /* 灰色 - 无贡献 */
.day.level-1 { background-color: #9be9a8 !important; }  /* 最浅绿 - 1-3条记录 */
.day.level-2 { background-color: #40c463 !important; }  /* 浅绿色 - 4-7条记录 */
.day.level-3 { background-color: #30a14e !important; }  /* 中绿色 - 8-10条记录 */
.day.level-4 { background-color: #216e39 !important; }  /* 深绿色 - 10+条记录 */

.legend {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-box {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.today {
  position: relative;
  border: 2px solid #ff4d4f;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(255, 77, 79, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0);
  }
}

/* 添加调试相关样式 */
.debug-info {
  font-size: 12px;
  background: #f5f5f5;
  padding: 8px;
  margin-bottom: 16px;
  border-radius: 4px;
  overflow: auto;
}

.count-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #1890ff;
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 10px;
  display: none;
}

.day:hover .count-badge {
  display: block;
}

/* 添加悬停效果 */
.day:hover {
  transform: scale(1.1);
  z-index: 1;
}

/* 确保数字颜色在深色背景上可见 */
.day.level-3 span,
.day.level-4 span {
  color: white;
}

/* 图例颜色 */
.legend-box.level-0 { background-color: #ebedf0; }  /* 灰色 - 无贡献 */
.legend-box.level-1 { background-color: #9be9a8; }  /* 最浅绿 - 1-3条记录 */
.legend-box.level-2 { background-color: #40c463; }  /* 浅绿色 - 4-7条记录 */
.legend-box.level-3 { background-color: #30a14e; }  /* 中绿色 - 8-10条记录 */
.legend-box.level-4 { background-color: #216e39; }  /* 深绿色 - 10+条记录 */
</style> 