import React, { useState } from 'react';
import { Plus, Folder, FileText, Upload, X, ShieldCheck, Scale, Trash2 } from 'lucide-react';
import { Project, Role, CaseFile } from '../types';
import { analyzeLegalContext } from '../services/geminiService';
import { processFiles, ProcessFilesResult } from '../utils/fileProcessor';

interface DashboardProps {
  projects: Project[];
  onCreateProject: (project: Project) => void;
  onSelectProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, onCreateProject, onSelectProject, onDeleteProject }) => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [caseTitle, setCaseTitle] = useState('');
  const [description, setDescription] = useState('');
  const [userSide, setUserSide] = useState<Role>(Role.Petitioner);
  const [files, setFiles] = useState<CaseFile[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setLoading(true); // Show loading while processing PDFs
      const result: ProcessFilesResult = await processFiles(e.target.files);

      // Notify user of failed files
      if (result.failedFiles.length > 0) {
        alert(`Could not process the following files:\n${result.failedFiles.join('\n')}\n\nThese files were skipped.`);
      }

      setFiles([...files, ...result.files]);
      setLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent opening the project when clicking delete
    if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
        onDeleteProject(projectId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Generate Legal Context using AI
    const legalContext = await analyzeLegalContext(
      caseTitle || name,
      description,
      files.map(f => f.content)
    );

    const newProject: Project = {
      id: Date.now().toString(),
      name,
      caseTitle,
      description,
      userSide,
      files,
      createdAt: Date.now(),
      legalContext
    };

    onCreateProject(newProject);
    setLoading(false);
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setCaseTitle('');
    setDescription('');
    setUserSide(Role.Petitioner);
    setFiles([]);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-legal-900">Case Dashboard</h2>
          <p className="text-legal-500 mt-1">Manage your legal projects and simulations</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 bg-legal-900 hover:bg-legal-800 text-white px-6 py-3 rounded-lg shadow-lg transition-all"
        >
          <Plus size={20} />
          Create New Project
        </button>
      </header>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-legal-100 p-12 text-center">
          <div className="w-20 h-20 bg-legal-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Scale className="text-legal-400" size={40} />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Cases Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-8">Start by creating a new case project. Upload your documents and let our AI analyze the legal landscape.</p>
          <button 
            onClick={() => setShowModal(true)}
            className="text-saffron font-medium hover:underline"
          >
            Create your first project &rarr;
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <div 
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="group bg-white rounded-xl border border-legal-100 shadow-sm hover:shadow-xl transition-all cursor-pointer p-6 flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-legal-200 group-hover:bg-saffron transition-colors"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-lg bg-legal-50 flex items-center justify-center text-legal-700">
                  <Folder size={24} />
                </div>
                <div className="flex gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${project.userSide === Role.Petitioner ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {project.userSide}
                    </span>
                    <button 
                        onClick={(e) => handleDeleteClick(e, project.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Delete Project"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
              </div>
              
              <h3 className="font-serif font-bold text-lg text-gray-900 mb-1 group-hover:text-saffron transition-colors">{project.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{project.caseTitle || "Untitled Case"}</p>
              
              <div className="mt-auto pt-4 border-t border-legal-50 flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <FileText size={14} /> {project.files.length} Docs
                </span>
                <span>{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-legal-100 flex justify-between items-center">
              <h3 className="text-2xl font-serif font-bold text-legal-900">New Court Project</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                  <input 
                    required 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Sharma vs State"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Case Title</label>
                  <input 
                    type="text" 
                    value={caseTitle} 
                    onChange={e => setCaseTitle(e.target.value)}
                    placeholder="Official Case No./Title"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief summary of the case facts..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron focus:border-transparent outline-none h-24"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Which side are you on?</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => setUserSide(Role.Petitioner)}
                    className={`p-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${userSide === Role.Petitioner ? 'border-legal-800 bg-legal-50 text-legal-900' : 'border-gray-200 text-gray-400'}`}
                  >
                    <ShieldCheck size={20} /> Petitioner
                  </button>
                  <button 
                    type="button"
                    onClick={() => setUserSide(Role.Respondent)}
                    className={`p-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${userSide === Role.Respondent ? 'border-legal-800 bg-legal-50 text-legal-900' : 'border-gray-200 text-gray-400'}`}
                  >
                    <ShieldCheck size={20} /> Respondent
                  </button>
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50 text-center">
                <input 
                  type="file" 
                  id="file-upload" 
                  multiple 
                  accept=".txt,.pdf,.docx"
                  onChange={handleFileChange}
                  className="hidden" 
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <Upload className="text-gray-400 mb-2" size={32} />
                  <span className="text-sm font-medium text-legal-700">Upload Affidavits, Evidence, Proceedings</span>
                  <span className="text-xs text-gray-500 mt-1">Supported: PDF, DOCX, TXT</span>
                </label>
                {files.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {files.map((f, i) => (
                      <span key={i} className="text-xs bg-white px-2 py-1 border rounded shadow-sm text-gray-600">
                        {f.name}
                      </span>
                    ))}
                  </div>
                )}
                {loading && <p className="text-xs text-saffron mt-2 animate-pulse">Processing files...</p>}
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-6 py-2 bg-saffron hover:bg-orange-500 text-white font-medium rounded-lg shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;