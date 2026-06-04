import { useState, useEffect, useCallback } from 'react'
import type { PivotTableConfig, PivotTableResult, PivotValue } from '../hooks/useSpreadsheetEngine'

interface PivotTablePanelProps {
  getPivotFields: (range: string) => string[]
  generatePivotTable: (config: PivotTableConfig) => PivotTableResult | null
  onClose: () => void
}

type FieldArea = 'rows' | 'columns' | 'values' | 'filters'

export default function PivotTablePanel({
  getPivotFields,
  generatePivotTable,
  onClose
}: PivotTablePanelProps) {
  const [dataRange, setDataRange] = useState('A1:D20')
  const [availableFields, setAvailableFields] = useState<string[]>([])
  const [rowFields, setRowFields] = useState<string[]>([])
  const [columnFields, setColumnFields] = useState<string[]>([])
  const [valueFields, setValueFields] = useState<PivotValue[]>([])
  const [filterFields, setFilterFields] = useState<string[]>([])
  const [result, setResult] = useState<PivotTableResult | null>(null)
  const [draggedField, setDraggedField] = useState<{ field: string; from: FieldArea | 'available' } | null>(null)
  const [draggedValue, setDraggedValue] = useState<PivotValue | null>(null)

  useEffect(() => {
    const fields = getPivotFields(dataRange)
    setAvailableFields(fields)
  }, [dataRange, getPivotFields])

  const handleDragStart = useCallback((field: string, from: FieldArea | 'available') => {
    setDraggedField({ field, from })
    setDraggedValue(null)
  }, [])

  const handleValueDragStart = useCallback((value: PivotValue) => {
    setDraggedValue(value)
    setDraggedField(null)
  }, [])

  const handleDrop = useCallback((to: FieldArea) => {
    if (draggedField) {
      removeFromArea(draggedField.field, draggedField.from)
      addToArea(draggedField.field, to)
    } else if (draggedValue && to === 'values') {
      setValueFields(prev => {
        const idx = prev.findIndex(v => v.field === draggedValue.field && v.function === draggedValue.function)
        if (idx >= 0) {
          const newArr = [...prev]
          newArr.splice(idx, 1)
          return newArr
        }
        return prev
      })
    }
    setDraggedField(null)
    setDraggedValue(null)
  }, [draggedField, draggedValue])

  const removeFromArea = useCallback((field: string, from: FieldArea | 'available') => {
    switch (from) {
      case 'available':
        setAvailableFields(prev => prev.filter(f => f !== field))
        break
      case 'rows':
        setRowFields(prev => prev.filter(f => f !== field))
        break
      case 'columns':
        setColumnFields(prev => prev.filter(f => f !== field))
        break
      case 'values':
        setValueFields(prev => prev.filter(v => v.field !== field))
        break
      case 'filters':
        setFilterFields(prev => prev.filter(f => f !== field))
        break
    }
  }, [])

  const addToArea = useCallback((field: string, to: FieldArea) => {
    switch (to) {
      case 'rows':
        setRowFields(prev => [...prev, field])
        break
      case 'columns':
        setColumnFields(prev => [...prev, field])
        break
      case 'values':
        setValueFields(prev => [...prev, { field, function: 'Sum' }])
        break
      case 'filters':
        setFilterFields(prev => [...prev, field])
        break
    }
  }, [])

  const handleAvailableDoubleClick = useCallback((field: string) => {
    setAvailableFields(prev => prev.filter(f => f !== field))
    setRowFields(prev => [...prev, field])
  }, [])

  const handleRowDoubleClick = useCallback((field: string) => {
    setRowFields(prev => prev.filter(f => f !== field))
    setAvailableFields(prev => [...prev, field])
  }, [])

  const handleColumnDoubleClick = useCallback((field: string) => {
    setColumnFields(prev => prev.filter(f => f !== field))
    setAvailableFields(prev => [...prev, field])
  }, [])

  const handleFilterDoubleClick = useCallback((field: string) => {
    setFilterFields(prev => prev.filter(f => f !== field))
    setAvailableFields(prev => [...prev, field])
  }, [])

  const handleValueDoubleClick = useCallback((value: PivotValue) => {
    setValueFields(prev => prev.filter(v => !(v.field === value.field && v.function === value.function)))
    setAvailableFields(prev => prev.includes(value.field) ? prev : [...prev, value.field])
  }, [])

  const handleAggregationChange = useCallback((field: string, oldFunc: PivotValue['function'], newFunc: PivotValue['function']) => {
    setValueFields(prev => prev.map(v => 
      v.field === field && v.function === oldFunc 
        ? { ...v, function: newFunc }
        : v
    ))
  }, [])

  const handleGenerate = useCallback(() => {
    const config: PivotTableConfig = {
      data_range: dataRange,
      rows: rowFields,
      columns: columnFields,
      values: valueFields,
      filters: filterFields
    }
    const res = generatePivotTable(config)
    setResult(res)
  }, [dataRange, rowFields, columnFields, valueFields, filterFields, generatePivotTable])

  return (
    <div className="pivot-panel">
      <div className="pivot-header">
        <h3>📊 数据透视表</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="pivot-range">
        <label>数据源范围:</label>
        <input
          type="text"
          value={dataRange}
          onChange={(e) => setDataRange(e.target.value.toUpperCase())}
          placeholder="例如: A1:D100"
        />
        <button onClick={() => {
          const fields = getPivotFields(dataRange)
          setAvailableFields(fields)
        }}>
          刷新字段
        </button>
      </div>

      <div className="pivot-layout">
        <div 
          className="pivot-area available"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggedField) {
              removeFromArea(draggedField.field, draggedField.from)
              setAvailableFields(prev => [...prev, draggedField.field])
            } else if (draggedValue) {
              setValueFields(prev => prev.filter(v => !(v.field === draggedValue.field && v.function === draggedValue.function)))
              setAvailableFields(prev => prev.includes(draggedValue.field) ? prev : [...prev, draggedValue.field])
            }
            setDraggedField(null)
            setDraggedValue(null)
          }}
        >
          <h4>📋 可用字段 (双击添加到行)</h4>
          <div className="field-list">
            {availableFields.map(field => (
              <div
                key={field}
                className="field-chip"
                draggable
                onDragStart={() => handleDragStart(field, 'available')}
                onDoubleClick={() => handleAvailableDoubleClick(field)}
                title="拖拽到下方区域，或双击添加到行"
              >
                {field}
              </div>
            ))}
            {availableFields.length === 0 && (
              <div className="empty-hint">设置数据源范围后刷新字段</div>
            )}
          </div>
        </div>

        <div className="pivot-zones">
          <div 
            className="pivot-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop('rows')}
          >
            <h4>📁 行 (Row Labels)</h4>
            <div className="field-list">
              {rowFields.map(field => (
                <div
                  key={field}
                  className="field-chip row-chip"
                  draggable
                  onDragStart={() => handleDragStart(field, 'rows')}
                  onDoubleClick={() => handleRowDoubleClick(field)}
                >
                  {field}
                </div>
              ))}
              {rowFields.length === 0 && <div className="empty-hint">拖拽字段到此处</div>}
            </div>
          </div>

          <div 
            className="pivot-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop('columns')}
          >
            <h4>📌 列 (Column Labels)</h4>
            <div className="field-list">
              {columnFields.map(field => (
                <div
                  key={field}
                  className="field-chip column-chip"
                  draggable
                  onDragStart={() => handleDragStart(field, 'columns')}
                  onDoubleClick={() => handleColumnDoubleClick(field)}
                >
                  {field}
                </div>
              ))}
              {columnFields.length === 0 && <div className="empty-hint">拖拽字段到此处</div>}
            </div>
          </div>

          <div 
            className="pivot-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop('values')}
          >
            <h4>Σ 值 (Values)</h4>
            <div className="field-list">
              {valueFields.map((value, idx) => (
                <div
                  key={`${value.field}-${value.function}-${idx}`}
                  className="field-chip value-chip"
                  draggable
                  onDragStart={() => handleValueDragStart(value)}
                  onDoubleClick={() => handleValueDoubleClick(value)}
                >
                  <select
                    value={value.function}
                    onChange={(e) => handleAggregationChange(value.field, value.function, e.target.value as PivotValue['function'])}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="Sum">求和</option>
                    <option value="Count">计数</option>
                    <option value="Average">平均值</option>
                    <option value="Max">最大值</option>
                    <option value="Min">最小值</option>
                  </select>
                  <span>: {value.field}</span>
                </div>
              ))}
              {valueFields.length === 0 && <div className="empty-hint">拖拽字段到此处</div>}
            </div>
          </div>

          <div 
            className="pivot-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop('filters')}
          >
            <h4>🔍 筛选器 (Filters)</h4>
            <div className="field-list">
              {filterFields.map(field => (
                <div
                  key={field}
                  className="field-chip filter-chip"
                  draggable
                  onDragStart={() => handleDragStart(field, 'filters')}
                  onDoubleClick={() => handleFilterDoubleClick(field)}
                >
                  {field}
                </div>
              ))}
              {filterFields.length === 0 && <div className="empty-hint">拖拽字段到此处</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="pivot-actions">
        <button 
          className="generate-btn"
          onClick={handleGenerate}
          disabled={rowFields.length === 0 && columnFields.length === 0}
        >
          🔄 生成透视表
        </button>
      </div>

      {result && <PivotTableResultView result={result} />}
    </div>
  )
}

