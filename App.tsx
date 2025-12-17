import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Gavel, FolderOpen, Calendar, Scale, Loader2, Database, Archive } from 'lucide-react';
import Dashboard from './components/Dashboard';
import ProjectView from './components/ProjectView';
import HearingsPage from './components/HearingsPage';
import SimulationRoom from './components/Simulation';
import ArchivesPage from './components/ArchivesPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import ApiKeyManager from './components/ApiKeyManager';
import { Project, Session } from './types';
import {
  initStorage,
  getAllProjects,
  saveProject,
  deleteProject as deleteProjectFromStorage,
  getSessionsByProject,
  saveSession,
  saveProjectSessions,
  getStorageStats,
  isUsingFallback
} from './services/storageService';

// API key still uses localStorage for simplicity (small data, needs sync access)
const API_KEY_STORAGE = 'gemini_api_key';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'project' | 'hearings' | 'simulation' | 'archives'>('dashboard');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [continuationSession, setContinuationSession] = useState<Session | null>(null);

  // Session state: Map of projectId -> sessions array
  const [projectSessions, setProjectSessions] = useState<Record<string, Session[]>>({});

  // Storage initialization state
  const [isStorageInitialized, setIsStorageInitialized] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [usingFallbackStorage, setUsingFallbackStorage] = useState(false);

  // Initialize storage and load data on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize IndexedDB storage (with automatic migration from localStorage)
        await initStorage();
        setUsingFallbackStorage(isUsingFallback());

        // Load projects from storage
        const loadedProjects = await getAllProjects();
        setProjects(loadedProjects);

        // Load sessions for all projects
        const sessionsMap: Record<string, Session[]> = {};
        for (const project of loadedProjects) {
          try {
            const sessions = await getSessionsByProject(project.id);
            sessionsMap[project.id] = sessions;
          } catch (e) {
            console.error(`Failed to load sessions for project ${project.id}`, e);
            sessionsMap[project.id] = [];
          }
        }
        setProjectSessions(sessionsMap);

        // Log storage stats
        const stats = await getStorageStats();
        console.log('Storage initialized:', stats);

        setIsStorageInitialized(true);
      } catch (error) {
        console.error('Failed to initialize storage:', error);
        setStorageError(error instanceof Error ? error.message : 'Unknown storage error');
        setIsStorageInitialized(true); // Still mark as initialized to show UI
      }
    };

    // Load API key from localStorage (sync, small data)
    const savedKey = localStorage.getItem(API_KEY_STORAGE);
    if (savedKey) {
      setApiKey(savedKey);
    }

    initializeApp();
  }, []);

  const handleApiKeysChange = (keys: string) => {
    setApiKey(keys);
    localStorage.setItem(API_KEY_STORAGE, keys);
  };

  const handleCreateProject = async (project: Project) => {
    // Save to storage first
    await saveProject(project);
    // Update local state
    setProjects([project, ...projects]);
    setActiveProject(project);
    setProjectSessions(prev => ({ ...prev, [project.id]: [] }));
    setView('project');
  };

  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    setView('project');
  };

  const handleDeleteProject = async (projectId: string) => {
    // Delete from storage
    await deleteProjectFromStorage(projectId);
    // Update local state
    const updatedProjects = projects.filter(p => p.id !== projectId);
    setProjects(updatedProjects);
    // Clean up sessions from state
    setProjectSessions(prev => {
      const newSessions = { ...prev };
      delete newSessions[projectId];
      return newSessions;
    });
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

  const handleProceedToHearings = () => {
    setView('hearings');
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

  const handleBackToHearings = () => {
    setActiveSession(null);
    setContinuationSession(null);
    setView('hearings');
  };

  const handleContinueSession = (parentSession: Session) => {
    setContinuationSession(parentSession);
    setActiveSession(null);
    setView('hearings');
  };

  const handleClearContinuationSession = useCallback(() => {
    setContinuationSession(null);
  }, []);

  // Update a specific project in state (e.g. adding a session)
  const updateProject = useCallback(async (updatedProject: Project) => {
    // Save to storage
    await saveProject(updatedProject);
    // Update local state
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    setActiveProject(updatedProject);
  }, []);

  // Get sessions for the active project
  const getActiveProjectSessions = useCallback((): Session[] => {
    if (!activeProject) return [];
    return projectSessions[activeProject.id] || [];
  }, [activeProject, projectSessions]);

  // Update sessions for a project (called from HearingsPage and Simulation)
  const handleUpdateProjectSessions = useCallback(async (projectId: string, sessions: Session[]) => {
    // Update local state first for responsiveness
    setProjectSessions(prev => ({
      ...prev,
      [projectId]: sessions
    }));
    // Persist to IndexedDB
    await saveProjectSessions(projectId, sessions);
  }, []);

  // Update a single session (called from Simulation when session progresses)
  const updateSessionHandler = useCallback(async (updatedSession: Session) => {
    const projectId = updatedSession.projectId;

    // Update local state first for responsiveness
    setProjectSessions(prev => {
      const currentSessions = prev[projectId] || [];
      const updatedSessions = currentSessions.map(s =>
        s.id === updatedSession.id ? updatedSession : s
      );
      return {
        ...prev,
        [projectId]: updatedSessions
      };
    });

    // Also update activeSession if it's the same session
    if (activeSession && activeSession.id === updatedSession.id) {
      setActiveSession(updatedSession);
    }

    // Persist to IndexedDB
    await saveSession(updatedSession);
  }, [activeSession]);

  // Show loading screen while storage initializes
  if (!isStorageInitialized) {
    return (
      <div className="min-h-screen bg-legal-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <Database className="h-12 w-12 text-saffron animate-pulse" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-legal-600" />
            <span className="text-legal-700 font-medium">Initializing storage...</span>
          </div>
          <p className="text-xs text-legal-500">Loading your projects and sessions</p>
        </div>
      </div>
    );
  }

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

          <button
            onClick={() => setView('archives')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${view === 'archives' ? 'bg-legal-800 text-saffron border-l-4 border-saffron' : 'hover:bg-legal-800 text-gray-300'}`}
          >
            <Archive size={20} />
            <span className="font-medium">Archives</span>
          </button>

          {activeProject && (
            <>
              <button
                onClick={handleBackToProject}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${view === 'project' ? 'bg-legal-800 text-saffron border-l-4 border-saffron' : 'hover:bg-legal-800 text-gray-300'}`}
              >
                <FolderOpen size={20} />
                <span className="font-medium truncate">{activeProject.name}</span>
              </button>

              <button
                onClick={handleProceedToHearings}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${view === 'hearings' ? 'bg-legal-800 text-saffron border-l-4 border-saffron' : 'hover:bg-legal-800 text-gray-300'}`}
              >
                <Calendar size={20} />
                <span className="font-medium">Hearings</span>
              </button>
            </>
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
          <ApiKeyManager
            onKeysChange={handleApiKeysChange}
            initialKeys={apiKey}
          />
          <div className="text-xs text-gray-500 space-y-1">
            <p>© 2025 NyayaSutra AI.</p>
            <p>Indian Legal Simulator.</p>
            <div className="flex items-center gap-1 pt-1">
              <Database size={10} className={usingFallbackStorage ? 'text-yellow-500' : 'text-green-500'} />
              <span className={usingFallbackStorage ? 'text-yellow-500' : 'text-green-500'}>
                {usingFallbackStorage ? 'LocalStorage' : 'IndexedDB'}
              </span>
            </div>
            {storageError && (
              <p className="text-red-400 text-[10px]">{storageError}</p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        <ErrorBoundary componentName="Dashboard" showDetails>
          {view === 'dashboard' && (
            <Dashboard
              projects={projects}
              onCreateProject={handleCreateProject}
              onSelectProject={handleSelectProject}
              onDeleteProject={handleDeleteProject}
            />
          )}
        </ErrorBoundary>

        <ErrorBoundary componentName="Archives" showDetails>
          {view === 'archives' && (
            <ArchivesPage />
          )}
        </ErrorBoundary>

        <ErrorBoundary componentName="Project View" showDetails>
          {view === 'project' && activeProject && (
            <ProjectView
              project={activeProject}
              onProceedToHearings={handleProceedToHearings}
              onBack={handleBackToDashboard}
              onUpdateProject={updateProject}
            />
          )}
        </ErrorBoundary>

        <ErrorBoundary componentName="Hearings" showDetails>
          {view === 'hearings' && activeProject && (
            <HearingsPage
              project={activeProject}
              onBack={handleBackToProject}
              onStartHearing={handleStartSession}
              initialContinuationSession={continuationSession}
              onClearContinuationSession={handleClearContinuationSession}
              sessions={getActiveProjectSessions()}
              onUpdateSessions={(sessions) => handleUpdateProjectSessions(activeProject.id, sessions)}
            />
          )}
        </ErrorBoundary>

        <ErrorBoundary componentName="Courtroom Simulation" showDetails>
          {view === 'simulation' && activeSession && activeProject && (
            <SimulationRoom
              session={activeSession}
              project={activeProject}
              onBack={handleBackToHearings}
              onContinueSession={handleContinueSession}
              onSessionUpdate={updateSessionHandler}
            />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default App;