import React, { useRef } from 'react';
import { useStudio } from '../context/StudioContext';

export const ProjectModal: React.FC = () => {
  const { state, dispatch, loadProject, createNewProject, deleteProject, importProject } = useStudio();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!state.showProjectModal) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importProject(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay" onClick={() => dispatch({ type: 'SET_PROJECT_MODAL', payload: false })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Projects</h2>
          <button 
            className="btn-close"
            onClick={() => dispatch({ type: 'SET_PROJECT_MODAL', payload: false })}
          >
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="project-actions">
            <button className="btn btn-primary" onClick={createNewProject}>
              + New Project
            </button>
            <label className="btn btn-outline">
              Import Project
              <input
                ref={fileInputRef}
                type="file"
                accept=".midiproject,.json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div className="project-list">
            {state.projects.length === 0 ? (
              <div className="empty-projects">
                No saved projects yet. Create a new one or import an existing project.
              </div>
            ) : (
              state.projects.map((project) => (
                <div key={project.id} className="project-item">
                  <div className="project-info" onClick={() => loadProject(project)}>
                    <div className="project-name">{project.name}</div>
                    <div className="project-meta">
                      <span>{project.tracks.length} tracks</span>
                      <span>{project.bpm} BPM</span>
                      <span>Updated: {formatDate(project.updatedAt)}</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject(project.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
