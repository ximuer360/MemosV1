import { ref } from 'vue'
import { Router } from 'vue-router'
import router from '../router'  // 直接导入 router 实例

const TOKEN_KEY = 'admin_token'

export const useAuthStore = () => {
  const token = ref(localStorage.getItem(TOKEN_KEY))
  const isAuthenticated = ref(!!token.value)

  const setToken = (newToken: string) => {
    token.value = newToken
    localStorage.setItem(TOKEN_KEY, newToken)
    isAuthenticated.value = true
  }

  const handleResponse = async (response: Response) => {
    // 检查是否有新的 token
    const newToken = response.headers.get('X-New-Token')
    if (newToken) {
      setToken(newToken)
    }

    if (response.status === 401) {
      try {
        const data = await response.clone().json()
        if (data.code === 'TOKEN_EXPIRED') {
          // 尝试刷新 token
          const refreshResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Authorization': getAuthHeader()
            }
          })

          if (refreshResponse.ok) {
            const { token: newToken } = await refreshResponse.json()
            setToken(newToken)
            return true // 表示需要重试原请求
          } else {
            // 如果刷新失败，退出登录并重定向
            logout()
            window.location.href = '/login'  // 使用 window.location 进行重定向
            return false
          }
        }
      } catch (error) {
        console.error('Error handling response:', error)
        logout()
        window.location.href = '/login'  // 使用 window.location 进行重定向
        return false
      }
    }
    return false
  }

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || data.error || '登录失败')
      }

      setToken(data.token)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = () => {
    token.value = null
    localStorage.removeItem(TOKEN_KEY)
    isAuthenticated.value = false
  }

  const getAuthHeader = () => {
    return token.value ? `Bearer ${token.value}` : ''
  }

  return {
    token,
    isAuthenticated,
    login,
    logout,
    getAuthHeader,
    handleResponse
  }
} 