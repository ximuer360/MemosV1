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
import { Memo } from './models/memo.js'
import { networkInterfaces } from 'os'
import jwt from 'jsonwebtoken'

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

// 2. 认证相关路由
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body
  
  console.log('Login attempt details:', {
    receivedUsername: username,
    receivedPassword: password,
    adminUsername: process.env.ADMIN_USERNAME,
    adminPassword: process.env.ADMIN_PASSWORD
  })
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    console.log('Login successful')
    const token = jwt.sign(
      { username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )
    res.json({ token })
  } else {
    console.log('Login failed: Invalid credentials')
    res.status(401).json({ 
      error: 'Invalid credentials',
      message: '用户名或密码错误'
    })
  }
})

// 3. 公共 API 路由
app.get('/api/memos', async (req, res) => {
  try {
    const memos = await Memo.find()
      .sort({ createdAt: -1 })
      .collation({ locale: 'en' })
      .exec()
    res.json(memos)
  } catch (error) {
    console.error('Error fetching memos:', error)
    res.status(500).json({ error: 'Failed to fetch memos' })
  }
})

app.post('/api/memos', async (req, res) => {
  try {
    const { content, resources = [] } = req.body
    const processedContent = processContent(content)
    
    // 创建 ISO 格式的时间字符串
    const now = new Date()
    const cstTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
    const timeStr = cstTime.toISOString().replace('Z', '+08:00')
    
    const memo = new Memo({
      content: processedContent,
      userId: '1',
      visibility: 'PUBLIC',
      resources: resources,
      createdAt: timeStr,
      updatedAt: timeStr
    })
    
    const savedMemo = await memo.save()
    res.json(savedMemo)
  } catch (error) {
    console.error('Error creating memo:', error)
    res.status(500).json({ error: 'Failed to create memo' })
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

// 修改按日期获取记录的路由
app.get('/api/memos/date/:date', async (req, res) => {
  try {
    const datePrefix = req.params.date
    const startTimeStr = `${datePrefix}T00:00:00+08:00`
    const endTimeStr = `${datePrefix}T23:59:59.999+08:00`
    
    console.log('Querying date range:', {
      date: datePrefix,
      startTimeStr,
      endTimeStr
    })
    
    const memos = await Memo.find({
      createdAt: {
        $gte: startTimeStr,
        $lte: endTimeStr
      }
    })
    .sort({ createdAt: -1 })
    .collation({ locale: 'en' })
    .exec()
    
    console.log(`Found ${memos.length} memos for date ${datePrefix}`)
    res.json(memos)
  } catch (error) {
    console.error('Error fetching memos by date:', error)
    res.status(500).json({ error: 'Failed to fetch memos' })
  }
})

// 4. 认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' })
    }
    req.user = user
    next()
  })
}

// 5. 需要认证的 API 路由
app.put('/api/memos/:id', authenticateToken, async (req, res) => {
  try {
    const { content, resources } = req.body
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: '内容不能为空' })
    }
    
    const processedContent = processContent(content)
    
    // 创建 ISO 格式的时间字符串
    const now = new Date()
    const cstTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
    const timeStr = cstTime.toISOString().replace('Z', '+08:00')
    
    const memo = await Memo.findByIdAndUpdate(
      req.params.id,
      { 
        content: processedContent,
        resources: resources || [],
        updatedAt: timeStr,
      },
      { new: true }
    )
    
    if (!memo) {
      return res.status(404).json({ error: '记录不存在' })
    }
    
    res.json(memo)
  } catch (error) {
    console.error('Error updating memo:', error)
    res.status(500).json({ error: '更新失败' })
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
