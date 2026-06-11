import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getCurrentUser, login as apiLogin, logout as apiLogout, register as apiRegister, getToken } from '@/api/client'
import type { User, UserRole, LoginResponse } from '@/types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check if user is logged in on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken()
      if (token) {
        try {
          const currentUser = await getCurrentUser()
          setUser(currentUser)
        } catch (error) {
          console.error('Failed to get current user:', error)
          // Token might be expired, clear it
          await apiLogout()
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const response: LoginResponse = await apiLogin(email, password)
    setUser(response.user)
  }

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    const response: LoginResponse = await apiRegister(email, password, name, role)
    setUser(response.user)
  }

  const logout = async () => {
    await apiLogout()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