function PivotTableResultView({ result }: { result: PivotTableResult }) {
  return (
    <div className="pivot-result">
      <h4>📊 透视表结果</h4>
      <div className="pivot-table-container">
        <table className="pivot-table">
          <thead>
            <tr>
              <th className="pivot-corner"></th>
              {result.column_headers.length > 0 ? (
                result.column_headers.map((header, idx) => (
                  <th key={idx} className="pivot-col-header">{header}</th>
                ))
              ) : (
                <th className="pivot-col-header">值</th>
              )}
              <th className="pivot-total-header">总计</th>
            </tr>
          </thead>
          <tbody>
            {result.row_headers.length > 0 ? (
              result.row_headers.map((header, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="pivot-row-header">{header}</td>
                  {result.values[rowIdx]?.map((val, colIdx) => (
                    <td key={colIdx} className="pivot-value">{val}</td>
                  ))}
                  <td className="pivot-total-value">{result.grand_total_column[rowIdx] || ''}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="pivot-row-header">总计</td>
                {result.values[0]?.map((val, colIdx) => (
                  <td key={colIdx} className="pivot-value">{val}</td>
                ))}
                <td className="pivot-total-value">{result.grand_total}</td>
              </tr>
            )}
            <tr className="pivot-total-row">
              <td className="pivot-row-header">总计</td>
              {result.grand_total_row.map((val, idx) => (
                <td key={idx} className="pivot-total-value">{val}</td>
              ))}
              <td className="pivot-grand-total">{result.grand_total}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
