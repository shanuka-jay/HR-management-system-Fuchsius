import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/services'
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

let googleIdentityScriptPromise

const loadGoogleIdentityScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Google sign-in script failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google sign-in script failed to load.'))
    document.head.appendChild(script)
  })

  return googleIdentityScriptPromise
}

export default function LoginPage() {
  const { login, googleLogin, loading, error } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [localErr, setLocalErr] = useState('')
  const [notice, setNotice] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const demoAccounts = [
    { label: 'Admin', email: 'admin@fuchsius.lk', password: 'admin123' },
    { label: 'HR', email: 'nirmala.perera@fuchsius.lk', password: 'hr123456' },
    { label: 'Manager', email: 'kasun.silva@fuchsius.lk', password: 'manager123' },
    { label: 'Employee', email: 'dilini.jayawardena@fuchsius.lk', password: 'emp123456' },
  ]

  const goToPortal = (user) => {
    const routes = { admin: '/admin', hr: '/hr', manager: '/manager', employee: '/employee' }
    navigate(routes[user.role] || '/login')
  }

  const handleLogin = async (e) => {
    e?.preventDefault()
    setLocalErr('')
    setNotice('')
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

  const handleDemoLogin = async (account) => {
    setEmail(account.email)
    setPassword(account.password)
    setLocalErr('')
    setNotice('')
    try {
      const user = await login(account.email, account.password)
      goToPortal(user)
    } catch (err) {
      setLocalErr(err.message)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLocalErr('')
    setNotice('')
    if (!email) {
      setLocalErr('Enter your Fuchsius email address first.')
      return
    }
    setForgotLoading(true)
    try {
      const res = await authApi.forgotPassword(email)
      setNotice(res.data?.message || 'Password reset request sent to HR support.')
    } catch (err) {
      setLocalErr(err.response?.data?.error || 'Could not start password reset.')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLocalErr('')
    setNotice('')
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

    if (!googleClientId) {
      setLocalErr('Google SSO is not configured. Add the Google Client ID to client and server environment settings.')
      return
    }

    setGoogleLoading(true)
    try {
      await loadGoogleIdentityScript()
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        cancel_on_tap_outside: true,
        callback: async (response) => {
          if (!response?.credential) {
            setLocalErr('Google sign-in did not return a credential.')
            setGoogleLoading(false)
            return
          }
          setGoogleLoading(true)
          try {
            const user = await googleLogin(response.credential)
            goToPortal(user)
          } catch (err) {
            setLocalErr(err.message || 'Google sign-in could not be verified.')
          } finally {
            setGoogleLoading(false)
          }
        },
      })

      window.google.accounts.id.prompt((notification) => {
        const blocked = notification.isNotDisplayed?.() || notification.isSkippedMoment?.()
        if (blocked) {
          setLocalErr('Google sign-in could not open. Check the Google Client ID, allowed origins, and browser settings.')
        }
        setGoogleLoading(false)
      })
    } catch (err) {
      setLocalErr(err.message || 'Google sign-in is not available right now.')
      setGoogleLoading(false)
    }
  }

  const handleContactSupport = (e) => {
    e.preventDefault()
    const subject = encodeURIComponent('Fuchsius HRMS login support')
    const body = encodeURIComponent(`Hello Fuchsius Support,\n\nI need help accessing my HRMS account.\n\nEmail: ${email || ''}\n`)
    window.location.href = `mailto:support@fuchsius.lk?subject=${subject}&body=${body}`
  }

  const displayError = localErr || error

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');

        .lp-root { font-family: 'Inter', sans-serif; }
        .lp-brand { font-family: 'Sora', sans-serif; }

        .lp-input {
          width: 100%;
          background: #f9f9f9;
          border: 1.5px solid #e8e8e8;
          color: #111;
          border-radius: 10px;
          padding: 9px 14px 9px 36px;
          font-size: 13.5px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
        }
        .lp-input::placeholder { color: #c0c0c0; }
        .lp-input:hover { border-color: #ccc; background: #f5f5f5; }
        .lp-input:focus { border-color: #555; background: #fff; box-shadow: 0 0 0 3px rgba(0,0,0,0.06); }
        .lp-input-pr { padding-right: 36px; }

        .lp-btn-primary {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 0;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 600;
          font-family: 'Sora', sans-serif;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .lp-btn-primary:hover:not(:disabled) {
          background: #2a2a2a;
          box-shadow: 0 4px 14px rgba(0,0,0,0.22);
          transform: translateY(-1px);
        }
        .lp-btn-primary:active:not(:disabled) {
          background: #000;
          transform: translateY(0px) scale(0.99);
          box-shadow: 0 1px 4px rgba(0,0,0,0.18);
        }
        .lp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .lp-btn-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 9px 0;
          background: #fff;
          border: 1.5px solid #e8e8e8;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          color: #444;
          cursor: pointer;
          transition: background 0.18s, border-color 0.18s, box-shadow 0.18s, transform 0.12s;
        }
        .lp-btn-google:hover:not(:disabled) {
          background: #f5f5f5;
          border-color: #bbb;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }
        .lp-btn-google:active:not(:disabled) {
          background: #efefef;
          transform: translateY(0) scale(0.99);
          box-shadow: none;
        }
        .lp-btn-google:disabled { opacity: 0.55; cursor: not-allowed; }

        .lp-forgot {
          font-size: 11.5px;
          font-weight: 500;
          color: #999;
          text-decoration: none;
          transition: color 0.15s;
          padding: 2px 0;
          border: 0;
          border-bottom: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .lp-forgot:hover { color: #222; border-bottom-color: #222; }
        .lp-forgot:disabled { opacity: 0.55; cursor: not-allowed; }

        .lp-support-link {
          color: #555;
          font-weight: 600;
          text-decoration: none;
          border: 0;
          border-bottom: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s, border-color 0.15s;
        }
        .lp-support-link:hover { color: #111; border-bottom-color: #111; }

        .lp-eye-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: #bbb;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .lp-eye-btn:hover { color: #555; }

        .lp-checkbox {
          width: 14px;
          height: 14px;
          border-radius: 4px;
          border: 1.5px solid #d0d0d0;
          accent-color: #111;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .lp-checkbox:hover { border-color: #888; }

        .lp-demo-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 14px;
        }
        .lp-demo-btn {
          border: 1px solid #e5e5e5;
          background: #fafafa;
          color: #333;
          border-radius: 9px;
          padding: 8px 10px;
          font-size: 11.5px;
          font-weight: 700;
          transition: background 0.16s, border-color 0.16s, transform 0.12s;
        }
        .lp-demo-btn:hover:not(:disabled) {
          background: #f1f1f1;
          border-color: #cfcfcf;
          transform: translateY(-1px);
        }
        .lp-demo-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>

      <div className="lp-root min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-9">

          {/* Brand */}
          <div className="flex flex-col items-center mb-8 gap-3">
            <div className="relative w-14 h-14 mb-1">
              <div className="absolute inset-0 rounded-2xl bg-gray-900 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="11" cy="10" r="4.5" fill="white" fillOpacity="0.9"/>
                  <path d="M2 26c0-5 4-8 9-8s9 3 9 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <circle cx="22" cy="10" r="4" fill="white" fillOpacity="0.4"/>
                  <path d="M14.5 26c0.5-3.5 3.5-6 7.5-6s7 2.5 7.5 6" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.4"/>
                </svg>
              </div>
            </div>
            <div className="text-center">
              <h1 className="lp-brand text-gray-900 text-[19px] font-bold" style={{ letterSpacing: '-0.025em' }}>
                Fuchsius HRMS
              </h1>
              <p className="text-gray-400 text-[12.5px] mt-1 leading-snug">
                Sign in to access your workspace
              </p>
            </div>
          </div>

          {/* Error */}
          {displayError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 rounded-lg px-3 py-2 mb-5 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {displayError}
            </div>
          )}

          {notice && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-lg px-3 py-2 mb-5 text-xs">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {notice}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@fuchsius.lk"
                  className="lp-input"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                  Password
                </label>
                <button type="button" onClick={handleForgotPassword} disabled={forgotLoading} className="lp-forgot">
                  {forgotLoading ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="lp-input lp-input-pr"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="lp-eye-btn absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPw ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="lp-checkbox"
              />
              <label htmlFor="remember" className="text-[12px] text-gray-400 cursor-pointer select-none">
                Remember me for 30 days
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="lp-btn-primary mt-1"
            >
              {loading
                ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Sign in'
              }
            </button>
          </form>

          <div className="lp-demo-grid">
            {demoAccounts.map(account => (
              <button
                key={account.label}
                type="button"
                className="lp-demo-btn"
                disabled={loading}
                onClick={() => handleDemoLogin(account)}
                title={`${account.email} / ${account.password}`}
              >
                Demo {account.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[11px] text-gray-400 tracking-wide">or continue with</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Google */}
          <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading} className="lp-btn-google">
            <svg width="15" height="15" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            {googleLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          {/* Support */}
          <p className="text-center text-[11.5px] text-gray-400 mt-6 pt-5 border-t border-gray-100">
            Need help?{' '}
            <button type="button" onClick={handleContactSupport} className="lp-support-link">Contact Support</button>
          </p>
        </div>
      </div>
    </>
  )
}
