import React, { useState, useEffect } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import { Download, Loader2, Search } from 'lucide-react'
import { exportRowsAsCsv } from '../../../components/shared/exportUtils'
import { auditLogsApi } from '../../../api/services'

const actionBadge = (action) => {
  if (action.includes('CREATE') || action.includes('LOGIN') || action.includes('RUN')) return 'badge-green'
  if (action.includes('DELETE') || action.includes('DEACTIVATE') || action.includes('REJECT')) return 'badge-red'
  if (action.includes('UPDATE') || action.includes('APPROVE')) return 'badge-yellow'
  return 'badge-gray'
}

export default function AdminAuditLogs() {
  const [logs,    setLogs]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  const loadLogs = async (p = 1) => {
    setLoading(true)
    try {
      const res = await auditLogsApi.list({ page: p, limit: 25 })
      setLogs(res.data.logs || [])
      setTotal(res.data.total || 0)
      setPages(res.data.pages || 1)
      setPage(p)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadLogs(1) }, [])

  const filtered = logs.filter(l =>
    !search ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.user.toLowerCase().includes(search.toLowerCase()) ||
    (l.detail || '').toLowerCase().includes(search.toLowerCase())
  )

  const exportAudit = () => exportRowsAsCsv('fuchsius-hrms-audit-logs.csv', filtered.map(log => ({
    Timestamp: log.time,
    User:      log.user,
    Role:      log.role,
    Action:    log.action,
    Module:    log.module,
    Details:   log.detail,
  })))

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle={`${total} total events — all system activity is recorded`}
        actions={
          <>
            <button className="btn-secondary text-xs" onClick={exportAudit}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search action, user, detail…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading audit logs…
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {['Timestamp','User','Role','Action','Module','Details'].map(h => (
                  <th key={h} className="table-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => (
                <tr key={log.id || i} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-mono text-xs text-gray-500">
                    {new Date(log.time).toLocaleString()}
                  </td>
                  <td className="table-cell font-medium text-gray-800">{log.user}</td>
                  <td className="table-cell">
                    <span className="badge-gray capitalize">{log.role}</span>
                  </td>
                  <td className="table-cell">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                      {log.action}
                    </code>
                  </td>
                  <td className="table-cell text-gray-500">{log.module}</td>
                  <td className="table-cell text-xs text-gray-600 max-w-xs truncate">{log.detail}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">No audit events found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">{total} total events</p>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-xs"
              onClick={() => loadLogs(page - 1)}
              disabled={page <= 1}
            >← Prev</button>
            <span className="text-xs text-gray-500 flex items-center px-3">Page {page} of {pages}</span>
            <button
              className="btn-secondary text-xs"
              onClick={() => loadLogs(page + 1)}
              disabled={page >= pages}
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}
