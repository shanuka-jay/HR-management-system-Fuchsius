export default function PageHeader({ title, subtitle, children, actions, meta }) {
  return (
    <div className="page-header">
      <div className="flex-1">
        {meta && <p className="page-kicker">{meta}</p>}
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>

      {(children || actions) && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
          {children}
        </div>
      )}
    </div>
  )
}
