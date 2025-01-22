import type { Memo } from '../types/memo'
import { useAuthStore } from '../stores/auth'

const API_URL = `${import.meta.env.VITE_API_URL}/api`

// 添加带重试的请求函数
async function fetchWithRetry(url: string, options: RequestInit, retryCount = 1): Promise<Response> {
  const authStore = useAuthStore()
  try {
    const response = await fetch(url, options)
    
    // 如果是 401 错误，尝试刷新 token
    if (response.status === 401) {
      const shouldRetry = await authStore.handleResponse(response)
      if (shouldRetry && retryCount > 0) {
        // 更新 Authorization header
        options.headers = {
          ...options.headers,
          'Authorization': authStore.getAuthHeader()
        }
        // 重试请求
        return fetchWithRetry(url, options, retryCount - 1)
      }
    }
    
    return response
  } catch (error) {
    console.error('Request failed:', error)
    throw error
  }
}

export const memoApi = {
  async getAllMemos(): Promise<Memo[]> {
    const response = await fetchWithRetry(`${API_URL}/memos`, {
      headers: {
        'Authorization': useAuthStore().getAuthHeader()
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  },

  async createMemo(content: string, resources: Array<{ url: string, name: string, type: string, size: number }>, tags: string[]): Promise<Memo> {
    const response = await fetchWithRetry(`${API_URL}/memos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': useAuthStore().getAuthHeader()
      },
      body: JSON.stringify({ content, resources, tags })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create memo')
    }
    return response.json()
  },

  async getMemosByDate(date: string): Promise<Memo[]> {
    const response = await fetch(`${API_URL}/memos/date/${date}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  },

  async deleteMemo(id: string): Promise<void> {
    const response = await fetchWithRetry(`${API_URL}/memos/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': useAuthStore().getAuthHeader()
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  },

  async updateMemo(
    id: string,
    content: string,
    resources: Array<{ url: string, name: string, type: string, size: number }>,
    tags: string[]
  ): Promise<Memo> {
    const response = await fetchWithRetry(`${API_URL}/memos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': useAuthStore().getAuthHeader()
      },
      body: JSON.stringify({ content, resources, tags })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update memo')
    }
    
    return response.json()
  }
} 