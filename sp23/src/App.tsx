import { useState, useEffect, useCallback } from 'react'
import Spreadsheet from './components/Spreadsheet'
import FormulaDebugger from './components/FormulaDebugger'
import PivotTablePanel from './components/PivotTablePanel'
import ExcelImportExport from './components/ExcelImportExport'
import { initWasm, useSpreadsheetEngine } from './hooks/useSpreadsheetEngine'
import type { FormulaDebugSession } from './hooks/useSpreadsheetEngine'

function App() {
  const [wasmLoaded, setWasmLoaded] = useState(false)
  const [showDebugger, setShowDebugger] = useState(false)
  const [showPivot, setShowPivot] = useState(false)
  const [debugCell, setDebugCell] = useState<string | null>(null)
  const [debugSession, setDebugSession] = useState<FormulaDebugSession | null>(null)
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const [customFunctionCode, setCustomFunctionCode] = useState(
    `// 自定义函数示例: CUSTOM_TAX(amount, rate)
// 计算税费
function CUSTOM_TAX(amount, rate) {
  return amount * rate;
}

// 另一个示例函数
function BONUS(salary, years) {
  return salary * Math.min(years, 10) * 0.1;
}`
  )
  
  const { 
    engine, 
    setCellValue, 
    getCellValue, 
    getCellFormula, 
    registerCustomFunction, 
    cellValues,
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
  } = useSpreadsheetEngine()

  useEffect(() => {
    initWasm().then(() => setWasmLoaded(true))
  }, [])

  const handleRegisterFunctions = useCallback(() => {
    try {
      const funcDefs = customFunctionCode
        .match(/function\s+(\w+)\s*\(([^)]*)\)\s*\{([^}]+)\}/g) || []
      
      funcDefs.forEach((funcDef) => {
        const nameMatch = funcDef.match(/function\s+(\w+)/)
        if (nameMatch) {
          const funcName = nameMatch[1]
          const func = new Function(`return ${funcDef}`)()
          registerCustomFunction(funcName, func)
          alert(`已注册函数: ${funcName}`)
        }
      })
    } catch (e) {
      alert('函数注册失败，请检查语法')
    }
  }, [customFunctionCode, registerCustomFunction])

  const handleStartDebug = useCallback(() => {
    const cellToDebug = selectedCell || 'A1'
    const formula = getCellFormula(cellToDebug)
    if (!formula) {
      alert('请选择一个包含公式的单元格进行调试')
      return
    }
    const session = startDebugSession(cellToDebug)
    if (session) {
      setDebugCell(cellToDebug)
      setDebugSession(session)
      setShowDebugger(true)
    }
  }, [selectedCell, getCellFormula, startDebugSession])

  const handleDebugStepForward = useCallback(() => {
    if (!debugCell) return
    const session = debugStepForward(debugCell)
    setDebugSession(session)
  }, [debugCell, debugStepForward])

  const handleDebugStepBackward = useCallback(() => {
    if (!debugCell) return
    const session = debugStepBackward(debugCell)
    setDebugSession(session)
  }, [debugCell, debugStepBackward])

  const handleDebugRunToBreakpoint = useCallback(() => {
    if (!debugCell) return
    const session = debugRunToBreakpoint(debugCell)
    setDebugSession(session)
  }, [debugCell, debugRunToBreakpoint])

  const handleDebugRunToCompletion = useCallback(() => {
    if (!debugCell) return
    const session = debugRunToCompletion(debugCell)
    setDebugSession(session)
  }, [debugCell, debugRunToCompletion])

  const handleDebugToggleBreakpoint = useCallback((cellRef: string, stepIndex: number) => {
    debugToggleBreakpoint(cellRef, stepIndex)
  }, [debugToggleBreakpoint])

  const handleDebugEndSession = useCallback(() => {
    if (debugCell) {
      debugEndSession(debugCell)
    }
    setShowDebugger(false)
    setDebugCell(null)
    setDebugSession(null)
  }, [debugCell, debugEndSession])

  const handleCellSelect = useCallback((cellRef: string) => {
    setSelectedCell(cellRef)
  }, [])

  if (!wasmLoaded) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>正在加载 WASM 引擎...</h2>
          <p>请稍候</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📊 WASM 电子表格</h1>
        <div className="header-info">
          Rust + WebAssembly 驱动的高性能电子表格 | 支持 100x100 单元格
        </div>
      </header>

      <main className="main-content">
        <div className="custom-function-panel">
          <h3>🔧 自定义 JavaScript 函数</h3>
          <textarea
            value={customFunctionCode}
            onChange={(e) => setCustomFunctionCode(e.target.value)}
            placeholder="在此编写自定义函数..."
          />
          <button onClick={handleRegisterFunctions}>
            注册函数到 WASM 引擎
          </button>
        </div>

        <div className="toolbar">
          <div className="formula-bar">
            <span className="formula-label">{selectedCell || 'A1'}</span>
            <span style={{ color: '#ccc' }}>|</span>
            <input
              type="text"
              className="formula-input"
              placeholder="输入值或公式 (如: =SUM(A1:A5))"
              value={selectedCell && getCellFormula(selectedCell) 
                ? `=${getCellFormula(selectedCell)}` 
                : (selectedCell ? cellValues[selectedCell] || '' : '')}
              onChange={(e) => {
                if (selectedCell) {
                  setCellValue(selectedCell, e.target.value)
                }
              }}
            />
          </div>
          <div className="toolbar-extras">
            <ExcelImportExport
              exportToExcel={exportToExcel}
              importFromExcel={importFromExcel}
            />
            <button className="debug-btn" onClick={handleStartDebug} title="调试当前单元格公式">
              🔍 公式调试
            </button>
            <button className="pivot-btn" onClick={() => setShowPivot(true)} title="创建数据透视表">
              📊 数据透视
            </button>
          </div>
        </div>

        <Spreadsheet
          cellValues={cellValues}
          onCellChange={setCellValue}
          getCellFormula={getCellFormula}
          rows={100}
          cols={100}
          onCellSelect={handleCellSelect}
        />
      </main>

      {showDebugger && debugCell && (
        <>
          <div className="modal-overlay" onClick={() => setShowDebugger(false)} />
          <FormulaDebugger
            cellRef={debugCell}
            session={debugSession}
            onStepForward={handleDebugStepForward}
            onStepBackward={handleDebugStepBackward}
            onRunToBreakpoint={handleDebugRunToBreakpoint}
            onRunToCompletion={handleDebugRunToCompletion}
            onToggleBreakpoint={handleDebugToggleBreakpoint}
            onEndSession={handleDebugEndSession}
            onClose={handleDebugEndSession}
          />
        </>
      )}

      {showPivot && (
        <>
          <div className="modal-overlay" onClick={() => setShowPivot(false)} />
          <PivotTablePanel
            getPivotFields={getPivotFields}
            generatePivotTable={generatePivotTable}
            onClose={() => setShowPivot(false)}
          />
        </>
      )}

      <footer className="status-bar">
        <div className="status-item">
          <span>✅ WASM 引擎已加载</span>
          <span>|</span>
          <span>单元格: 100x100</span>
        </div>
        <div className="status-item">
          <span>支持公式: SUM, AVERAGE, IF, VLOOKUP, 自定义函数</span>
          {selectedCell && (
            <>
              <span>|</span>
              <span>选中: {selectedCell}</span>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}

export default App
