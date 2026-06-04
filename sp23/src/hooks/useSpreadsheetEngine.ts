import { useState, useCallback, useRef } from 'react'

export interface FormulaDebugStep {
  step_index: number
  expression: string
  result: string
  sub_expression: string
  dependencies: string[]
  is_breakpoint: boolean
}

export interface FormulaDebugSession {
  cell_ref: string
  original_formula: string
  steps: FormulaDebugStep[]
  current_step: number
  is_complete: boolean
  final_result: string
  breakpoints: number[]
}

export interface PivotValue {
  field: string
  function: 'Sum' | 'Count' | 'Average' | 'Max' | 'Min'
}

export interface PivotTableConfig {
  data_range: string
  rows: string[]
  columns: string[]
  values: PivotValue[]
  filters: string[]
}

export interface PivotTableResult {
  row_headers: string[]
  column_headers: string[]
  values: string[][]
  grand_total_row: string[]
  grand_total_column: string[]
  grand_total: string
}

type SpreadsheetEngineType = {
  set_cell: (cellRef: string, value: string) => any
  get_cell_value: (cellRef: string) => string
  get_cell_formula: (cellRef: string) => string
  register_custom_function: (name: string, func: Function) => void
  export_to_excel: () => any
  import_from_excel: (data: any) => any
  generate_pivot_table: (config: PivotTableConfig) => PivotTableResult
  get_pivot_fields: (range: string) => string[]
  start_debug_session: (cellRef: string) => FormulaDebugSession
  debug_step_forward: (cellRef: string) => FormulaDebugSession
  debug_step_backward: (cellRef: string) => FormulaDebugSession
  debug_run_to_breakpoint: (cellRef: string) => FormulaDebugSession
  debug_run_to_completion: (cellRef: string) => FormulaDebugSession
  debug_toggle_breakpoint: (cellRef: string, stepIndex: number) => void
  debug_end_session: (cellRef: string) => void
}

type WasmModule = {
  SpreadsheetEngine: new () => SpreadsheetEngineType
  init: () => Promise<void>
}

let wasmModule: WasmModule | null = null

export async function initWasm(): Promise<void> {
  if (wasmModule) return

  try {
    const mod = await import('../wasm/spreadsheet_engine.js')
    await mod.default()
    wasmModule = mod as WasmModule
  } catch (e) {
    console.warn('WASM 模块未找到，使用模拟引擎')
    wasmModule = createMockEngine() as unknown as WasmModule
  }
}

const MAX_CUSTOM_FUNC_DEPTH = 64

