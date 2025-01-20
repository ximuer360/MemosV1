import { ref } from 'vue'

const TOKEN_KEY = 'admin_token'

export const useAuthStore = () => {
  const token = ref(localStorage.getItem(TOKEN_KEY))
  const isAuthenticated = ref(!!token.value)

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

      token.value = data.token
      localStorage.setItem(TOKEN_KEY, data.token)
      isAuthenticated.value = true
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
    getAuthHeader
  }
} 