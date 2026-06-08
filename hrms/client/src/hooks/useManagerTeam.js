import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useHR } from '../context/HRContext'

export default function useManagerTeam() {
  const { user } = useAuth()
  const { employees } = useHR()

  const team = useMemo(() => {
    if (!user?.name) return []
    const managerEmployee = employees.find(emp => emp.userId === user.id || emp.email === user.email || emp.name === user.name)
    return employees.filter(emp => (
      (managerEmployee && emp.managerId === managerEmployee.id) ||
      emp.manager === user.name
    ))
  }, [employees, user?.id, user?.email, user?.name])

  const teamIds = useMemo(() => team.map(emp => emp.id), [team])

  return { manager: user, team, teamIds }
}
