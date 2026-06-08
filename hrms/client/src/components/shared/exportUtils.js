export const exportRowsAsCsv = (filename, rows) => {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(header => `"${String(row[header] ?? '').replaceAll('"', '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const exportRowsAsPdf = ({ title, subtitle, filename, rows }) => {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const tableRows = rows.map(row =>
    `<tr>${headers.map(header => `<td>${String(row[header] ?? '')}</td>`).join('')}</tr>`
  ).join('')
  const html = `<!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 32px; }
          .brand { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #6b7280; font-weight: 800; }
          h1 { margin: 6px 0 4px; font-size: 24px; }
          p { margin: 0 0 24px; color: #6b7280; font-size: 13px; }
          table { border-collapse: collapse; width: 100%; border: 1px solid #d1d5db; }
          th { background: #111827; color: white; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; padding: 10px; }
          td { border-top: 1px solid #e5e7eb; padding: 10px; font-size: 12px; }
          tr:nth-child(even) td { background: #f9fafb; }
          .footer { margin-top: 18px; font-size: 11px; color: #6b7280; }
          @media print { body { padding: 18px; } }
        </style>
      </head>
      <body>
        <div class="brand">Fuchsius HRMS</div>
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <table>
          <thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="footer">Generated ${new Date().toLocaleString()}</div>
        <script>
          document.title = ${JSON.stringify(filename)};
          window.onload = () => setTimeout(() => window.print(), 150);
        </script>
      </body>
    </html>`
  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}
