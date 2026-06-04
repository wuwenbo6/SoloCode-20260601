import { useState, useEffect } from 'react'
import type { FormulaDebugSession, FormulaDebugStep } from '../hooks/useSpreadsheetEngine'

interface FormulaDebuggerProps {
  cellRef: string
  session: FormulaDebugSession | null
  onStepForward: (cellRef: string) => FormulaDebugSession | null
  onStepBackward: (cellRef: string) => FormulaDebugSession | null
  onRunToBreakpoint: (cellRef: string) => FormulaDebugSession | null
  onRunToCompletion: (cellRef: string) => FormulaDebugSession | null
  onToggleBreakpoint: (cellRef: string, stepIndex: number) => void
  onEndSession: (cellRef: string) => void
  onClose: () => void
}

export default function FormulaDebugger({
  cellRef,
  session,
  onStepForward,
  onStepBackward,
  onRunToBreakpoint,
  onRunToCompletion,
  onToggleBreakpoint,
  onEndSession,
  onClose
}: FormulaDebuggerProps) {
  const [localSession, setLocalSession] = useState<FormulaDebugSession | null>(session)

  useEffect(() => {
    setLocalSession(session)
  }, [session])

  if (!localSession) return null

  const currentStep = localSession.steps[localSession.current_step]
  const prevStep = localSession.current_step > 0 
    ? localSession.steps[localSession.current_step - 1] 
    : null

  const handleStepForward = () => {
    const newSession = onStepForward(cellRef)
    setLocalSession(newSession)
  }

  const handleStepBackward = () => {
    const newSession = onStepBackward(cellRef)
    setLocalSession(newSession)
  }

  const handleRunToBreakpoint = () => {
    const newSession = onRunToBreakpoint(cellRef)
    setLocalSession(newSession)
  }

  const handleRunToCompletion = () => {
    const newSession = onRunToCompletion(cellRef)
    setLocalSession(newSession)
  }

  const handleToggleBreakpoint = (stepIndex: number) => {
    onToggleBreakpoint(cellRef, stepIndex)
    if (localSession) {
      const bp = [...localSession.breakpoints]
      const idx = bp.indexOf(stepIndex)
      if (idx >= 0) {
        bp.splice(idx, 1)
      } else {
        bp.push(stepIndex)
        bp.sort()
      }
      setLocalSession({ ...localSession, breakpoints: bp })
    }
  }

  const handleEndSession = () => {
    onEndSession(cellRef)
    onClose()
  }

  return (
    <div className="debugger-panel">
      <div className="debugger-header">
        <h3>🔍 公式调试器 - {localSession.cell_ref}</h3>
        <button className="close-btn" onClick={handleEndSession}>✕</button>
      </div>

      <div className="debugger-formula">
        <span className="label">原始公式:</span>
        <code>= {localSession.original_formula}</code>
      </div>

      <div className="debugger-controls">
        <button 
          onClick={handleStepBackward}
          disabled={localSession.current_step === 0}
          title="上一步"
        >
          ⏮ 上一步
        </button>
        <button 
          onClick={handleStepForward}
          disabled={localSession.is_complete}
          title="下一步"
        >
          下一步 ⏭
        </button>
        <button 
          onClick={handleRunToBreakpoint}
          disabled={localSession.breakpoints.length === 0 || localSession.is_complete}
          title="运行到断点"
        >
          ▶ 到断点
        </button>
        <button 
          onClick={handleRunToCompletion}
          disabled={localSession.is_complete}
          title="运行完成"
        >
          ⏭⏭ 完成
        </button>
      </div>

      <div className="debugger-current">
        <div className="current-expression">
          <div className="label">当前表达式:</div>
          <div className="expression-code">
            {currentStep?.expression || ''}
          </div>
        </div>
        {prevStep && prevStep.sub_expression && (
          <div className="sub-expression">
            <span className="label">子表达式:</span>
            <code>{prevStep.sub_expression}</code>
            <span className="arrow">→</span>
            <code className="result">{prevStep.result}</code>
          </div>
        )}
        {localSession.is_complete && (
          <div className="final-result">
            <span className="label">✅ 最终结果:</span>
            <code className="result">{localSession.final_result}</code>
          </div>
        )}
      </div>

      <div className="debugger-steps">
        <div className="steps-header">
          <h4>计算步骤 ({localSession.steps.length} 步)</h4>
          <div className="step-progress">
            进度: {Math.min(localSession.current_step + 1, localSession.steps.length)} / {localSession.steps.length}
          </div>
        </div>
        <div className="steps-list">
          {localSession.steps.map((step, idx) => (
            <StepItem 
              key={idx} 
              step={step} 
              isActive={idx === localSession.current_step}
              isCompleted={idx < localSession.current_step}
              hasBreakpoint={localSession.breakpoints.includes(step.step_index)}
              onToggleBreakpoint={() => handleToggleBreakpoint(step.step_index)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StepItem({ 
  step, 
  isActive, 
  isCompleted,
  hasBreakpoint,
  onToggleBreakpoint 
}: { 
  step: FormulaDebugStep
  isActive: boolean
  isCompleted: boolean
  hasBreakpoint: boolean
  onToggleBreakpoint: () => void
}) {
  return (
    <div 
      className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
    >
      <button 
        className={`breakpoint-btn ${hasBreakpoint ? 'active' : ''}`}
        onClick={onToggleBreakpoint}
        title={hasBreakpoint ? '移除断点' : '添加断点'}
      >
        {hasBreakpoint ? '🔴' : '⚪'}
      </button>
      <span className="step-index">{step.step_index + 1}.</span>
      <span className="step-content">
        {step.sub_expression ? (
          <>
            <code className="sub-expr">{step.sub_expression}</code>
            <span className="arrow">→</span>
            <code className="result">{step.result}</code>
          </>
        ) : (
          <code className="result">{step.result}</code>
        )}
      </span>
      {step.dependencies.length > 0 && (
        <span className="deps">
          📍 {step.dependencies.join(', ')}
        </span>
      )}
    </div>
  )
}