function createMockEngine() {
  const cells: Map<string, { value: string; formula?: string }> = new Map()
  const customFuncs: Map<string, Function> = new Map()
  const dependencies: Map<string, Set<string>> = new Map()
  const dependents: Map<string, Set<string>> = new Map()
  const vlookupCache: Map<string, Map<string, number>> = new Map()
  const debugSessions: Map<string, FormulaDebugSession> = new Map()
  const breakpoints: Map<string, number[]> = new Map()

  function updateDependencies(cell: string, newDeps: Set<string>) {
    const oldDeps = dependencies.get(cell)
    if (oldDeps) {
      for (const dep of oldDeps) {
        dependents.get(dep)?.delete(cell)
      }
    }
    dependencies.set(cell, newDeps)
    for (const dep of newDeps) {
      if (!dependents.has(dep)) dependents.set(dep, new Set())
      dependents.get(dep)!.add(cell)
    }
    invalidateVlookupCache()
  }

  function rollbackDependencies(cell: string, oldDeps: Set<string>) {
    updateDependencies(cell, oldDeps)
  }

  function getDependencies(cell: string): Set<string> {
    return dependencies.get(cell) || new Set()
  }

  function hasCycleFrom(startCell: string): boolean {
    const WHITE = 0, GRAY = 1, BLACK = 2
    const colors: Map<string, number> = new Map()

    function dfs(node: string): boolean {
      const color = colors.get(node) || WHITE
      if (color === GRAY) return true
      if (color === BLACK) return false

      colors.set(node, GRAY)
      const deps = dependencies.get(node)
      if (deps) {
        for (const dep of deps) {
          if (dfs(dep)) return true
        }
      }
      colors.set(node, BLACK)
      return false
    }

    return dfs(startCell)
  }

  function getDependentsRecursive(cell: string): Set<string> {
    const result = new Set<string>()
    const queue: string[] = [cell]
    while (queue.length > 0) {
      const current = queue.shift()!
      const deps = dependents.get(current)
      if (deps) {
        for (const dep of deps) {
          if (!result.has(dep)) {
            result.add(dep)
            queue.push(dep)
          }
        }
      }
    }
    return result
  }

  function invalidateVlookupCache() {
    vlookupCache.clear()
  }

  function buildVlookupHashIndex(lookupCol: string, minRow: number, maxRow: number): Map<string, number> {
    const cacheKey = `${lookupCol}${minRow}:${maxRow}`
    const cached = vlookupCache.get(cacheKey)
    if (cached) return cached

    const index: Map<string, number> = new Map()
    for (let r = minRow; r <= maxRow; r++) {
      const lookupCell = `${lookupCol}${r}`
      const cellData = cells.get(lookupCell)
      if (cellData && cellData.value !== '') {
        if (!index.has(cellData.value)) {
          index.set(cellData.value, r)
        }
      }
    }
    vlookupCache.set(cacheKey, index)
    return index
  }

  function getCellNumberValue(ref: string): number {
    const cell = cells.get(ref)
    if (!cell) return 0
    const num = parseFloat(cell.value)
    return isNaN(num) ? 0 : num
  }

  let callDepth = 0
  const callStack: Set<string> = new Set()

  function evaluateFormula(formula: string): string {
    try {
      formula = formula.toUpperCase()

      if (formula.startsWith('SUM(')) {
        const range = formula.slice(4, -1)
        const cellRefs = expandRange(range)
        const sum = cellRefs.reduce((acc, ref) => acc + getCellNumberValue(ref), 0)
        return sum.toString()
      }

      if (formula.startsWith('AVERAGE(')) {
        const range = formula.slice(8, -1)
        const cellRefs = expandRange(range)
        const values = cellRefs.map(getCellNumberValue).filter(v => !isNaN(v))
        if (values.length === 0) return '0'
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        return avg.toString()
      }

      if (formula.startsWith('IF(')) {
        const args = splitArgs(formula.slice(3, -1))
        if (args.length !== 3) return '#ERROR'
        const cond = evaluateExpression(args[0])
        return parseFloat(cond) !== 0 ? evaluateExpression(args[1]) : evaluateExpression(args[2])
      }

      if (formula.startsWith('VLOOKUP(')) {
        const args = splitArgs(formula.slice(8, -1))
        if (args.length !== 4) return '#ERROR'
        return evalVLookup(args)
      }

      const customMatch = formula.match(/^(\w+)\((.*)\)$/)
      if (customMatch && customFuncs.has(customMatch[1])) {
        const funcName = customMatch[1]

        if (callDepth >= MAX_CUSTOM_FUNC_DEPTH) {
          return '#RECURSION_LIMIT'
        }

        if (callStack.has(funcName)) {
          return '#CIRCULAR_CALL'
        }

        const func = customFuncs.get(funcName)!
        const args = splitArgs(customMatch[2]).map(arg => {
          const val = evaluateExpression(arg)
          const num = parseFloat(val)
          return isNaN(num) ? val : num
        })

        callDepth++
        callStack.add(funcName)
        try {
          const result = func(...args)
          return String(result)
        } catch {
          return '#ERROR'
        } finally {
          callDepth--
          callStack.delete(funcName)
        }
      }

      return evaluateExpression(formula)
    } catch (e) {
      return '#ERROR'
    }
  }

  function expandRange(range: string): string[] {
    const parts = range.split(':')
    if (parts.length !== 2) return [range.toUpperCase()]

    const [col1, row1] = parseCellRef(parts[0])
    const [col2, row2] = parseCellRef(parts[1])

    const refs: string[] = []
    for (let c = col1; c <= col2; c++) {
      for (let r = row1; r <= row2; r++) {
        refs.push(`${String.fromCharCode(c)}${r}`)
      }
    }
    return refs
  }

  function parseCellRef(ref: string): [number, number] {
    const match = ref.match(/([A-Z]+)(\d+)/i)
    if (!match) return [65, 1]
    return [match[1].toUpperCase().charCodeAt(0), parseInt(match[2])]
  }

  function parseCellRef2(ref: string): [number, number] {
    const match = ref.match(/([A-Z]+)(\d+)/i)
    if (!match) return [65, 1]
    return [match[1].toUpperCase().charCodeAt(0), parseInt(match[2])]
  }

  function splitArgs(args: string): string[] {
    const result: string[] = []
    let current = ''
    let depth = 0

    for (const c of args) {
      if (c === '(') depth++
      else if (c === ')') depth--
      else if (c === ',' && depth === 0) {
        result.push(current.trim())
        current = ''
        continue
      }
      current += c
    }
    if (current) result.push(current.trim())
    return result
  }

  function evaluateExpression(expr: string): string {
    expr = expr.trim()
    const num = parseFloat(expr)
    if (!isNaN(num)) return expr

    if (/^[A-Z]+\d+$/i.test(expr)) {
      return cells.get(expr.toUpperCase())?.value || '0'
    }

    return expr
  }

  function evalVLookup(args: string[]): string {
    const lookupValue = evaluateExpression(args[0])
    const cellRefs = expandRange(args[1])
    const colIndex = parseInt(args[2]) - 1
    const rangeLookup = args[3].trim().toUpperCase() !== 'FALSE'

    if (cellRefs.length === 0) return '#N/A'

    const [firstCol, firstRow] = parseCellRef(cellRefs[0])
    const [, lastRow] = parseCellRef(cellRefs[cellRefs.length - 1])
    const lookupColStr = String.fromCharCode(firstCol)

    if (rangeLookup) {
      return vlookupBinarySearch(lookupValue, firstCol, firstRow, lastRow, firstCol + colIndex)
    } else {
      return vlookupHashExact(lookupValue, lookupColStr, firstRow, lastRow, firstCol + colIndex)
    }
  }

  function vlookupHashExact(lookupValue: string, lookupCol: string, minRow: number, maxRow: number, returnColCode: number): string {
    const index = buildVlookupHashIndex(lookupCol, minRow, maxRow)
    const row = index.get(lookupValue)
    if (row !== undefined) {
      const returnCell = `${String.fromCharCode(returnColCode)}${row}`
      return cells.get(returnCell)?.value || '#N/A'
    }
    return '#N/A'
  }

  function vlookupBinarySearch(lookupValue: string, lookupColCode: number, minRow: number, maxRow: number, returnColCode: number): string {
    const lookupColStr = String.fromCharCode(lookupColCode)
    let low = minRow
    let high = maxRow
    let bestRow: number | null = null

    const lookupNum = parseFloat(lookupValue)

    while (low <= high) {
      const mid = low + Math.floor((high - low) / 2)
      const midCell = `${lookupColStr}${mid}`
      const midValue = cells.get(midCell)?.value || ''

      if (midValue === lookupValue) {
        const returnCell = `${String.fromCharCode(returnColCode)}${mid}`
        return cells.get(returnCell)?.value || '#N/A'
      }

      const midNum = parseFloat(midValue)

      if (!isNaN(midNum) && !isNaN(lookupNum)) {
        if (midNum < lookupNum) {
          bestRow = mid
          low = mid + 1
        } else {
          high = mid - 1
        }
      } else {
        if (midValue < lookupValue) {
          bestRow = mid
          low = mid + 1
        } else {
          high = mid - 1
        }
      }
    }

    if (bestRow !== null) {
      const returnCell = `${String.fromCharCode(returnColCode)}${bestRow}`
      return cells.get(returnCell)?.value || '#N/A'
    }
    return '#N/A'
  }

  function recalculateDependents(changedCell: string) {
    const affected = getDependentsRecursive(changedCell)
    for (const cellRef of affected) {
      const cellData = cells.get(cellRef)
      if (cellData?.formula) {
        cellData.value = evaluateFormula(cellData.formula)
      }
    }
  }

  function generateDebugSteps(formula: string): FormulaDebugStep[] {
    const steps: FormulaDebugStep[] = []
    let current = formula
    let index = 0

    const cellRefs = current.match(/[A-Za-z]+\d+/g) || []
    const funcCalls = current.match(/[A-Z]+\([^)]*\)/g) || []

    for (const ref of cellRefs) {
      const refUpper = ref.toUpperCase()
      const value = cells.get(refUpper)?.value || ''
      const deps = extractDependencies(ref)
      
      steps.push({
        step_index: index,
        expression: current,
        sub_expression: ref,
        result: value,
        dependencies: Array.from(deps),
        is_breakpoint: false
      })
      current = current.replace(ref, value)
      index++
    }

    for (const func of funcCalls) {
      const result = evaluateFormula(func)
      const deps = extractDependencies(func)
      
      steps.push({
        step_index: index,
        expression: current,
        sub_expression: func,
        result,
        dependencies: Array.from(deps),
        is_breakpoint: false
      })
      current = current.replace(func, result)
      index++
    }

    if (index > 0) {
      steps.push({
        step_index: index,
        expression: current,
        sub_expression: '',
        result: current,
        dependencies: [],
        is_breakpoint: false
      })
    }

    return steps
  }

  function getPivotFields(range: string): string[] {
    const parts = range.split(':')
    if (parts.length !== 2) return []

    const [col1, row1] = parseCellRef2(parts[0])
    const [col2, row2] = parseCellRef2(parts[1])

    const headers: string[] = []
    for (let c = col1; c <= col2; c++) {
      const cellRef = `${String.fromCharCode(c)}${row1}`
      headers.push(cells.get(cellRef)?.value || '')
    }
    return headers.filter(h => h !== '')
  }

  function generatePivotTable(config: PivotTableConfig): PivotTableResult {
    const parts = config.data_range.split(':')
    if (parts.length !== 2) {
      return { row_headers: [], column_headers: [], values: [], grand_total_row: [], grand_total_column: [], grand_total: '' }
    }

    const [col1, row1] = parseCellRef2(parts[0])
    const [col2, row2] = parseCellRef2(parts[1])

    const data: string[][] = []
    for (let r = row1; r <= row2; r++) {
      const row: string[] = []
      for (let c = col1; c <= col2; c++) {
        const cellRef = `${String.fromCharCode(c)}${r}`
        row.push(cells.get(cellRef)?.value || '')
      }
      data.push(row)
    }

    if (data.length < 2) {
      return { row_headers: [], column_headers: [], values: [], grand_total_row: [], grand_total_column: [], grand_total: '' }
    }

    const headers = data[0]
    const rows = data.slice(1)

    const rowIndices = config.rows.map(r => headers.indexOf(r)).filter(i => i >= 0)
    const colIndices = config.columns.map(c => headers.indexOf(c)).filter(i => i >= 0)
    const valueIndices = config.values.map(v => ({ idx: headers.indexOf(v.field), func: v.function })).filter(v => v.idx >= 0)

    const uniqueRows: string[][] = []
    const uniqueCols: string[][] = []
    const valueMap: Map<string, Map<string, number[][]>> = new Map()

    for (const row of rows) {
      const rowKey = rowIndices.map(i => row[i] || '')
      const colKey = colIndices.map(i => row[i] || '')

      if (rowKey.some(k => k !== '') && !uniqueRows.some(r => r.join('|') === rowKey.join('|'))) {
        uniqueRows.push(rowKey)
      }
      if (colKey.some(k => k !== '') && !uniqueCols.some(c => c.join('|') === colKey.join('|'))) {
        uniqueCols.push(colKey)
      }

      const rowKeyStr = rowKey.join('|')
      const colKeyStr = colKey.join('|')

      if (!valueMap.has(rowKeyStr)) {
        valueMap.set(rowKeyStr, new Map())
      }
      const rowMap = valueMap.get(rowKeyStr)!
      if (!rowMap.has(colKeyStr)) {
        rowMap.set(colKeyStr, valueIndices.map(() => []))
      }
      const vals = rowMap.get(colKeyStr)!
      valueIndices.forEach((vi, i) => {
        const num = parseFloat(row[vi.idx])
        if (!isNaN(num)) {
          vals[i].push(num)
        }
      })
    }

    uniqueRows.sort()
    uniqueCols.sort()

    function aggregate(vals: number[], func: string): string {
      if (vals.length === 0) return '0'
      switch (func) {
        case 'Sum': return vals.reduce((a, b) => a + b, 0).toString()
        case 'Count': return vals.length.toString()
        case 'Average': return (vals.reduce((a, b) => a + b, 0) / vals.length).toString()
        case 'Max': return Math.max(...vals).toString()
        case 'Min': return Math.min(...vals).toString()
        default: return '0'
      }
    }

    const rowHeaders = uniqueRows.map(r => r.join(' - '))
    const colHeaders = uniqueCols.map(c => c.join(' - '))

    const values: string[][] = uniqueRows.map(rowKey => {
      const rowKeyStr = rowKey.join('|')
      return uniqueCols.map(colKey => {
        const colKeyStr = colKey.join('|')
        const vals = valueMap.get(rowKeyStr)?.get(colKeyStr) || []
        return vals.map((v, i) => aggregate(v, valueIndices[i]?.func || 'Sum')).join(' / ')
      })
    })

    const grandTotalRow: string[] = uniqueCols.map(colKey => {
      const colKeyStr = colKey.join('|')
      const totals = valueIndices.map(() => 0)
      uniqueRows.forEach(rowKey => {
        const rowKeyStr = rowKey.join('|')
        const vals = valueMap.get(rowKeyStr)?.get(colKeyStr) || []
        vals.forEach((v, i) => {
          if (valueIndices[i]?.func === 'Count') {
            totals[i] += v.length
          } else {
            totals[i] += v.reduce((a, b) => a + b, 0)
          }
        })
      })
      return totals.map((t, i) => {
        if (valueIndices[i]?.func === 'Average') {
          let count = 0
          let sum = 0
          uniqueRows.forEach(rowKey => {
            const rowKeyStr = rowKey.join('|')
            const vals = valueMap.get(rowKeyStr)?.get(colKeyStr) || []
            sum += vals.reduce((a, b) => a + b, 0)
            count += vals.length
          })
          return count > 0 ? (sum / count).toString() : '0'
        }
        return t.toString()
      }).join(' / ')
    })

    const grandTotalColumn: string[] = uniqueRows.map(rowKey => {
      const rowKeyStr = rowKey.join('|')
      const totals = valueIndices.map(() => 0)
      uniqueCols.forEach(colKey => {
        const colKeyStr = colKey.join('|')
        const vals = valueMap.get(rowKeyStr)?.get(colKeyStr) || []
        vals.forEach((v, i) => {
          if (valueIndices[i]?.func === 'Count') {
            totals[i] += v.length
          } else {
            totals[i] += v.reduce((a, b) => a + b, 0)
          }
        })
      })
      return totals.map((t, i) => {
        if (valueIndices[i]?.func === 'Average') {
          let count = 0
          let sum = 0
          uniqueCols.forEach(colKey => {
            const colKeyStr = colKey.join('|')
            const vals = valueMap.get(rowKeyStr)?.get(colKeyStr) || []
            sum += vals.reduce((a, b) => a + b, 0)
            count += vals.length
          })
          return count > 0 ? (sum / count).toString() : '0'
        }
        return t.toString()
      }).join(' / ')
    })

    let grandTotal = ''
    if (valueIndices.length > 0) {
      const totals = valueIndices.map(() => 0)
      const counts = valueIndices.map(() => 0)
      const sums = valueIndices.map(() => 0)
      uniqueRows.forEach(rowKey => {
        uniqueCols.forEach(colKey => {
          const rowKeyStr = rowKey.join('|')
          const colKeyStr = colKey.join('|')
          const vals = valueMap.get(rowKeyStr)?.get(colKeyStr) || []
          vals.forEach((v, i) => {
            if (valueIndices[i]?.func === 'Count') {
              totals[i] += v.length
            } else if (valueIndices[i]?.func === 'Average') {
              sums[i] += v.reduce((a, b) => a + b, 0)
              counts[i] += v.length
            } else {
              totals[i] += v.reduce((a, b) => a + b, 0)
            }
          })
        })
      })
      grandTotal = totals.map((t, i) => {
        if (valueIndices[i]?.func === 'Average') {
          return counts[i] > 0 ? (sums[i] / counts[i]).toString() : '0'
        }
        return t.toString()
      }).join(' / ')
    }

    return { row_headers: rowHeaders, column_headers: colHeaders, values, grand_total_row: grandTotalRow, grand_total_column: grandTotalColumn, grand_total: grandTotal }
  }

  return {
    SpreadsheetEngine: function () {
      return {
        set_cell: function (cellRef: string, value: string) {
          cellRef = cellRef.toUpperCase()
          if (value.startsWith('=')) {
            const formula = value.slice(1)
            const newDeps = extractDependencies(formula)
            const oldDeps = getDependencies(cellRef)

            updateDependencies(cellRef, newDeps)

            if (hasCycleFrom(cellRef)) {
              rollbackDependencies(cellRef, oldDeps)
              throw new Error('Circular reference detected')
            }

            cells.set(cellRef, { value: '', formula })
            const cellData = cells.get(cellRef)!
            cellData.value = evaluateFormula(formula)
            recalculateDependents(cellRef)
          } else {
            const oldDeps = getDependencies(cellRef)
            if (oldDeps.size > 0) {
              updateDependencies(cellRef, new Set())
            }
            cells.set(cellRef, { value })
            recalculateDependents(cellRef)
          }
          return Object.fromEntries([...cells.entries()].map(([k, v]) => [k, v.value]))
        },
        get_cell_value: function (cellRef: string) {
          return cells.get(cellRef.toUpperCase())?.value || ''
        },
        get_cell_formula: function (cellRef: string) {
          return cells.get(cellRef.toUpperCase())?.formula || ''
        },
        register_custom_function: function (name: string, func: Function) {
          customFuncs.set(name.toUpperCase(), func)
        },
        export_to_excel: function () {
          return Object.fromEntries([...cells.entries()].map(([k, v]) => [k, v.formula ? `=${v.formula}` : v.value]))
        },
        import_from_excel: function (data: any) {
          for (const [cellRef, value] of Object.entries(data)) {
            const ref = cellRef.toUpperCase()
            if (typeof value === 'string' && value.startsWith('=')) {
              const formula = value.slice(1)
              const deps = extractDependencies(formula)
              updateDependencies(ref, deps)
              cells.set(ref, { value: '', formula })
              const cellData = cells.get(ref)!
              cellData.value = evaluateFormula(formula)
            } else {
              cells.set(ref, { value: String(value) })
            }
          }
          for (const [cellRef] of Object.entries(data)) {
            recalculateDependents(cellRef.toUpperCase())
          }
          return Object.fromEntries([...cells.entries()].map(([k, v]) => [k, v.value]))
        },
        generate_pivot_table: function (config: PivotTableConfig) {
          return generatePivotTable(config)
        },
        get_pivot_fields: function (range: string) {
          return getPivotFields(range)
        },
        start_debug_session: function (cellRef: string) {
          const ref = cellRef.toUpperCase()
          const cell = cells.get(ref)
          if (!cell?.formula) {
            throw new Error('Cell not found or has no formula')
          }
          const steps = generateDebugSteps(cell.formula)
          const session: FormulaDebugSession = {
            cell_ref: ref,
            original_formula: cell.formula,
            steps,
            current_step: 0,
            is_complete: false,
            final_result: '',
            breakpoints: breakpoints.get(ref) || []
          }
          debugSessions.set(ref, session)
          return session
        },
        debug_step_forward: function (cellRef: string) {
          const ref = cellRef.toUpperCase()
          const session = debugSessions.get(ref)
          if (!session) throw new Error('No active debug session')
          if (session.current_step < session.steps.length) {
            session.current_step++
            if (session.current_step >= session.steps.length) {
              session.is_complete = true
              session.final_result = session.steps[session.steps.length - 1]?.result || ''
            }
          }
          return { ...session }
        },
        debug_step_backward: function (cellRef: string) {
          const ref = cellRef.toUpperCase()
          const session = debugSessions.get(ref)
          if (!session) throw new Error('No active debug session')
          if (session.current_step > 0) {
            session.current_step--
            session.is_complete = false
          }
          return { ...session }
        },
        debug_run_to_breakpoint: function (cellRef: string) {
          const ref = cellRef.toUpperCase()
          const session = debugSessions.get(ref)
          if (!session) throw new Error('No active debug session')
          const breaks = session.breakpoints.slice().sort()
          while (session.current_step < session.steps.length) {
            session.current_step++
            if (breaks.includes(session.current_step)) break
          }
          if (session.current_step >= session.steps.length) {
            session.is_complete = true
            session.final_result = session.steps[session.steps.length - 1]?.result || ''
          }
          return { ...session }
        },
        debug_run_to_completion: function (cellRef: string) {
          const ref = cellRef.toUpperCase()
          const session = debugSessions.get(ref)
          if (!session) throw new Error('No active debug session')
          session.current_step = session.steps.length
          session.is_complete = true
          session.final_result = session.steps[session.steps.length - 1]?.result || ''
          return { ...session }
        },
        debug_toggle_breakpoint: function (cellRef: string, stepIndex: number) {
          const ref = cellRef.toUpperCase()
          const bp = breakpoints.get(ref) || []
          const idx = bp.indexOf(stepIndex)
          if (idx >= 0) {
            bp.splice(idx, 1)
          } else {
            bp.push(stepIndex)
            bp.sort((a, b) => a - b)
          }
          breakpoints.set(ref, bp)
          const session = debugSessions.get(ref)
          if (session) {
            session.breakpoints = bp.slice()
          }
        },
        debug_end_session: function (cellRef: string) {
          const ref = cellRef.toUpperCase()
          debugSessions.delete(ref)
        }
      }
    }
  }
}

