import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, Eye, EyeOff, AlertCircle, UserCog, Users, BriefcaseBusiness, User } from 'lucide-react'

const demoAccounts = [
  { role: 'Admin', email: 'admin@fuchsius.lk', password: 'admin123', icon: UserCog },
  { role: 'HR', email: 'nirmala.perera@fuchsius.lk', password: 'hr123456', icon: BriefcaseBusiness },
  { role: 'Manager', email: 'kasun.silva@fuchsius.lk', password: 'manager123', icon: Users },
  { role: 'Employee', email: 'dilini.jayawardena@fuchsius.lk', password: 'emp123456', icon: User },
]

export default function LoginPageWithDemo() {
  const { login, loading, error } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [localErr, setLocalErr] = useState('')

  const goToPortal = (user) => {
    const routes = { admin: '/admin', hr: '/hr', manager: '/manager', employee: '/employee' }
    navigate(routes[user.role] || '/login')
  }

  const handleLogin = async (event) => {
    event?.preventDefault()
    setLocalErr('')
    if (!email || !password) {
      setLocalErr('Please enter your email and password.')
      return
    }
    try {
      const user = await login(email, password)
      goToPortal(user)
    } catch (err) {
      setLocalErr(err.message)
    }
  }

  const useDemoAccount = (account) => {
    setEmail(account.email)
    setPassword(account.password)
    setLocalErr('')
  }

  const loginDemoAccount = async (account) => {
    setEmail(account.email)
    setPassword(account.password)
    setLocalErr('')
    try {
      const user = await login(account.email, account.password)
      goToPortal(user)
    } catch (err) {
      setLocalErr(err.message)
    }
  }

  const displayError = localErr || error

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-9">
          <div className="flex flex-col items-center mb-8 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center text-white">
              <Users className="w-8 h-8" />
            </div>
            <div className="text-center">
              <h1 className="text-gray-900 text-[19px] font-bold">Fuchsius HRMS</h1>
              <p className="text-gray-400 text-[12.5px] mt-1">Testing login with demo accounts</p>
            </div>
          </div>

          {displayError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 rounded-lg px-3 py-2 mb-5 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {displayError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="name@fuchsius.lk"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gray-900 focus:bg-white"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="Password"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-9 pr-9 text-sm outline-none focus:border-gray-900 focus:bg-white"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(value => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  {showPw ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gray-950 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-900">Demo Accounts</h2>
            <p className="text-xs text-gray-500 mt-1">Click Fill to copy credentials, or Login to enter directly.</p>
          </div>

          <div className="space-y-3">
            {demoAccounts.map(account => {
              const Icon = account.icon
              return (
                <div key={account.role} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-900 text-white flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{account.role}</p>
                      <p className="text-[11px] font-mono text-gray-500 truncate">{account.email}</p>
                      <p className="text-[11px] font-mono text-gray-400">{account.password}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => useDemoAccount(account)}
                      className="rounded-lg border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      Fill
                    </button>
                    <button
                      type="button"
                      onClick={() => loginDemoAccount(account)}
                      disabled={loading}
                      className="rounded-lg bg-gray-900 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
                    >
                      Login
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
