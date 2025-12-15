import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Gavel, FolderOpen, Plus, FileText, Scale, Key } from 'lucide-react';
import Dashboard from './components/Dashboard';
import ProjectView from './components/ProjectView';
import SimulationRoom from './components/Simulation';
import { Project, Session } from './types';

// Simple mocked persistence
const STORAGE_KEY = 'nyayasutra_data';
const API_KEY_STORAGE = 'gemini_api_key';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'project' | 'simulation'>('dashboard');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [apiKey, setApiKey] = useState('');

  // Load data and api key on mount
  useEffect(() => {
    const savedProjects = localStorage.getItem(STORAGE_KEY);
    if (savedProjects) {
      try {
        setProjects(JSON.parse(savedProjects));
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    }
    
    const savedKey = localStorage.getItem(API_KEY_STORAGE);
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  // Save projects to local storage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem(API_KEY_STORAGE, newKey);
  };

  const handleCreateProject = (project: Project) => {
    setProjects([project, ...projects]);
    setActiveProject(project);
    setView('project');
  };

  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    setView('project');
  };

  const handleDeleteProject = (projectId: string) => {
    const updatedProjects = projects.filter(p => p.id !== projectId);
    setProjects(updatedProjects);
    // If the active project is deleted, go back to dashboard
    if (activeProject && activeProject.id === projectId) {
      setActiveProject(null);
      setView('dashboard');
    }
  };

  const handleStartSession = (session: Session) => {
    setActiveSession(session);
    setView('simulation');
  };

  const handleBackToDashboard = () => {
    setActiveProject(null);
    setActiveSession(null);
    setView('dashboard');
  };

  const handleBackToProject = () => {
    setActiveSession(null);
    setView('project');
  };

  // Update a specific project in state (e.g. adding a session)
  const updateProject = (updatedProject: Project) => {
    setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
    setActiveProject(updatedProject);
  };

  return (
    <div className="min-h-screen bg-legal-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-legal-900 text-white flex flex-col shadow-xl z-20 sticky top-0 md:h-screen">
        <div className="p-6 border-b border-legal-800 flex items-center space-x-3">
          <Scale className="text-saffron h-8 w-8" />
          <div>
            <h1 className="text-xl font-serif font-bold text-gray-100 tracking-wide">NyayaSutra</h1>
            <p className="text-xs text-legal-500 uppercase tracking-wider">AI Legal Bench</p>
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2">
          <button 
            onClick={handleBackToDashboard}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${view === 'dashboard' ? 'bg-legal-800 text-saffron border-l-4 border-saffron' : 'hover:bg-legal-800 text-gray-300'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </button>
          
          {activeProject && (
            <button 
              onClick={handleBackToProject}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${view === 'project' ? 'bg-legal-800 text-saffron border-l-4 border-saffron' : 'hover:bg-legal-800 text-gray-300'}`}
            >
              <FolderOpen size={20} />
              <span className="font-medium truncate">{activeProject.name}</span>
            </button>
          )}

          {view === 'simulation' && (
            <button 
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-legal-800 text-indiaGreen border-l-4 border-indiaGreen animate-pulse`}
            >
              <Gavel size={20} />
              <span className="font-medium">Court Session Live</span>
            </button>
          )}
        </nav>

        <div className="p-4 bg-legal-950 border-t border-legal-800 space-y-4">
          <div className="space-y-1">
             <label className="text-[10px] uppercase text-legal-500 font-semibold tracking-wider flex items-center gap-1">
               <Key size={10} /> Gemini API Key
             </label>
             <input 
               type="password" 
               value={apiKey}
               onChange={handleApiKeyChange}
               placeholder="Paste API Key..."
               className="w-full bg-legal-900 border border-legal-800 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all placeholder-gray-700"
             />
          </div>
          <div className="text-xs text-gray-500">
            <p>© 2025 NyayaSutra AI.</p>
            <p>Indian Legal Simulator.</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        {view === 'dashboard' && (
          <Dashboard 
            projects={projects} 
            onCreateProject={handleCreateProject} 
            onSelectProject={handleSelectProject} 
            onDeleteProject={handleDeleteProject}
          />
        )}
        
        {view === 'project' && activeProject && (
          <ProjectView 
            project={activeProject} 
            onStartSession={handleStartSession}
            onBack={handleBackToDashboard}
            onUpdateProject={updateProject}
          />
        )}

        {view === 'simulation' && activeSession && activeProject && (
          <SimulationRoom 
            session={activeSession}
            project={activeProject}
            onBack={handleBackToProject}
          />
        )}
      </main>
    </div>
  );
};

export default App;