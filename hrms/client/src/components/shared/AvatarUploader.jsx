import React, { useRef } from 'react'
import { Camera, Trash2, Loader2 } from 'lucide-react'

export default function AvatarUploader({ name, avatar, onChange, onFile, onRemove, loading = false, size = 'lg' }) {
  const inputRef = useRef(null)
  const dimensions = size === 'sm' ? 'w-12 h-12' : 'w-20 h-20'

  const handleFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (onFile) {
      onFile(file)
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => onChange(reader.result)
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <div className="relative inline-flex group">
      <div className={`${dimensions} rounded-full bg-gray-950 overflow-hidden flex items-center justify-center ring-4 ring-white border border-gray-200`}>
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl font-bold text-white">{name?.charAt(0)}</span>
        )}
        {loading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
      </div>
      <button
        type="button"
        className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        title="Upload profile picture"
      >
        <Camera className="w-4 h-4 text-gray-600" />
      </button>
      {avatar && onRemove && (
        <button
          type="button"
          className="absolute -left-1 -bottom-1 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-red-50"
          onClick={onRemove}
          disabled={loading}
          title="Remove profile picture"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
