import { useRef, useCallback } from 'react'

interface ExcelImportExportProps {
  exportToExcel: () => Record<string, string> | null
  importFromExcel: (data: Record<string, string>) => void
}

export default function ExcelImportExport({
  exportToExcel,
  importFromExcel
}: ExcelImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(async () => {
    const data = exportToExcel()
    if (!data) return

    try {
      const XLSX = await import('xlsx')
      
      const maxRow = Math.max(...Object.keys(data).map(ref => {
        const match = ref.match(/\d+/)
        return match ? parseInt(match[0]) : 1
      }))
      const maxCol = Math.max(...Object.keys(data).map(ref => {
        const match = ref.match(/[A-Z]+/)
        if (!match) return 0
        let col = 0
        for (const c of match[0]) {
          col = col * 26 + (c.charCodeAt(0) - 64)
        }
        return col
      }))

      const wsData: (string | number)[][] = []
      for (let r = 1; r <= maxRow; r++) {
        const row: (string | number)[] = []
        for (let c = 1; c <= maxCol; c++) {
          let colRef = ''
          let n = c - 1
          while (n >= 0) {
            colRef = String.fromCharCode(65 + (n % 26)) + colRef
            n = Math.floor(n / 26) - 1
          }
          const cellRef = `${colRef}${r}`
          const value = data[cellRef] || ''
          const num = parseFloat(value)
          row.push(isNaN(num) ? value : num)
        }
        wsData.push(row)
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      XLSX.writeFile(wb, 'spreadsheet.xlsx')
    } catch (e) {
      console.error('Export failed:', e)
      const csvContent = Object.entries(data)
        .map(([k, v]) => `${k},${v}`)
        .join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'spreadsheet.csv'
      link.click()
    }
  }, [exportToExcel])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const XLSX = await import('xlsx')
      
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array', cellFormula: true })
          
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          
          const importedData: Record<string, string> = {}
          
          const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1')
          
          for (let r = range.s.r; r <= range.e.r; r++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
              const cellRef = XLSX.utils.encode_cell({ r, c })
              const cell = sheet[cellRef]
              
              if (cell) {
                let value: string
                if (cell.f) {
                  value = `=${cell.f}`
                } else if (cell.v !== undefined) {
                  value = String(cell.v)
                } else {
                  continue
                }
                importedData[cellRef] = value
              }
            }
          }

          importFromExcel(importedData)
          alert('导入成功！')
        } catch (err) {
          console.error('Parse error:', err)
          alert('文件解析失败')
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (e) {
      console.error('Import failed:', e)
      alert('导入失败，请确保已安装 xlsx 库')
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [importFromExcel])

  return (
    <div className="excel-io-panel">
      <button className="export-btn" onClick={handleExport}>
        📤 导出 Excel
      </button>
      <button className="import-btn" onClick={handleImportClick}>
        📥 导入 Excel
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}
