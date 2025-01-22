import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import multer from 'multer'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { marked } from 'marked'
import highlight from 'highlight.js'
import sanitizeHtml from 'sanitize-html'
import dotenv from 'dotenv'
import { networkInterfaces } from 'os'
import jwt from 'jsonwebtoken'
import { Memo } from './models/memo.js'

// 指定 .env 文件的路径
const envPath = resolve(process.cwd(), '.env')
const result = dotenv.config({ path: envPath })

if (result.error) {
  console.error('Error loading .env file:', result.error)
  process.exit(1)
}

// 验证必要的环境变量
const requiredEnvVars = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'JWT_SECRET']
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars)
  process.exit(1)
}

console.log('Environment variables loaded successfully:', {
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  JWT_SECRET: process.env.JWT_SECRET ? '[SET]' : '[NOT SET]'
})

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

// 配置 Markdown 渲染
marked.setOptions({
  highlight: (code, language) => {
    if (language && highlight.getLanguage(language)) {
      return highlight.highlight(code, {
        language: language,
        ignoreIllegals: true
      }).value
    }
    return highlight.highlightAuto(code).value
  },
  langPrefix: 'hljs language-',
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false
})

// 连接 MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memobbs', {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('MongoDB connected successfully')
})
.catch(err => {
  console.error('MongoDB connection error:', err)
  process.exit(1)
})

// 监听连接错误
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err)
})

// 配置文件上传
const uploadDir = join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date()
    const dirPath = join(
      uploadDir,
      now.getFullYear().toString(),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getDate().toString().padStart(2, '0')
    )
    
    // 确保目录存在
    fs.mkdirSync(dirPath, { recursive: true })
    cb(null, dirPath)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`
    cb(null, uniqueName)
  }
})

const upload = multer({ storage })

// 处理 Markdown 内容
function processContent(rawContent) {
  const html = marked(rawContent)
  const sanitized = sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'pre', 'code', 'span',
      'figure', 'figcaption'
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'class', 'data-action'],
      figure: ['class'],
      figcaption: ['class']
    },
    allowedClasses: {
      code: ['*'],
      pre: ['*'],
      span: ['*'],
      img: ['memo-img'],
      figure: ['memo-figure']
    },
    transformTags: {
      'img': (tagName, attribs) => ({
        tagName: 'img',
        attribs: {
          ...attribs,
          'class': 'memo-img',
          'data-action': 'zoom'
        }
      })
    }
  })
  return {
    raw: rawContent,
    html: sanitized,
    text: sanitizeHtml(html, { allowedTags: [] })
  }
}

// 1. 首先是中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))
app.use(express.json())

// 添加刷新 token 的函数
const generateToken = (user) => {
  return jwt.sign(
    { username: user.username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }  // 延长 token 有效期到 7 天
  )
}

// 修改验证 token 的中间件
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded

    // 检查 token 是否即将过期（比如还有 1 小时就过期）
    const tokenExp = decoded.exp * 1000 // 转换为毫秒
    const now = Date.now()
    const oneHour = 60 * 60 * 1000

    if (tokenExp - now < oneHour) {
      // 生成新的 token
      const newToken = jwt.sign(
        { username: decoded.username, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      )
      // 在响应头中返回新的 token
      res.setHeader('X-New-Token', newToken)
    }

    next()
  } catch (error) {
    console.error('Token verification error:', error)
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// 2. 认证相关路由
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = generateToken({ username })
    res.json({ token })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// 添加刷新 token 的路由
app.post('/api/auth/refresh', authenticateToken, (req, res) => {
  try {
    const newToken = generateToken(req.user)
    res.json({ token: newToken })
  } catch (error) {
    console.error('Token refresh error:', error)
    res.status(500).json({ error: 'Failed to refresh token' })
  }
})

// 3. 公共 API 路由
app.get('/api/memos', async (req, res) => {
  try {
    const memos = await Memo.find()
      .sort({ createdAt: -1 })
      .lean()
      .exec()
    res.json(memos)
  } catch (error) {
    console.error('Error fetching memos:', error)
    res.status(500).json({ error: 'Failed to fetch memos' })
  }
})

// 修改 Memo 模型
const memoSchema = new mongoose.Schema({
  content: {
    raw: String,
    html: String,
    text: String
  },
  resources: [{
    url: String,
    name: String,
    type: String,
    size: Number
  }],
  tags: [String],
  visibility: {
    type: String,
    default: 'PUBLIC'
  },
  userId: String,
  createdAt: String,
  updatedAt: String
})

// const Memo = mongoose.model('Memo', memoSchema)

// 创建 memo
app.post('/api/memos', async (req, res) => {
  try {
    const { content, resources, tags } = req.body
    
    // 创建 ISO 格式的时间字符串
    const now = new Date()
    const cstTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
    const timeStr = cstTime.toISOString().replace('Z', '+08:00')
    
    // 确保 resources 是数组并且格式正确
    const processedResources = Array.isArray(resources) ? resources.map(resource => ({
      url: String(resource.url),
      name: String(resource.name),
      type: String(resource.type),
      size: Number(resource.size)
    })) : []

    // 创建新的 memo 文档
    const memo = {
      content: {
        raw: content,
        html: marked(content),
        text: content
      },
      resources: processedResources,
      tags: Array.isArray(tags) ? tags : [],
      visibility: 'PUBLIC',
      userId: '1',
      createdAt: timeStr,
      updatedAt: timeStr
    }

    // 打印调试信息
    console.log('Creating memo with:', {
      content: memo.content,
      resources: JSON.stringify(memo.resources, null, 2),
      tagsCount: memo.tags.length
    })

    // 使用 create 方法创建文档
    const savedMemo = await Memo.create(memo)
    res.json(savedMemo)
  } catch (error) {
    console.error('Error creating memo:', error)
    // 添加更详细的错误信息
    res.status(500).json({ 
      error: 'Failed to create memo',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

app.post('/api/resources', upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const now = new Date()
    const relativePath = join(
      now.getFullYear().toString(),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getDate().toString().padStart(2, '0'),
      file.filename
    )
    
    const serverUrl = process.env.SERVER_URL || `http://${getLocalIP()}:3000`
    const fileUrl = `${serverUrl}/uploads/${relativePath}`
    
    const response = {
      url: fileUrl,
      type: file.mimetype,
      name: file.originalname,
      size: file.size
    }

    console.log('File uploaded successfully:', response)
    res.json(response)
  } catch (error) {
    console.error('Error uploading file:', error)
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

// 修改获取统计数据的路由
app.get('/api/memos/stats/:year/:month', async (req, res) => {
  try {
    const year = parseInt(req.params.year)
    const month = parseInt(req.params.month)
    
    // 创建时间范围字符串
    const startStr = `${year}-${String(month).padStart(2, '0')}-01T00:00:00+08:00`
    const lastDay = new Date(year, month, 0).getDate()
    const endStr = `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59+08:00`
    
    console.log('Stats query parameters:', {
      year,
      month,
      startStr,
      endStr
    })
    
    const memos = await Memo.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startStr,
            $lte: endStr
          }
        }
      },
      {
        $group: {
          _id: {
            $substr: ['$createdAt', 0, 10]  // 提取 YYYY-MM-DD 部分
          },
          count: { $sum: 1 }
        }
      }
    ])
    
    console.log('Raw aggregation results:', memos)
    
    // 初始化所有日期的计数为0
    const stats = {}
    const currentDate = new Date(startStr)
    while (currentDate <= endStr) {
      const dateStr = currentDate.toISOString().split('T')[0]
      stats[dateStr] = 0
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // 更新有记录的日期的计数
    memos.forEach(memo => {
      stats[memo._id] = memo.count
    })
    
    console.log('Final stats:', stats)
    res.json(stats)
  } catch (error) {
    console.error('Error fetching memo stats:', error)
    res.status(500).json({ error: 'Failed to fetch memo stats' })
  }
})

