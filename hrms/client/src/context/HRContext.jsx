import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  employeesApi, leavesApi, jobsApi, candidatesApi,
  payrollApi, performanceApi, attendanceApi, notificationsApi,
} from '../api/services'
import { useAuth } from './AuthContext'

const HRContext = createContext(null)

export function HRProvider({ children }) {
  const { token, user } = useAuth()
  const [employees,          setEmployees]         = useState([])
  const [leaveRequests,      setLeaveRequests]     = useState([])
  const [jobOpenings,        setJobOpenings]       = useState([])
  const [candidates,         setCandidates]        = useState([])
  const [payrollData,        setPayrollData]       = useState([])
  const [performanceReviews, setPerformanceReviews]= useState([])
  const [attendanceToday,    setAttendanceToday]   = useState([])
  const [notifications,      setNotifications]     = useState([])
  const [performanceCycles,  setPerformanceCycles] = useState([])
  const [documents,          setDocuments]         = useState({})

  const [loadingMap, setLoadingMap] = useState({})
  const setLoading = (key, val) => setLoadingMap(p => ({ ...p, [key]: val }))

  // ── Fetch helpers ──────────────────────────────────────────────────
  const fetchEmployees = useCallback(async (params) => {
    setLoading('employees', true)
    try {
      const res = await employeesApi.list(params)
      setEmployees(res.data)
    } catch (e) { console.error('fetchEmployees', e) }
    finally { setLoading('employees', false) }
  }, [])

  const fetchLeaves = useCallback(async (params) => {
    setLoading('leaves', true)
    try {
      const res = await leavesApi.list(params)
      setLeaveRequests(res.data)
    } catch (e) { console.error('fetchLeaves', e) }
    finally { setLoading('leaves', false) }
  }, [])

  const fetchAttendanceToday = useCallback(async () => {
    try {
      const res = await attendanceApi.today()
      setAttendanceToday(res.data)
    } catch (e) { console.error('fetchAttendanceToday', e) }
  }, [])

  const fetchPayroll = useCallback(async (params) => {
    try {
      const res = await payrollApi.list(params)
      setPayrollData(res.data)
    } catch (e) { console.error('fetchPayroll', e) }
  }, [])

  const fetchJobs = useCallback(async () => {
    try {
      const res = await jobsApi.list()
      setJobOpenings(res.data)
    } catch (e) { console.error('fetchJobs', e) }
  }, [])

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await candidatesApi.list()
      setCandidates(res.data)
    } catch (e) { console.error('fetchCandidates', e) }
  }, [])

  const fetchPerformanceReviews = useCallback(async () => {
    try {
      const res = await performanceApi.reviews()
      setPerformanceReviews(res.data)
    } catch (e) { console.error('fetchReviews', e) }
  }, [])

  const fetchPerformanceCycles = useCallback(async () => {
    try {
      const res = await performanceApi.cycles()
      setPerformanceCycles(res.data)
    } catch (e) { console.error('fetchCycles', e) }
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.list()
      setNotifications(res.data)
    } catch (e) { console.error('fetchNotifications', e) }
  }, [])

  // Initial data load
  useEffect(() => {
    if (!token) return
    fetchEmployees()
    fetchLeaves()
    fetchAttendanceToday()
    fetchPayroll()
    fetchJobs()
    fetchCandidates()
    fetchPerformanceReviews()
    fetchPerformanceCycles()
    fetchNotifications()
  }, [token, user?.id])

  // ── Employee CRUD ──────────────────────────────────────────────────
  const addEmployee = async (data) => {
    const res = await employeesApi.create(data)
    const emp = res.data.employee || res.data
    setEmployees(prev => [...prev, emp])
    await fetchNotifications()
    return { ...res.data, employee: emp, id: emp.id }
  }

  const editEmployee = async (id, data) => {
    const res = await employeesApi.update(id, data)
    setEmployees(prev => prev.map(e => e.id === id ? res.data : e))
    return res.data
  }

  const deleteEmployee = async (id) => {
    await employeesApi.delete(id)
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: 'Inactive' } : e))
  }

  const permanentlyDeleteEmployee = async (id) => {
    await employeesApi.deletePermanent(id)
    setEmployees(prev => prev.filter(e => e.id !== id))
  }

  // ── Leave ──────────────────────────────────────────────────────────
  const approveLeave = async (id, note = '') => {
    const res = await leavesApi.approve(id, note)
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, ...res.data } : l))
    await fetchEmployees()
    await fetchNotifications()
  }

  const rejectLeave = async (id, note = '') => {
    const res = await leavesApi.reject(id, note)
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, ...res.data, status: 'Rejected' } : l))
    await fetchNotifications()
  }

  const applyLeave = async (request) => {
    const res = await leavesApi.apply(request)
    const leave = res.data
    setLeaveRequests(prev => [leave, ...prev])
    await fetchNotifications()
    return leave.id
  }

  // ── Attendance ─────────────────────────────────────────────────────
  const markAttendance = async (empId, updates) => {
    setAttendanceToday(prev => prev.map(r => r.id === empId ? { ...r, ...updates } : r))
  }

  const checkIn = async () => {
    const res = await attendanceApi.checkIn()
    await fetchAttendanceToday()
    return res.data
  }

  const checkOut = async () => {
    const res = await attendanceApi.checkOut()
    await fetchAttendanceToday()
    return res.data
  }

  // ── Recruitment ────────────────────────────────────────────────────
  const addJob = async (job) => {
    const res = await jobsApi.create(job)
    setJobOpenings(prev => [res.data, ...prev])
  }

  const closeJob = async (id) => {
    await jobsApi.close(id)
    setJobOpenings(prev => prev.map(j => j.id === id ? { ...j, status: 'Closed' } : j))
  }

  const reopenJob = async (id) => {
    await jobsApi.reopen(id)
    setJobOpenings(prev => prev.map(j => j.id === id ? { ...j, status: 'Active' } : j))
  }

  const deleteJob = async (id) => {
    const res = await jobsApi.delete(id)
    setJobOpenings(prev => prev.filter(j => j.id !== id))
    return res.data
  }

  const moveCandidate = async (id, stage) => {
    await candidatesApi.move(id, stage)
    const status = stage === 'Hired' ? 'Hired' : stage === 'Offer Sent' ? 'Offer' : 'In Progress'
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, stage, status } : c))
  }

  const rejectCandidate = async (id) => {
    await candidatesApi.reject(id)
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: 'Rejected', stage: 'Rejected' } : c))
  }

  const addCandidate = async (candidate) => {
    const res = await candidatesApi.create(candidate)
    setCandidates(prev => [res.data, ...prev])
    await fetchJobs()
    return res.data
  }

  const updateCandidate = async (id, candidate) => {
    const res = await candidatesApi.update(id, candidate)
    setCandidates(prev => prev.map(c => c.id === id ? res.data : c))
    await fetchJobs()
    return res.data
  }

  const convertCandidate = async (id, onboarding) => {
    const res = await candidatesApi.convert(id, onboarding)
    setCandidates(prev => prev.map(c => c.id === id ? res.data.candidate : c))
    setEmployees(prev => [...prev, res.data.employee])
    await fetchEmployees()
    await fetchNotifications()
    return res.data
  }

  // ── Performance ────────────────────────────────────────────────────
  const createPerformanceCycle = async (cycle) => {
    const res = await performanceApi.createCycle(cycle)
    setPerformanceCycles(prev => [res.data, ...prev])
    await fetchNotifications()
    return res.data.id
  }

  const launchPerformanceCycle = async (id) => {
    await performanceApi.launchCycle(id)
    setPerformanceCycles(prev => prev.map(c => c.id === id ? { ...c, status: 'In Progress' } : c))
    await fetchPerformanceReviews()
    await fetchNotifications()
  }

  const completePerformanceCycle = async (id) => {
    await performanceApi.completeCycle(id)
    setPerformanceCycles(prev => prev.map(c => c.id === id ? { ...c, status: 'Completed' } : c))
    await fetchNotifications()
  }

  const updatePerformanceReview = async (id, data) => {
    const res = await performanceApi.updateReview(id, data)
    setPerformanceReviews(prev => prev.map(r => r.id === id ? res.data : r))
    await fetchNotifications()
    return res.data
  }

  const submitSelfReview = async (id, selfReview) => {
    const res = await performanceApi.selfReview(id, selfReview)
    setPerformanceReviews(prev => prev.map(r => r.id === id ? res.data : r))
    return res.data
  }

  const calibratePerformanceReview = async (id, data) => {
    const res = await performanceApi.calibrateReview(id, data)
    setPerformanceReviews(prev => prev.map(r => r.id === id ? res.data : r))
    await fetchNotifications()
    return res.data
  }

  // ── Documents ──────────────────────────────────────────────────────
  const getEmployeeDocuments = async (employeeId) => {
    const res = await employeesApi.getDocuments(employeeId)
    setDocuments(prev => ({ ...prev, [employeeId]: res.data }))
    return res.data
  }

  const addEmployeeDocument = async (employeeId, file, category = 'General', uploadedBy = 'HR') => {
    const res = await employeesApi.uploadDocument(employeeId, file, category)
    const doc = res.data
    setDocuments(prev => ({ ...prev, [employeeId]: [doc, ...(prev[employeeId] || [])] }))
    await fetchNotifications()
    return doc.id
  }

  const verifyEmployeeDocument = async (employeeId, documentId) => {
    await employeesApi.verifyDocument(employeeId, documentId)
    setDocuments(prev => ({
      ...prev,
      [employeeId]: (prev[employeeId] || []).map(d =>
        d.id === documentId ? { ...d, status: 'Verified' } : d
      ),
    }))
  }

  const deleteEmployeeDocument = async (employeeId, documentId) => {
    await employeesApi.deleteDocument(employeeId, documentId)
    setDocuments(prev => ({
      ...prev,
      [employeeId]: (prev[employeeId] || []).filter(d => d.id !== documentId),
    }))
    await fetchNotifications()
  }

  // ── Notifications ──────────────────────────────────────────────────
  const addNotification = () => { fetchNotifications() }

  const isNotificationRead = (notification, role) =>
    Boolean(notification.read)

  const markNotificationRead = async (id) => {
    await notificationsApi.read(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllNotificationsRead = async () => {
    await notificationsApi.readAll()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // ── Run Payroll ────────────────────────────────────────────────────
  const runPayroll = async (month) => {
    const res = await payrollApi.run(month)
    await fetchPayroll()
    await fetchNotifications()
    return res.data
  }

  return (
    <HRContext.Provider value={{
      // data
      employees, leaveRequests, jobOpenings, candidates,
      payrollData, performanceReviews, attendanceToday,
      notifications, performanceCycles, documents, loadingMap,
      // fetch helpers
      fetchEmployees, fetchLeaves, fetchAttendanceToday,
      fetchPayroll, fetchJobs, fetchCandidates, fetchNotifications,
      // employee ops
      addEmployee, editEmployee, deleteEmployee, permanentlyDeleteEmployee,
      // leave ops
      approveLeave, rejectLeave, applyLeave,
      // attendance ops
      markAttendance, checkIn, checkOut,
      // recruitment ops
      addJob, closeJob, reopenJob, deleteJob, addCandidate, updateCandidate, convertCandidate, moveCandidate, rejectCandidate,
      // notifications
      addNotification, isNotificationRead, markNotificationRead, markAllNotificationsRead,
      // performance
      createPerformanceCycle, launchPerformanceCycle, completePerformanceCycle,
      updatePerformanceReview, submitSelfReview, calibratePerformanceReview,
      // document vault
      getEmployeeDocuments, addEmployeeDocument, verifyEmployeeDocument, deleteEmployeeDocument,
      // payroll
      runPayroll,
    }}>
      {children}
    </HRContext.Provider>
  )
}

export const useHR = () => useContext(HRContext)