function extractDependencies(formula: string): Set<string> {
  const deps = new Set<string>()
  const re = /[A-Za-z]+\d+/g
  let match
  while ((match = re.exec(formula)) !== null) {
    deps.add(match[0].toUpperCase())
  }
  return deps
}

export function useSpreadsheetEngine() {
  const engineRef = useRef<SpreadsheetEngineType | null>(null)
  const [cellValues, setCellValues] = useState<Record<string, string>>({})

  const getEngine = useCallback(() => {
    if (!engineRef.current && wasmModule) {
      engineRef.current = new wasmModule.SpreadsheetEngine()
    }
    return engineRef.current
  }, [])

  const setCellValue = useCallback((cellRef: string, value: string) => {
    const engine = getEngine()
    if (!engine) return

    try {
      const result = engine.set_cell(cellRef, value)
      if (result && typeof result === 'object') {
        setCellValues(prev => ({ ...prev, ...Object.fromEntries(Object.entries(result)) }))
      }
    } catch (e: any) {
      console.error('Set cell error:', e)
      setCellValues(prev => ({ ...prev, [cellRef.toUpperCase()]: '#CIRCULAR_REF' }))
    }
  }, [getEngine])

  const getCellValue = useCallback((cellRef: string): string => {
    const engine = getEngine()
    return engine?.get_cell_value(cellRef) || ''
  }, [getEngine])

  const getCellFormula = useCallback((cellRef: string): string => {
    const engine = getEngine()
    return engine?.get_cell_formula(cellRef) || ''
  }, [getEngine])

  const registerCustomFunction = useCallback((name: string, func: Function) => {
    const engine = getEngine()
    engine?.register_custom_function(name, func)
  }, [getEngine])

  const exportToExcel = useCallback((): Record<string, string> | null => {
    const engine = getEngine()
    if (!engine) return null
    try {
      return engine.export_to_excel()
    } catch (e) {
      console.error('Export error:', e)
      return null
    }
  }, [getEngine])

  const importFromExcel = useCallback((data: Record<string, string>) => {
    const engine = getEngine()
    if (!engine) return
    try {
      const result = engine.import_from_excel(data)
      if (result && typeof result === 'object') {
        setCellValues(prev => ({ ...prev, ...Object.fromEntries(Object.entries(result)) }))
      }
    } catch (e) {
      console.error('Import error:', e)
    }
  }, [getEngine])

  const generatePivotTable = useCallback((config: PivotTableConfig): PivotTableResult | null => {
    const engine = getEngine()
    if (!engine) return null
    try {
      return engine.generate_pivot_table(config)
    } catch (e) {
      console.error('Pivot table error:', e)
      return null
    }
  }, [getEngine])

  const getPivotFields = useCallback((range: string): string[] => {
    const engine = getEngine()
    if (!engine) return []
    try {
      return engine.get_pivot_fields(range)
    } catch (e) {
      console.error('Get pivot fields error:', e)
      return []
    }
  }, [getEngine])

  const startDebugSession = useCallback((cellRef: string): FormulaDebugSession | null => {
    const engine = getEngine()
    if (!engine) return null
    try {
      return engine.start_debug_session(cellRef)
    } catch (e) {
      console.error('Debug start error:', e)
      return null
    }
  }, [getEngine])

  const debugStepForward = useCallback((cellRef: string): FormulaDebugSession | null => {
    const engine = getEngine()
    if (!engine) return null
    try {
      return engine.debug_step_forward(cellRef)
    } catch (e) {
      console.error('Debug step error:', e)
      return null
    }
  }, [getEngine])

  const debugStepBackward = useCallback((cellRef: string): FormulaDebugSession | null => {
    const engine = getEngine()
    if (!engine) return null
    try {
      return engine.debug_step_backward(cellRef)
    } catch (e) {
      console.error('Debug step error:', e)
      return null
    }
  }, [getEngine])

  const debugRunToBreakpoint = useCallback((cellRef: string): FormulaDebugSession | null => {
    const engine = getEngine()
    if (!engine) return null
    try {
      return engine.debug_run_to_breakpoint(cellRef)
    } catch (e) {
      console.error('Debug run error:', e)
      return null
    }
  }, [getEngine])

  const debugRunToCompletion = useCallback((cellRef: string): FormulaDebugSession | null => {
    const engine = getEngine()
    if (!engine) return null
    try {
      return engine.debug_run_to_completion(cellRef)
    } catch (e) {
      console.error('Debug run error:', e)
      return null
    }
  }, [getEngine])

  const debugToggleBreakpoint = useCallback((cellRef: string, stepIndex: number) => {
    const engine = getEngine()
    engine?.debug_toggle_breakpoint(cellRef, stepIndex)
  }, [getEngine])

  const debugEndSession = useCallback((cellRef: string) => {
    const engine = getEngine()
    engine?.debug_end_session(cellRef)
  }, [getEngine])

  return {
    engine: engineRef.current,
    cellValues,
    setCellValue,
    getCellValue,
    getCellFormula,
    registerCustomFunction,
    exportToExcel,
    importFromExcel,
    generatePivotTable,
    getPivotFields,
    startDebugSession,
    debugStepForward,
    debugStepBackward,
    debugRunToBreakpoint,
    debugRunToCompletion,
    debugToggleBreakpoint,
    debugEndSession
  }
}