// 按日期获取 memos
app.get('/api/memos/date/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date)
    const nextDate = new Date(date)
    nextDate.setDate(date.getDate() + 1)
    
    const memos = await Memo.find({
      createdAt: {
        $gte: date.toISOString(),
        $lt: nextDate.toISOString()
      }
    })
    .sort({ createdAt: -1 })
    .lean()
    .exec()
    
    res.json(memos)
  } catch (error) {
    console.error('Error fetching memos by date:', error)
    res.status(500).json({ error: 'Failed to fetch memos' })
  }
})

// 5. 需要认证的 API 路由
app.put('/api/memos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { content, resources = [], tags = [] } = req.body

    // 处理资源数据
    const processedResources = Array.isArray(resources) ? resources.map(resource => ({
      url: String(resource.url),
      name: String(resource.name),
      type: String(resource.type),
      size: Number(resource.size)
    })) : []

    // 创建更新时间
    const now = new Date()
    const cstTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
    const timeStr = cstTime.toISOString().replace('Z', '+08:00')

    // 更新 memo
    const updatedMemo = await Memo.findByIdAndUpdate(
      id,
      {
        content: {
          raw: content,
          html: marked(content),
          text: content
        },
        resources: processedResources,
        tags: Array.isArray(tags) ? tags : [],
        updatedAt: timeStr
      },
      { new: true, runValidators: true }
    )

    if (!updatedMemo) {
      return res.status(404).json({ error: 'Memo not found' })
    }

    res.json(updatedMemo)
  } catch (error) {
    console.error('Error updating memo:', error)
    res.status(500).json({
      error: 'Failed to update memo',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

app.delete('/api/memos/:id', authenticateToken, async (req, res) => {
  try {
    const memo = await Memo.findByIdAndDelete(req.params.id)
    if (!memo) {
      return res.status(404).json({ error: 'Memo not found' })
    }
    res.json({ message: 'Memo deleted successfully' })
  } catch (error) {
    console.error('Error deleting memo:', error)
    res.status(500).json({ error: 'Failed to delete memo' })
  }
})

// 6. 静态文件服务
app.use('/uploads', express.static(uploadDir))

// 7. 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ 
    error: 'Internal Server Error',
    details: err.message
  })
})

// 8. 启动服务器
const PORT = 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on:`)
  console.log(`- Local: http://localhost:${PORT}`)
  console.log(`- Network: ${process.env.SERVER_URL}`)
})

// 获取本机 IP 地址
const getLocalIP = () => {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // 跳过内部 IP 和非 IPv4 地址
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

// 在服务器启动时
const IP = getLocalIP()
process.env.SERVER_URL = process.env.SERVER_URL || `http://${IP}:${PORT}`
