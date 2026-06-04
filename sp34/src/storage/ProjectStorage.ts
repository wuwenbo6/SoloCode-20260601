import { Project, Track } from '../types';

const DB_NAME = 'MIDIStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export class ProjectStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open database:', request.error);
        reject(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }

  async saveProject(project: Project): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      project.updatedAt = Date.now();
      const request = store.put(project);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getProject(id: string): Promise<Project | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllProjects(): Promise<Project[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const projects = request.result || [];
        projects.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(projects);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  exportToJSON(project: Project): string {
    return JSON.stringify(project, null, 2);
  }

  importFromJSON(jsonString: string): Project {
    const project = JSON.parse(jsonString) as Project;
    
    if (!project.id || !project.name || !Array.isArray(project.tracks)) {
      throw new Error('Invalid project format');
    }

    return {
      ...project,
      id: `${project.id}-imported-${Date.now()}`,
      name: `${project.name} (Imported)`,
      updatedAt: Date.now()
    };
  }

  downloadProject(project: Project) {
    const json = this.exportToJSON(project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.midiproject`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async loadFromFile(file: File): Promise<Project> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const project = this.importFromJSON(content);
          resolve(project);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  createNewProject(name: string = 'Untitled Project'): Project {
    return {
      id: `project-${Date.now()}`,
      name,
      bpm: 120,
      timeSignature: [4, 4],
      tracks: [this.createNewTrack('Track 1')],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  createNewTrack(name: string): Track {
    return {
      id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      notes: [],
      muted: false,
      solo: false,
      volume: 0.8,
      instrument: 'piano',
      automation: [],
      effects: {
        reverb: {
          enabled: false,
          mix: 0.3,
          decay: 2
        },
        delay: {
          enabled: false,
          time: 0.3,
          feedback: 0.4,
          mix: 0.3
        },
        filter: {
          enabled: false,
          type: 'lowpass',
          frequency: 1000,
          q: 1,
          gain: 0
        }
      }
    };
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const projectStorage = new ProjectStorage();
