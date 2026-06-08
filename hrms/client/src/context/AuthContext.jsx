import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authApi, usersApi } from '../api/services'

const AuthContext = createContext(null)

export const roles = {
  ADMIN:    'admin',
  HR:       'hr',
  MANAGER:  'manager',
  EMPLOYEE: 'employee',
}

const loadToken = () => localStorage.getItem('fuchsius:token')
const saveToken = (t) => t ? localStorage.setItem('fuchsius:token', t) : localStorage.removeItem('fuchsius:token')

const loadUser = () => {
  try {
    const s = localStorage.getItem('fuchsius:currentUser')
    return s ? JSON.parse(s) : null
  } catch { return null }
}
const saveUser = (u) => {
  if (u) localStorage.setItem('fuchsius:currentUser', JSON.stringify(u))
  else   localStorage.removeItem('fuchsius:currentUser')
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => loadUser())
  const [token, setToken]     = useState(() => loadToken())
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // Verify token on mount
  useEffect(() => {
    const t = loadToken()
    if (t && !user) {
      authApi.me()
        .then(res => {
          const u = res.data.user
          setUser(u)
          saveUser(u)
        })
        .catch(() => {
          saveToken(null)
          saveUser(null)
          setUser(null)
          setToken(null)
        })
    }
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.login(email, password)
      const { token: newToken, user: newUser, employee } = res.data

      saveToken(newToken)
      setToken(newToken)

      // Attach employee info if available
      const enrichedUser = { ...newUser, employee }
      saveUser(enrichedUser)
      setUser(enrichedUser)

      return enrichedUser
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Check credentials.'
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  const googleLogin = async (credential) => {
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.google(credential)
      const { token: newToken, user: newUser, employee } = res.data
      saveToken(newToken)
      setToken(newToken)
      const enrichedUser = { ...newUser, employee }
      saveUser(enrichedUser)
      setUser(enrichedUser)
      return enrichedUser
    } catch (err) {
      const msg = err.response?.data?.error || 'Google sign-in failed.'
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try { await authApi.logout() } catch (_) {}
    saveToken(null)
    saveUser(null)
    setUser(null)
    setToken(null)
  }

  const updateUserProfile = async (updates) => {
    if (!user) return
    try {
      const res = await usersApi.updateMyProfile(updates)
      const updated = { ...user, ...res.data }
      setUser(updated)
      saveUser(updated)
    } catch (err) {
      // Fallback: update locally
      const updated = { ...user, ...updates }
      setUser(updated)
      saveUser(updated)
    }
  }

  const changePassword = async (currentPassword, newPassword) => {
    await authApi.changePassword(currentPassword, newPassword)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, googleLogin, logout, updateUserProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
