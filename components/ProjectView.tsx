import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Plus, PlayCircle, FileText, RefreshCw, X, Trash2, Check } from 'lucide-react';
import { Project, Session, CaseFile } from '../types';
import { processFiles, ProcessFilesResult } from '../utils/fileProcessor';
import { analyzeLegalContext } from '../services/geminiService';

interface ProjectViewProps {
  project: Project;
  onStartSession: (session: Session) => void;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
}

const ProjectView: React.FC<ProjectViewProps> = ({ project, onStartSession, onBack, onUpdateProject }) => {
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionReason, setSessionReason] = useState('');
  const [maxTurns, setMaxTurns] = useState(6);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  const [sessions, setSessions] = useState<Session[]>(() => {
    const savedSessions = localStorage.getItem(`sessions_${project.id}`);
    return savedSessions ? JSON.parse(savedSessions) : [];
  });

  const openSessionModal = () => {
    setSelectedFileIds(project.files.map(f => f.id));
    setShowSessionModal(true);
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]);
  };

  const handleDeleteDocument = async (fileId: string) => {
    if (!window.confirm('Remove this document?')) return;
    const updatedFiles = project.files.filter(f => f.id !== fileId);
    setIsAnalyzing(true);
    let updatedLegalContext = updatedFiles.length > 0
      ? await analyzeLegalContext(project.caseTitle || project.name, project.description, updatedFiles.map(f => f.content))
      : 'No documents available for analysis.';
    onUpdateProject({ ...project, files: updatedFiles, legalContext: updatedLegalContext });
    setIsAnalyzing(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!window.confirm('Delete this session?')) return;
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    localStorage.setItem(`sessions_${project.id}`, JSON.stringify(updatedSessions));
  };

  const getSessionDocInfo = (session: Session) => {
    if (!session.selectedFileIds?.length) return 'All docs';
    return session.selectedFileIds.length === project.files.length ? 'All docs' : `${session.selectedFileIds.length} docs`;
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFileIds.length === 0) { alert('Select at least one document.'); return; }
    const newSession: Session = {
      id: Date.now().toString(),
      projectId: project.id,
      reason: sessionReason,
      maxTurns: maxTurns,
      currentTurnCount: 0,
      status: 'active',
      messages: [],
      createdAt: Date.now(),
      selectedFileIds: selectedFileIds
    };

    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    localStorage.setItem(`sessions_${project.id}`, JSON.stringify(updatedSessions));

    setShowSessionModal(false);
    setSessionReason('');
    setSelectedFileIds([]);
    onStartSession(newSession);
  };

  const handleAddDocuments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsAnalyzing(true);
      try {
        // 1. Process new files
        const result: ProcessFilesResult = await processFiles(e.target.files);
        const newFiles = result.files;

        // Notify user of failed files
        if (result.failedFiles.length > 0) {
          alert(`Could not process the following files:\n${result.failedFiles.join('\n')}\n\nThese files were skipped.`);
        }

        // If no files were successfully processed, stop here
        if (newFiles.length === 0) {
          setIsAnalyzing(false);
          return;
        }

        const updatedFiles = [...project.files, ...newFiles];

        // 2. Re-run Legal Analysis with all files
        const updatedLegalContext = await analyzeLegalContext(
          project.caseTitle || project.name,
          project.description,
          updatedFiles.map(f => f.content)
        );

        // 3. Update Project
        const updatedProject: Project = {
          ...project,
          files: updatedFiles,
          legalContext: updatedLegalContext
        };

        onUpdateProject(updatedProject);
      } catch (err) {
        console.error("Error adding documents", err);
        alert("Failed to process documents.");
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
          <ArrowLeft className="text-gray-600" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif font-bold text-legal-900">{project.name}</h2>
            <span className="px-3 py-1 text-xs font-semibold bg-gray-200 text-gray-700 rounded-full uppercase tracking-wide">
              {project.userSide} Side
            </span>
          </div>
          <p className="text-legal-500">{project.caseTitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Context & Files */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-legal-100 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-legal-800 mb-4">
              {isAnalyzing ? <RefreshCw size={20} className="text-saffron animate-spin" /> : <BookOpen size={20} className="text-saffron" />}
              Legal Brief (AI Generated)
            </h3>
            <div className="prose prose-sm text-gray-600 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {isAnalyzing ? (
                 <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <RefreshCw className="animate-spin mb-2" size={24} />
                    <p>Updating Analysis...</p>
                 </div>
              ) : project.legalContext ? (
                <div className="whitespace-pre-wrap">{project.legalContext}</div>
              ) : (
                <p className="italic text-gray-400">Analysis pending...</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-legal-100 p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-legal-800">
                <FileText size={20} className="text-legal-600" />
                Case Documents
                </h3>
                <label className="cursor-pointer bg-legal-50 hover:bg-legal-100 text-legal-800 p-2 rounded-full transition-colors" title="Add More Documents">
                    <input 
                      type="file" 
                      multiple 
                      accept=".txt,.pdf,.docx"
                      onChange={handleAddDocuments}
                      disabled={isAnalyzing}
                      className="hidden" 
                    />
                    <Plus size={16} />
                </label>
            </div>
            
            {project.files.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">No documents uploaded.</p>
            ) : (
              <ul className="space-y-3">
                {project.files.map(file => (
                  <li key={file.id} className="flex items-center gap-3 p-3 bg-legal-50 rounded-lg text-sm border border-legal-100 group">
                    <div className={`p-2 rounded shadow-sm font-bold text-xs ${file.type.includes('pdf') ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                      {file.type.includes('pdf') ? 'PDF' : 'DOC'}
                    </div>
                    <span className="truncate flex-1 text-gray-700">{file.name}</span>
                    <button onClick={() => handleDeleteDocument(file.id)} disabled={isAnalyzing} className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" title="Remove"><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
            {isAnalyzing && (
                <p className="text-xs text-saffron mt-3 text-center animate-pulse">Processing new files...</p>
            )}
          </div>
        </div>

        {/* Right Column: Sessions */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-legal-900">Court Sessions</h3>
            <button onClick={openSessionModal} disabled={project.files.length === 0} className="flex items-center gap-2 bg-saffron hover:bg-orange-600 text-white px-4 py-2 rounded-lg shadow transition-colors disabled:opacity-50">
              <Plus size={18} /> New Session
            </button>
          </div>

          <div className="space-y-4">
            {sessions.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-gray-500">No sessions recorded yet.</p>
                {project.files.length > 0 && <button onClick={openSessionModal} className="text-saffron font-medium mt-2">Start a simulation</button>}
              </div>
            ) : (
              sessions.map(session => (
                <div key={session.id} className="bg-white rounded-xl border border-legal-100 shadow-sm p-6 hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg text-gray-900 mb-1">{session.reason}</h4>
                      <p className="text-sm text-gray-500">
                        {new Date(session.createdAt).toLocaleDateString()} • {session.maxTurns} Turns •
                        <span className={`ml-2 capitalize ${session.status === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>{session.status}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Using: {getSessionDocInfo(session)}</p>
                      {session.verdict && <p className="text-xs text-gray-600 mt-2 bg-gray-100 p-2 rounded inline-block max-w-md truncate">Verdict: {session.verdict}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDeleteSession(session.id)} className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" title="Delete"><Trash2 size={18} /></button>
                      <button onClick={() => onStartSession(session)} className="p-3 bg-legal-50 hover:bg-legal-100 text-legal-800 rounded-full transition-colors"><PlayCircle size={24} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
              <h3 className="text-xl font-bold text-gray-900">Configure Simulation</h3>
              <button onClick={() => setShowSessionModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateSession} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Session</label>
                <input type="text" required placeholder="e.g. Bail Hearing, Evidence Submission" value={sessionReason} onChange={(e) => setSessionReason(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Turns)</label>
                <select value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron outline-none">
                  <option value={4}>Short (4 Turns)</option>
                  <option value={6}>Medium (6 Turns)</option>
                  <option value={10}>Long (10 Turns)</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Select Documents</label>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => setSelectedFileIds(project.files.map(f => f.id))} className="text-saffron hover:underline">All</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setSelectedFileIds([])} className="text-gray-500 hover:underline">Clear</button>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                  {project.files.map(file => (
                    <label key={file.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${selectedFileIds.includes(file.id) ? 'bg-saffron/5' : ''}`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedFileIds.includes(file.id) ? 'bg-saffron border-saffron text-white' : 'border-gray-300'}`}>
                        {selectedFileIds.includes(file.id) && <Check size={14} />}
                      </div>
                      <input type="checkbox" checked={selectedFileIds.includes(file.id)} onChange={() => toggleFileSelection(file.id)} className="hidden" />
                      <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">{selectedFileIds.length} of {project.files.length} selected</p>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={selectedFileIds.length === 0} className="w-full py-2.5 bg-legal-900 text-white font-medium rounded-lg hover:bg-legal-800 transition-colors disabled:opacity-50">Start Court Session</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectView;