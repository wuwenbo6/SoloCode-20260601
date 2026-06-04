import React, { useRef, useEffect, useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { CC_MAPPINGS } from '../audio/AutomationManager';

export const AutomationEditor: React.FC = () => {
  const { state, dispatch } = useStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 200 });
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);

  const selectedTrack = state.project.tracks.find(t => t.id === state.selectedTrackId);
  const selectedAutomation = selectedTrack?.automation.find(a => a.id === selectedAutomationId);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedAutomation) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.strokeStyle = '#2a2a4e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const gridValues = [0, 32, 64, 96, 127];
    gridValues.forEach((val, i) => {
      ctx.fillStyle = '#555';
      ctx.font = '10px monospace';
      ctx.fillText(String(val), 5, height - (i * height / 4) + 10);
    });

    const beatMs = 60000 / state.project.bpm;
    const totalDurationMs = Math.max(
      selectedTrack?.notes.reduce((max, n) => Math.max(max, n.startTime + (n.duration || 0)), 0) || 8000,
      selectedAutomation.events.length > 0 
        ? Math.max(...selectedAutomation.events.map(e => e.time)) + 1000 
        : 8000
    );
    const pixelsPerMs = Math.max(0.05, (width - 50) / totalDurationMs);

    for (let t = 0; t < totalDurationMs; t += beatMs) {
      const x = 50 + t * pixelsPerMs;
      ctx.strokeStyle = '#3a3a5e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    const sortedEvents = [...selectedAutomation.events].sort((a, b) => a.time - b.time);

    if (sortedEvents.length > 0) {
      ctx.strokeStyle = '#4aff7f';
      ctx.lineWidth = 2;
      ctx.beginPath();

      sortedEvents.forEach((event, i) => {
        const x = 50 + event.time * pixelsPerMs;
        const y = height - (event.value / 127) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      sortedEvents.forEach((event) => {
        const x = 50 + event.time * pixelsPerMs;
        const y = height - (event.value / 127) * height;

        ctx.fillStyle = '#4aff7f';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#2a5e3a';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }, [dimensions, selectedAutomation, state.project.bpm, selectedTrack]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedAutomation || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const totalDurationMs = Math.max(8000, 
      selectedAutomation.events.length > 0 
        ? Math.max(...selectedAutomation.events.map(e => e.time)) + 1000 
        : 8000
    );
    const pixelsPerMs = Math.max(0.05, (dimensions.width - 50) / totalDurationMs);

    const timeMs = Math.max(0, (x - 50) / pixelsPerMs);
    const value = Math.max(0, Math.min(127, Math.round((1 - y / dimensions.height) * 127)));

    const newEvent = {
      id: `cc-${Date.now()}-${Math.random()}`,
      controller: selectedAutomation.ccNumber,
      value,
      time: Math.round(timeMs)
    };

    const updatedAutomation = {
      ...selectedAutomation,
      events: [...selectedAutomation.events, newEvent].sort((a, b) => a.time - b.time)
    };

    const updatedTrack = {
      ...selectedTrack!,
      automation: selectedTrack!.automation.map(a =>
        a.id === selectedAutomationId ? updatedAutomation : a
      )
    };

    dispatch({
      type: 'UPDATE_TRACK',
      payload: { trackId: state.selectedTrackId!, updates: { automation: updatedTrack.automation } }
    });
  };

  const handleDeleteEvent = (eventId: string) => {
    if (!selectedAutomation) return;

    const updatedAutomation = {
      ...selectedAutomation,
      events: selectedAutomation.events.filter(e => e.id !== eventId)
    };

    const updatedTrack = {
      ...selectedTrack!,
      automation: selectedTrack!.automation.map(a =>
        a.id === selectedAutomationId ? updatedAutomation : a
      )
    };

    dispatch({
      type: 'UPDATE_TRACK',
      payload: { trackId: state.selectedTrackId!, updates: { automation: updatedTrack.automation } }
    });
  };

  const handleAddAutomation = (ccNumber: number, paramName: string) => {
    const newAutomation = {
      id: `auto-${state.selectedTrackId}-${ccNumber}-${Date.now()}`,
      trackId: state.selectedTrackId!,
      parameterName: paramName,
      ccNumber,
      events: []
    };

    dispatch({
      type: 'UPDATE_TRACK',
      payload: {
        trackId: state.selectedTrackId!,
        updates: { automation: [...selectedTrack!.automation, newAutomation] }
      }
    });

    setSelectedAutomationId(newAutomation.id);
  };

  const handleDeleteAutomation = () => {
    if (!selectedAutomation) return;

    const updatedTrack = {
      ...selectedTrack!,
      automation: selectedTrack!.automation.filter(a => a.id !== selectedAutomationId)
    };

    dispatch({
      type: 'UPDATE_TRACK',
      payload: { trackId: state.selectedTrackId!, updates: { automation: updatedTrack.automation } }
    });

    setSelectedAutomationId(null);
  };

  if (!selectedTrack) {
    return (
      <div className="automation-editor">
        <div className="panel-empty">选择一个轨道以查看自动化</div>
      </div>
    );
  }

  return (
    <div className="automation-editor">
      <div className="automation-header">
        <h4>CC 自动化</h4>
        <select
          value={selectedAutomationId || ''}
          onChange={(e) => setSelectedAutomationId(e.target.value || null)}
          className="input-medium"
        >
          <option value="">选择自动化轨道</option>
          {selectedTrack.automation.map(auto => (
            <option key={auto.id} value={auto.id}>
              CC {auto.ccNumber} - {auto.parameterName} ({auto.events.length} 事件)
            </option>
          ))}
        </select>
        <button className="btn btn-small btn-danger" onClick={handleDeleteAutomation} disabled={!selectedAutomationId}>
          删除
        </button>
      </div>

      <div className="automation-add">
        <span className="text-muted">添加自动化:</span>
        {Object.entries(CC_MAPPINGS).filter(([cc]) => 
          !selectedTrack.automation.some(a => a.ccNumber === Number(cc))
        ).slice(0, 5).map(([cc, mapping]) => (
          <button
            key={cc}
            className="btn btn-small btn-outline"
            onClick={() => handleAddAutomation(Number(cc), mapping.param)}
          >
            CC{cc} {mapping.param}
          </button>
        ))}
      </div>

      {selectedAutomation ? (
        <>
          <div className="automation-canvas-container" ref={containerRef}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%' }}
              onClick={handleCanvasClick}
            />
          </div>
          <div className="automation-events">
            <h5>事件列表 ({selectedAutomation.events.length})</h5>
            <div className="events-list">
              {[...selectedAutomation.events].sort((a, b) => a.time - b.time).map((event, idx) => (
                <div key={event.id} className="event-item">
                  <span className="event-index">{idx + 1}</span>
                  <span className="event-time">{(event.time / 1000).toFixed(2)}s</span>
                  <span className="event-value">值: {event.value}</span>
                  <button
                    className="btn-tiny btn-danger"
                    onClick={() => handleDeleteEvent(event.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="panel-empty">点击画布添加 CC 事件，或选择一个自动化轨道</div>
      )}
    </div>
  );
};
