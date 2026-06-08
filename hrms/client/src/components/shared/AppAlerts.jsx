import React, { useEffect, useRef, useState } from 'react'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
}

const toneClasses = {
  success: 'text-emerald-700 bg-emerald-50',
  error: 'text-red-700 bg-red-50',
  warning: 'text-amber-700 bg-amber-50',
  info: 'text-gray-700 bg-gray-100',
}

const inferTone = (message) => {
  const text = String(message || '').toLowerCase()
  if (text.includes('failed') || text.includes('error') || text.includes('required') || text.includes('do not match')) return 'error'
  if (text.includes('success') || text.includes('saved') || text.includes('created') || text.includes('updated')) return 'success'
  return 'info'
}

function ToastContent({ message, tone }) {
  const Icon = icons[tone] || Info
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 rounded-md p-1.5 ${toneClasses[tone] || toneClasses.info}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium leading-5 text-gray-800 whitespace-pre-line">
        {message}
      </p>
    </div>
  )
}

export default function AppAlerts() {
  const [confirmState, setConfirmState] = useState(null)
  const confirmResolver = useRef(null)

  const addToast = (message, tone = inferTone(message)) => {
    const type = ['success', 'error', 'warning', 'info'].includes(tone) ? tone : 'info'
    toast(<ToastContent message={String(message || '')} tone={type} />, {
      type,
      icon: false,
      className: 'fuchsius-toast',
      progressClassName: `fuchsius-toast-progress fuchsius-toast-progress-${type}`,
    })
  }

  const resolveConfirm = (value) => {
    if (confirmResolver.current) confirmResolver.current(value)
    confirmResolver.current = null
    setConfirmState(null)
  }

  useEffect(() => {
    const originalAlert = window.alert
    const originalFuchsiusToast = window.fuchsiusToast
    const originalFuchsiusConfirm = window.fuchsiusConfirm

    window.alert = (message) => addToast(message)
    window.fuchsiusToast = (message, tone) => addToast(message, tone)
    window.fuchsiusConfirm = (message, options = {}) => new Promise(resolve => {
      confirmResolver.current = resolve
      setConfirmState({
        message,
        title: options.title || 'Confirm Action',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        tone: options.tone || 'warning',
      })
    })

    return () => {
      window.alert = originalAlert
      window.fuchsiusToast = originalFuchsiusToast
      window.fuchsiusConfirm = originalFuchsiusConfirm
    }
  }, [])

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5200}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        limit={4}
        toastClassName="fuchsius-toast"
        bodyClassName="fuchsius-toast-body"
      />

      {confirmState && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => resolveConfirm(false)} />
          <div className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-modal">
            <div className="flex items-start gap-3 border-b border-gray-100 p-5">
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-950">{confirmState.title}</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">{confirmState.message}</p>
              </div>
            </div>
            <div className="flex gap-3 p-4">
              <button className="btn-danger flex-1" onClick={() => resolveConfirm(true)}>
                {confirmState.confirmLabel}
              </button>
              <button className="btn-secondary" onClick={() => resolveConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
