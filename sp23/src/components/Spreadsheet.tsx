import { useState, useCallback, useRef, useEffect } from 'react'

interface SpreadsheetProps {
  cellValues: Record<string, string>
  onCellChange: (cellRef: string, value: string) => void
  getCellFormula: (cellRef: string) => string
  rows: number
  cols: number
  onCellSelect?: (cellRef: string) => void
}

export default function Spreadsheet({ cellValues, onCellChange, getCellFormula, rows, cols, onCellSelect }: SpreadsheetProps) {
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [formulaBarValue, setFormulaBarValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const getColumnLabel = (index: number): string => {
    let label = ''
    let n = index
    while (n >= 0) {
      label = String.fromCharCode(65 + (n % 26)) + label
      n = Math.floor(n / 26) - 1
    }
    return label
  }

  const getCellRef = (row: number, col: number): string => {
    return `${getColumnLabel(col)}${row + 1}`
  }

  const handleCellClick = useCallback((cellRef: string) => {
    setSelectedCell(cellRef)
    const formula = getCellFormula(cellRef)
    setFormulaBarValue(formula ? `=${formula}` : (cellValues[cellRef] || ''))
    onCellSelect?.(cellRef)
  }, [cellValues, getCellFormula, onCellSelect])

  const handleCellDoubleClick = useCallback((cellRef: string) => {
    setEditingCell(cellRef)
    const formula = getCellFormula(cellRef)
    setEditValue(formula ? `=${formula}` : (cellValues[cellRef] || ''))
  }, [cellValues, getCellFormula])

  const handleCellBlur = useCallback((cellRef: string) => {
    if (editingCell === cellRef) {
      if (editValue.trim() !== '' || cellValues[cellRef]) {
        onCellChange(cellRef, editValue)
      }
      setEditingCell(null)
    }
  }, [editingCell, editValue, cellValues, onCellChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, cellRef: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (editValue.trim() !== '' || cellValues[cellRef]) {
        onCellChange(cellRef, editValue)
      }
      setEditingCell(null)
      
      const match = cellRef.match(/([A-Z]+)(\d+)/)
      if (match) {
        const nextRow = parseInt(match[2])
        const nextCell = `${match[1]}${nextRow + 1}`
        setSelectedCell(nextCell)
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (editValue.trim() !== '' || cellValues[cellRef]) {
        onCellChange(cellRef, editValue)
      }
      setEditingCell(null)
      
      const match = cellRef.match(/([A-Z]+)(\d+)/)
      if (match) {
        const colChar = match[1]
        const nextCol = String.fromCharCode(colChar.charCodeAt(0) + 1)
        const nextCell = `${nextCol}${match[2]}`
        setSelectedCell(nextCell)
      }
    }
  }, [editValue, cellValues, onCellChange])

  const handleFormulaBarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormulaBarValue(e.target.value)
    if (selectedCell) {
      onCellChange(selectedCell, e.target.value)
    }
  }, [selectedCell, onCellChange])

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  const isErrorCell = (value: string): boolean => {
    return value.startsWith('#') && value !== '#N/A'
  }

  const getErrorTooltip = (value: string): string => {
    switch (value) {
      case '#CIRCULAR_REF': return '循环引用：单元格互相依赖'
      case '#CIRCULAR_CALL': return '循环调用：自定义函数互相递归'
      case '#RECURSION_LIMIT': return '递归超限：调用深度超过64层'
      case '#ERROR': return '公式错误'
      case '#N/A': return '未找到匹配值'
      default: return value
    }
  }

  const isFormulaCell = (cellRef: string): boolean => {
    return !!getCellFormula(cellRef)
  }

  return (
    <>
      <div className="toolbar">
        <div className="formula-bar">
          <span className="formula-label">{selectedCell || 'A1'}</span>
          <span style={{ color: '#ccc' }}>|</span>
          <input
            type="text"
            className="formula-input"
            placeholder="输入值或公式 (如: =SUM(A1:A5))"
            value={selectedCell ? formulaBarValue : ''}
            onChange={handleFormulaBarChange}
          />
        </div>
      </div>

      <div className="spreadsheet-container">
        <table className="spreadsheet">
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: Math.min(cols, 26) }, (_, i) => (
                <th key={i}>{getColumnLabel(i)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.min(rows, 50) }, (_, rowIndex) => (
              <tr key={rowIndex}>
                <td>{rowIndex + 1}</td>
                {Array.from({ length: Math.min(cols, 26) }, (_, colIndex) => {
                  const cellRef = getCellRef(rowIndex, colIndex)
                  const displayValue = cellValues[cellRef] || ''
                  const isSelected = selectedCell === cellRef
                  const isEditing = editingCell === cellRef
                  const isError = isErrorCell(displayValue)
                  const isFormula = isFormulaCell(cellRef)

                  return (
                    <td
                      key={colIndex}
                      className={`
                        ${isSelected ? 'selected-cell' : ''}
                        ${isError ? 'cell-error' : ''}
                        ${isFormula && !isEditing ? 'cell-formula' : ''}
                      `}
                      title={isError ? getErrorTooltip(displayValue) : undefined}
                      onClick={() => handleCellClick(cellRef)}
                      onDoubleClick={() => handleCellDoubleClick(cellRef)}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          className="cell-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleCellBlur(cellRef)}
                          onKeyDown={(e) => handleKeyDown(e, cellRef)}
                        />
                      ) : (
                        displayValue || '\u00A0'
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
