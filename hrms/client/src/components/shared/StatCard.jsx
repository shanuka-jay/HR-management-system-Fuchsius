import React from 'react'

export default function StatCard({
  label,
  value,
  icon: Icon,
  change,
  changeType = 'up',
  sub,
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            {label}
          </p>

          <p className="text-2xl font-bold text-gray-900">
            {value}
          </p>

          {sub && (
            <p className="text-xs text-gray-400 mt-0.5">
              {sub}
            </p>
          )}

          {change && (
            <p
              className={`text-xs font-medium mt-1 ${
                changeType === 'up'
                  ? 'text-emerald-600'
                  : 'text-red-500'
              }`}
            >
              {changeType === 'up' ? 'Up' : 'Down'} {change}
            </p>
          )}
        </div>

        {Icon && (
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5 text-gray-600" />
          </div>
        )}
      </div>
    </div>
  )
}
