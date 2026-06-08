import React, { useRef, useState, useEffect } from 'react'
import { Download, FileText, ShieldCheck, Trash2, Upload, Loader2 } from 'lucide-react'
import { useHR } from '../../context/HRContext'
import { useAuth } from '../../context/AuthContext'

const categories = ['Contract', 'Identity', 'Certificate', 'Payroll', 'Performance', 'General']

export default function DocumentVault({ employeeId, canVerify = false }) {
  const inputRef = useRef(null)
  const { user } = useAuth()
  const { getEmployeeDocuments, addEmployeeDocument, verifyEmployeeDocument, deleteEmployeeDocument, documents } = useHR()
  const [category, setCategory] = useState('General')
  const [uploading, setUploading] = useState(false)
  const [localDocs, setLocalDocs] = useState([])

  useEffect(() => {
    if (!employeeId) return
    // Fetch documents for this employee
    getEmployeeDocuments(employeeId).then(docs => setLocalDocs(docs)).catch(() => {})
  }, [employeeId])

  // Keep in sync with context documents state
  useEffect(() => {
    if (documents[employeeId]) setLocalDocs(documents[employeeId])
  }, [documents, employeeId])

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await addEmployeeDocument(employeeId, file, category, user?.name || 'User')
      const docs = await getEmployeeDocuments(employeeId)
      setLocalDocs(docs)
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const downloadReceipt = (doc) => {
    // If filePath exists, open the actual file
    if (doc.filePath) {
      window.open(doc.filePath, '_blank')
      return
    }
    const blob = new Blob([
      `Fuchsius HRMS Document Receipt\n\nDocument: ${doc.name}\nCategory: ${doc.category}\nUploaded by: ${doc.uploadedBy}\nUploaded on: ${doc.uploadedOn}\nStatus: ${doc.status}\n`,
    ], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${doc.name.replace(/\.[^.]+$/, '')}-receipt.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleVerify = async (docId) => {
    await verifyEmployeeDocument(employeeId, docId)
    setLocalDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'Verified' } : d))
  }

  const handleDelete = async (docId) => {
    const confirmed = await window.fuchsiusConfirm('Remove this document from the employee vault?', {
      title: 'Remove Document',
      confirmLabel: 'Remove',
    })
    if (!confirmed) return
    await deleteEmployeeDocument(employeeId, docId)
    setLocalDocs(prev => prev.filter(d => d.id !== docId))
  }

  const canDelete = user?.role === 'admin' || user?.role === 'hr'

  return (
    <div className="card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Document Vault</h3>
          <p className="text-xs text-gray-500">Contracts, identity files, certificates, payroll and review documents.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="select text-xs w-36" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(item => <option key={item}>{item}</option>)}
          </select>
          <button
            className="btn-secondary text-xs flex items-center gap-1.5"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="w-full text-left">
          <thead>
            <tr>{['Document', 'Category', 'Uploaded By', 'Date', 'Status', 'Action'].map(h => <th key={h} className="table-head">{h}</th>)}</tr>
          </thead>
          <tbody>
            {localDocs.map(doc => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="table-cell font-medium text-gray-800">
                  <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-gray-400" />{doc.name}</span>
                </td>
                <td className="table-cell">{doc.category}</td>
                <td className="table-cell">{doc.uploadedBy}</td>
                <td className="table-cell">{doc.uploadedOn}</td>
                <td className="table-cell">
                  <span className={doc.status === 'Verified' ? 'badge-green' : 'badge-yellow'}>{doc.status}</span>
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost text-xs" onClick={() => downloadReceipt(doc)}>
                      <Download className="w-3.5 h-3.5" /> {doc.filePath ? 'Open' : 'Receipt'}
                    </button>
                    {canVerify && doc.status !== 'Verified' && (
                      <button className="btn-ghost text-xs" onClick={() => handleVerify(doc.id)}>
                        <ShieldCheck className="w-3.5 h-3.5" /> Verify
                      </button>
                    )}
                    {canDelete && (
                      <button className="btn-ghost text-xs text-red-600" onClick={() => handleDelete(doc.id)}>
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {localDocs.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No documents uploaded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
