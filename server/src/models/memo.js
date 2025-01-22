import mongoose from 'mongoose'

// 定义资源 Schema
const resourceSchema = new mongoose.Schema({
  url: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true }
}, { _id: false }) // 禁用资源的 _id

const memoSchema = new mongoose.Schema({
  content: {
    raw: String,      // 原始 Markdown
    html: String,     // 渲染后的 HTML
    text: String      // 纯文本（用于搜索）
  },
  resources: [resourceSchema], // 使用资源 Schema 数组
  tags: [String],
  visibility: {
    type: String,
    enum: ['PUBLIC', 'PRIVATE'],
    default: 'PUBLIC'
  },
  userId: String,
  createdAt: String,  // 使用字符串类型存储时间
  updatedAt: String   // 使用字符串类型存储时间
}, {
  timestamps: false,
  toJSON: { getters: true },
  toObject: { getters: true }
})

// 添加全文搜索索引
memoSchema.index({ 'content.text': 'text' })

// 在保存前处理时间
memoSchema.pre('save', function(next) {
  const now = new Date()
  const cstNow = new Date(now.getTime() + (8 * 60 * 60 * 1000))
  const timeStr = cstNow.toISOString().replace('Z', '+08:00')
  
  if (!this.createdAt) {
    this.createdAt = timeStr
  }
  this.updatedAt = timeStr
  next()
})

// 添加统计方法
memoSchema.statics.getMonthlyStats = async function(year, month) {
  const startDate = new Date(Date.UTC(year, month - 1, 1, -8, 0, 0)) // 调整为东八区的开始时间
  const endDate = new Date(Date.UTC(year, month, 1, -8, 0, 0)) // 下个月的开始时间
  
  // 添加详细的查询参数日志
  console.log('Stats query parameters:', {
    year,
    month,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  })
  
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lt: endDate
        }
      }
    },
    {
      $project: {
        dateStr: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: '+08:00'
          }
        }
      }
    },
    {
      $group: {
        _id: '$dateStr',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ])

  // 添加原始聚合结果日志
  console.log('Raw aggregation results:', stats)

  // 初始化所有日期的计数为0
  const result = {}
  const currentDate = new Date(year, month - 1, 1)
  const lastDate = new Date(year, month, 0)
  
  while (currentDate <= lastDate) {
    const dateStr = currentDate.toISOString().split('T')[0]
    result[dateStr] = 0
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // 更新有记录的日期的计数
  stats.forEach(({ _id, count }) => {
    result[_id] = count
  })

  // 添加最终结果日志
  console.log('Final stats result:', result)

  return result
}

export const Memo = mongoose.model('Memo', memoSchema) 