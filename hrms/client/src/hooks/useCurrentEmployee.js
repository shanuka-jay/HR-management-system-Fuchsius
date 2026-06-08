import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useHR } from '../context/HRContext'

export default function useCurrentEmployee() {
  const { user } = useAuth()
  const { employees, loadingMap } = useHR()

  const employee = useMemo(() => {
    if (!user) return null
    const liveEmployee = employees.find(item => item.userId === user.id || item.email === user.email)
    return liveEmployee || user.employee || null
  }, [employees, user])

  return {
    employee,
    user,
    loading: Boolean(loadingMap?.employees),
    isLinked: Boolean(employee?.id),
  }
}
