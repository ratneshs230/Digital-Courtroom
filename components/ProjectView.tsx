import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw, FileText, ChevronDown, ChevronUp, Edit3, Save, Calendar, Target, AlertTriangle, CheckCircle, Send, MessageSquare, Briefcase, Gavel, X, Loader2, Upload, Paperclip, FolderOpen, Plus, Trash2, GripVertical, RotateCcw, Columns, Clock, Download, Archive, Link2, Unlink } from 'lucide-react';
import { Project, CasePerspective, Role, Evidence, CaseFile, DocumentCategory, TimelineEvent, Archive as ArchiveType } from '../types';
import { analyzeAllDocuments, generatePerspectiveFromDrafts, chatWithPerspectiveAgent, regeneratePerspectiveFromEdit } from '../services/geminiService';
import { processFiles, ProcessFilesResult } from '../utils/fileProcessor';
import { getAllArchives, getArchivesByIds } from '../services/storageService';
import DocumentPanel from './DocumentPanel';
import ComparisonView from './ComparisonView';
import TimelineVisualization from './TimelineVisualization';
import { exportCaseToPDF } from '../utils/exportService';

interface ProjectViewProps {
  project: Project;
  onProceedToHearings: () => void;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
}

const ProjectView: React.FC<ProjectViewProps> = ({ project, onProceedToHearings, onBack, onUpdateProject }) => {
  const [activeTab, setActiveTab] = useState<'petitioner' | 'respondent'>(
    project.userSide === Role.Petitioner ? 'petitioner' : 'respondent'
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [analysisStep, setAnalysisStep] = useState<{ current: number; total: number } | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    chronology: true,
    keyFacts: true,
    evidences: true,
    theory: false,
    strengths: false,
    weaknesses: false,
    chat: true
  });

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [chatAttachments, setChatAttachments] = useState<CaseFile[]>([]);
  const [isUploadingChatFiles, setIsUploadingChatFiles] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const printContentRef = useRef<HTMLDivElement>(null);

  // Document panel state
  const [isDocPanelOpen, setIsDocPanelOpen] = useState(false);

  // Comparison and Timeline view state
  const [viewMode, setViewMode] = useState<'tabs' | 'comparison' | 'timeline'>('tabs');

  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Chronology editing state
  const [isEditingChronology, setIsEditingChronology] = useState(false);
  const [editableChronology, setEditableChronology] = useState<TimelineEvent[]>([]);
  const [isSavingChronology, setIsSavingChronology] = useState(false);

  // Drag-and-drop state for chronology
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Archive attachment state
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [availableArchives, setAvailableArchives] = useState<ArchiveType[]>([]);
  const [attachedArchives, setAttachedArchives] = useState<ArchiveType[]>([]);
  const [isLoadingArchives, setIsLoadingArchives] = useState(false);

  // Auto-generate perspectives if not done
  useEffect(() => {
    if (project.analysisStatus === 'pending' && project.files.length > 0) {
      generatePerspectivesDocByDoc();
    }
  }, [project.id]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [project.petitionerPerspective?.chatHistory, project.respondentPerspective?.chatHistory]);

  // Load attached archives when project changes
  useEffect(() => {
    const loadAttachedArchives = async () => {
      if (project.attachedArchiveIds && project.attachedArchiveIds.length > 0) {
        try {
          const archives = await getArchivesByIds(project.attachedArchiveIds);
          setAttachedArchives(archives);
        } catch (error) {
          console.error('Error loading attached archives:', error);
        }
      } else {
        setAttachedArchives([]);
      }
    };
    loadAttachedArchives();
  }, [project.attachedArchiveIds]);

  const generatePerspectivesDocByDoc = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress('Starting parallel document analysis...');
    onUpdateProject({ ...project, analysisStatus: 'analyzing' });

    try {
      // Process both perspectives in PARALLEL
      setAnalysisProgress('Analyzing documents for both perspectives in parallel...');

      // Create analysis tasks for both sides
      const petitionerAnalysis = async () => {
        const drafts = await analyzeAllDocuments(
          project.caseTitle || project.name,
          project.description,
          project.files,
          Role.Petitioner,
          (status, current, total) => {
            setAnalysisProgress(`Petitioner: ${status}`);
            setAnalysisStep({ current, total });
          }
        );
        return generatePerspectiveFromDrafts(
          project.caseTitle || project.name,
          project.description,
          drafts,
          Role.Petitioner
        );
      };

      const respondentAnalysis = async () => {
        const drafts = await analyzeAllDocuments(
          project.caseTitle || project.name,
          project.description,
          project.files,
          Role.Respondent,
          (status, current, total) => {
            // Only update if petitioner isn't already showing progress
            if (!analysisProgress.includes('Petitioner')) {
              setAnalysisProgress(`Respondent: ${status}`);
            }
          }
        );
        return generatePerspectiveFromDrafts(
          project.caseTitle || project.name,
          project.description,
          drafts,
          Role.Respondent
        );
      };

      // Run both in parallel
      setAnalysisProgress('Processing both Petitioner and Respondent perspectives in parallel...');
      const [petitionerPerspective, respondentPerspective] = await Promise.all([
        petitionerAnalysis(),
        respondentAnalysis()
      ]);

      onUpdateProject({
        ...project,
        petitionerPerspective,
        respondentPerspective,
        analysisStatus: 'completed'
      });
    } catch (error) {
      console.error('Error generating perspectives:', error);
      onUpdateProject({
        ...project,
        analysisStatus: 'error',
        analysisError: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
      setAnalysisStep(null);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getCurrentPerspective = (): CasePerspective | undefined => {
    return activeTab === 'petitioner' ? project.petitionerPerspective : project.respondentPerspective;
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsUploadingChatFiles(true);
    try {
      const result: ProcessFilesResult = await processFiles(e.target.files);

      if (result.failedFiles.length > 0) {
        alert(`Could not process: ${result.failedFiles.join(', ')}`);
      }

      const newFiles: CaseFile[] = result.files.map(f => ({
        ...f,
        uploadedAt: Date.now(),
        metadata: { category: DocumentCategory.Other }
      }));

      setChatAttachments([...chatAttachments, ...newFiles]);
    } catch (err) {
      alert('Failed to upload files');
    } finally {
      setIsUploadingChatFiles(false);
      e.target.value = '';
    }
  };

  const removeChatAttachment = (index: number) => {
    setChatAttachments(chatAttachments.filter((_, i) => i !== index));
  };

  const handleSendChatMessage = async () => {
    if ((!chatInput.trim() && chatAttachments.length === 0) || isChatting) return;

    const perspective = getCurrentPerspective();
    if (!perspective) return;

    setIsChatting(true);
    const message = chatInput.trim() || 'Please analyze the attached files.';
    const attachments = [...chatAttachments];
    setChatInput('');
    setChatAttachments([]);

    try {
      const result = await chatWithPerspectiveAgent(
        project,
        perspective,
        message,
        attachments.length > 0 ? attachments : undefined
      );

      // Build updated files list (only add attachments once)
      const updatedFiles = attachments.length > 0
        ? [...project.files, ...attachments]
        : project.files;

      // Update the project with the new perspective and files in a single update
      if (activeTab === 'petitioner') {
        onUpdateProject({
          ...project,
          files: updatedFiles,
          petitionerPerspective: result.updatedPerspective
        });
      } else {
        onUpdateProject({
          ...project,
          files: updatedFiles,
          respondentPerspective: result.updatedPerspective
        });
      }
    } catch (error) {
      console.error('Error chatting with agent:', error);
      alert('Failed to process your message. Please try again.');
    } finally {
      setIsChatting(false);
    }
  };

  const startEditingFact = (index: number, value: string) => {
    setEditingField(`fact-${index}`);
    setEditValue(value);
  };

  const saveEditedFact = (index: number) => {
    const perspective = getCurrentPerspective();
    if (!perspective) return;

    const updatedFacts = [...perspective.keyFacts];
    updatedFacts[index] = editValue;

    const updatedPerspective = { ...perspective, keyFacts: updatedFacts, isEdited: true };

    if (activeTab === 'petitioner') {
      onUpdateProject({ ...project, petitionerPerspective: updatedPerspective });
    } else {
      onUpdateProject({ ...project, respondentPerspective: updatedPerspective });
    }

    setEditingField(null);
    setEditValue('');
  };

  const saveLegalTheory = () => {
    const perspective = getCurrentPerspective();
    if (!perspective) return;

    const updatedPerspective = { ...perspective, legalTheory: editValue, isEdited: true };

    if (activeTab === 'petitioner') {
      onUpdateProject({ ...project, petitionerPerspective: updatedPerspective });
    } else {
      onUpdateProject({ ...project, respondentPerspective: updatedPerspective });
    }

    setEditingField(null);
    setEditValue('');
  };

  // Chronology editing functions
  const startEditingChronology = () => {
    const perspective = getCurrentPerspective();
    if (!perspective) return;
    setEditableChronology([...perspective.chronology]);
    setIsEditingChronology(true);
  };

  const cancelChronologyEdit = () => {
    setIsEditingChronology(false);
    setEditableChronology([]);
  };

  const updateChronologyEvent = (index: number, field: keyof TimelineEvent, value: string) => {
    setEditableChronology(prev => prev.map((event, i) =>
      i === index ? { ...event, [field]: value } : event
    ));
  };

  const deleteChronologyEvent = (index: number) => {
    setEditableChronology(prev => prev.filter((_, i) => i !== index));
  };

  const addChronologyEvent = () => {
    const newEvent: TimelineEvent = {
      id: `event_new_${Date.now()}`,
      description: '',
      significance: '',
      order: editableChronology.length
    };
    setEditableChronology(prev => [...prev, newEvent]);
  };

  const moveChronologyEvent = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= editableChronology.length) return;

    const newChronology = [...editableChronology];
    const temp = newChronology[fromIndex];
    newChronology[fromIndex] = newChronology[toIndex];
    newChronology[toIndex] = temp;

    // Update order values
    newChronology.forEach((event, i) => {
      event.order = i;
    });

    setEditableChronology(newChronology);
  };

  // Drag-and-drop handlers for chronology
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add a slight delay to show the drag effect
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && index !== draggedIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newChronology = [...editableChronology];
    const [draggedItem] = newChronology.splice(draggedIndex, 1);
    newChronology.splice(dropIndex, 0, draggedItem);

    // Update order values
    newChronology.forEach((event, i) => {
      event.order = i;
    });

    setEditableChronology(newChronology);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const saveChronologyAndReanalyze = async () => {
    const perspective = getCurrentPerspective();
    if (!perspective) return;

    setIsSavingChronology(true);

    try {
      // First update chronology directly
      const updatedPerspective: CasePerspective = {
        ...perspective,
        chronology: editableChronology.map((e, i) => ({ ...e, order: i })),
        isEdited: true
      };

      // Then regenerate the rest of the perspective based on new chronology
      const regeneratedPerspective = await regeneratePerspectiveFromEdit(
        project.caseTitle || project.name,
        project.description,
        updatedPerspective,
        (status) => setAnalysisProgress(status)
      );

      // Preserve the edited chronology
      regeneratedPerspective.chronology = editableChronology.map((e, i) => ({ ...e, order: i }));

      if (activeTab === 'petitioner') {
        onUpdateProject({ ...project, petitionerPerspective: regeneratedPerspective });
      } else {
        onUpdateProject({ ...project, respondentPerspective: regeneratedPerspective });
      }

      setIsEditingChronology(false);
      setEditableChronology([]);
    } catch (error) {
      console.error('Error saving chronology:', error);
      alert('Failed to save chronology. Please try again.');
    } finally {
      setIsSavingChronology(false);
      setAnalysisProgress('');
    }
  };

  const saveChronologyWithoutReanalyze = () => {
    const perspective = getCurrentPerspective();
    if (!perspective) return;

    const updatedPerspective: CasePerspective = {
      ...perspective,
      chronology: editableChronology.map((e, i) => ({ ...e, order: i })),
      isEdited: true
    };

    if (activeTab === 'petitioner') {
      onUpdateProject({ ...project, petitionerPerspective: updatedPerspective });
    } else {
      onUpdateProject({ ...project, respondentPerspective: updatedPerspective });
    }

    setIsEditingChronology(false);
    setEditableChronology([]);
  };

  const getEvidenceTypeBadgeColor = (type: Evidence['type']) => {
    switch (type) {
      case 'documentary': return 'bg-blue-100 text-blue-700';
      case 'testimonial': return 'bg-purple-100 text-purple-700';
      case 'circumstantial': return 'bg-yellow-100 text-yellow-700';
      case 'physical': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleExportPDF = () => {
    exportCaseToPDF(project.caseTitle || project.name, printContentRef.current);
  };

  // Archive attachment functions
  const openArchiveModal = async () => {
    setShowArchiveModal(true);
    setIsLoadingArchives(true);
    try {
      const archives = await getAllArchives();
      setAvailableArchives(archives);
    } catch (error) {
      console.error('Error loading archives:', error);
    } finally {
      setIsLoadingArchives(false);
    }
  };

  const isArchiveAttached = (archiveId: string): boolean => {
    return project.attachedArchiveIds?.includes(archiveId) || false;
  };

  const toggleArchiveAttachment = (archiveId: string) => {
    const currentAttached = project.attachedArchiveIds || [];
    let newAttached: string[];

    if (currentAttached.includes(archiveId)) {
      newAttached = currentAttached.filter(id => id !== archiveId);
    } else {
      newAttached = [...currentAttached, archiveId];
    }

    onUpdateProject({
      ...project,
      attachedArchiveIds: newAttached
    });
  };

  const detachArchive = (archiveId: string) => {
    const newAttached = (project.attachedArchiveIds || []).filter(id => id !== archiveId);
    onUpdateProject({
      ...project,
      attachedArchiveIds: newAttached
    });
  };

  const perspective = getCurrentPerspective();

  return (
    <div className={`max-w-7xl mx-auto space-y-6 ${isDocPanelOpen ? 'mr-80' : ''} transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
          <ArrowLeft className="text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-serif font-bold text-legal-900">{project.name}</h2>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${project.userSide === Role.Petitioner ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
              {project.userSide}
            </span>
            {project.analysisStatus === 'analyzing' && (
              <span className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                <RefreshCw size={12} className="animate-spin" /> Analyzing
              </span>
            )}
            {project.analysisStatus === 'error' && (
              <span className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                <AlertTriangle size={12} /> Analysis Failed
              </span>
            )}
          </div>
          <p className="text-legal-500 text-sm">{project.caseTitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('tabs')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                viewMode === 'tabs' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Tabbed View"
            >
              <FileText size={14} />
              Tabs
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                viewMode === 'comparison' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Side-by-side Comparison"
            >
              <Columns size={14} />
              Compare
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                viewMode === 'timeline' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Timeline View"
            >
              <Clock size={14} />
              Timeline
            </button>
          </div>
          <button
            onClick={() => setIsDocPanelOpen(!isDocPanelOpen)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${isDocPanelOpen ? 'bg-legal-900 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            <FolderOpen size={16} />
            Documents ({project.files.length})
          </button>
          <button
            onClick={openArchiveModal}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
              attachedArchives.length > 0
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
            title="Attach case law archives for AI reference"
          >
            <Archive size={16} />
            Archives ({attachedArchives.length})
          </button>
          <button
            onClick={generatePerspectivesDocByDoc}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isAnalyzing ? 'animate-spin' : ''} />
            Regenerate
          </button>
          <button
            onClick={handleExportPDF}
            disabled={project.analysisStatus !== 'completed'}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indiaGreen hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
            title="Export Case Brief as PDF"
          >
            <Download size={16} />
            Export PDF
          </button>
          <button
            onClick={onProceedToHearings}
            disabled={project.analysisStatus !== 'completed'}
            className="flex items-center gap-2 px-5 py-2.5 bg-saffron hover:bg-orange-500 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50"
          >
            <Gavel size={18} />
            Proceed to Hearings
          </button>
        </div>
      </div>

      {/* Analysis Progress */}
      {isAnalyzing && analysisProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">{analysisProgress}</p>
              {analysisStep && (
                <div className="mt-2">
                  <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${(analysisStep.current / analysisStep.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Document {analysisStep.current} of {analysisStep.total}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attached Archives Display */}
      {attachedArchives.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Archive size={16} className="text-purple-600" />
            <span className="text-sm font-medium text-purple-800">Attached Archives ({attachedArchives.length})</span>
            <span className="text-xs text-purple-600">- AI agents can reference these case laws</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {attachedArchives.map(archive => (
              <div
                key={archive.id}
                className="flex items-center gap-2 bg-white border border-purple-200 rounded-lg px-3 py-1.5"
              >
                <Link2 size={12} className="text-purple-500" />
                <span className="text-sm text-purple-800">{archive.name}</span>
                <span className="text-xs text-purple-500">({archive.documentCount} docs)</span>
                <button
                  onClick={() => detachArchive(archive.id)}
                  className="ml-1 p-0.5 text-purple-400 hover:text-red-500 hover:bg-red-50 rounded"
                  title="Detach archive"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {project.analysisStatus === 'error' && project.analysisError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Analysis Failed</p>
              <p className="text-sm text-red-600 mt-1">{project.analysisError}</p>
              <button
                onClick={generatePerspectivesDocByDoc}
                className="mt-3 text-sm text-red-700 hover:text-red-800 font-medium flex items-center gap-1"
              >
                <RefreshCw size={14} /> Retry Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison View */}
      {viewMode === 'comparison' && (
        <ComparisonView
          petitionerPerspective={project.petitionerPerspective}
          respondentPerspective={project.respondentPerspective}
          disputedFacts={project.disputedFacts}
          onClose={() => setViewMode('tabs')}
        />
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <TimelineVisualization
          petitionerPerspective={project.petitionerPerspective}
          respondentPerspective={project.respondentPerspective}
        />
      )}

      {/* Perspective Tabs (default view) */}
      {viewMode === 'tabs' && (
      <div ref={printContentRef} className="bg-white rounded-xl shadow-sm border border-legal-100">
        <div className="flex border-b border-legal-100">
          <button
            onClick={() => setActiveTab('petitioner')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'petitioner' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Petitioner's Perspective
            {project.userSide === Role.Petitioner && <span className="ml-2 text-xs bg-blue-200 px-2 py-0.5 rounded">Your Side</span>}
          </button>
          <button
            onClick={() => setActiveTab('respondent')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'respondent' ? 'bg-red-50 text-red-700 border-b-2 border-red-500' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Respondent's Perspective
            {project.userSide === Role.Respondent && <span className="ml-2 text-xs bg-red-200 px-2 py-0.5 rounded">Your Side</span>}
          </button>
        </div>

        {isAnalyzing || project.analysisStatus === 'analyzing' ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw size={32} className="animate-spin mx-auto mb-4 text-saffron" />
            <p>Analyzing case documents...</p>
            <p className="text-sm mt-2">Documents are being analyzed one by one for thorough extraction</p>
          </div>
        ) : project.analysisStatus === 'error' ? (
          <div className="p-12 text-center">
            <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
            <p className="text-lg font-medium text-red-700">Analysis Failed</p>
            <p className="text-sm text-red-600 mt-2 max-w-md mx-auto">
              {project.analysisError || 'An error occurred during analysis. Please check your API key and try again.'}
            </p>
            <button
              onClick={generatePerspectivesDocByDoc}
              className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
              Retry Analysis
            </button>
          </div>
        ) : !perspective ? (
          <div className="p-12 text-center text-gray-500">
            <AlertTriangle size={32} className="mx-auto mb-4 text-yellow-500" />
            <p>Perspective analysis not available</p>
            <button onClick={generatePerspectivesDocByDoc} className="mt-4 text-saffron hover:underline">
              Generate Analysis
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Chronology */}
            <div className="border border-gray-200 rounded-lg">
              <button onClick={() => toggleSection('chronology')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-gray-500" />
                  <span className="font-medium">Chronology of Events</span>
                  <span className="text-xs text-gray-400">({perspective.chronology.length} events)</span>
                  {perspective.isEdited && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Edited</span>}
                </div>
                {expandedSections.chronology ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedSections.chronology && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Edit Mode */}
                  {isEditingChronology ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-800">Drag to reorder, or use arrows. Edit, add, or remove events. Save to update the case analysis.</p>
                        {isSavingChronology && (
                          <span className="text-xs text-blue-600 flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" /> {analysisProgress || 'Saving...'}
                          </span>
                        )}
                      </div>

                      {editableChronology.map((event, index) => (
                        <div
                          key={event.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          className={`flex gap-2 p-3 bg-gray-50 rounded-lg border transition-all duration-200 cursor-move ${
                            dragOverIndex === index
                              ? 'border-saffron border-2 bg-saffron/5'
                              : draggedIndex === index
                              ? 'border-blue-400 border-2'
                              : 'border-gray-200'
                          }`}
                        >
                          {/* Drag Handle and Order Controls */}
                          <div className="flex flex-col items-center gap-1">
                            {/* Drag Handle */}
                            <div className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600">
                              <GripVertical size={16} />
                            </div>
                            <button
                              onClick={() => moveChronologyEvent(index, 'up')}
                              disabled={index === 0}
                              className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                              title="Move up"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <div className="w-6 h-6 bg-white border border-gray-300 rounded flex items-center justify-center text-xs font-bold text-gray-500">
                              {index + 1}
                            </div>
                            <button
                              onClick={() => moveChronologyEvent(index, 'down')}
                              disabled={index === editableChronology.length - 1}
                              className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                              title="Move down"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={event.date || ''}
                              onChange={(e) => updateChronologyEvent(index, 'date', e.target.value)}
                              placeholder="Date (e.g., 15 March 2024)"
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-saffron outline-none"
                            />
                            <textarea
                              value={event.description}
                              onChange={(e) => updateChronologyEvent(index, 'description', e.target.value)}
                              placeholder="Description of the event"
                              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-saffron outline-none resize-none"
                              rows={2}
                            />
                            <textarea
                              value={event.significance}
                              onChange={(e) => updateChronologyEvent(index, 'significance', e.target.value)}
                              placeholder="Legal significance"
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-saffron outline-none resize-none italic"
                              rows={1}
                            />
                            <input
                              type="text"
                              value={event.source || ''}
                              onChange={(e) => updateChronologyEvent(index, 'source', e.target.value)}
                              placeholder="Source document"
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-saffron outline-none"
                            />
                          </div>
                          <button
                            onClick={() => deleteChronologyEvent(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded self-start"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}

                      <button
                        onClick={addChronologyEvent}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-saffron hover:text-saffron flex items-center justify-center gap-2 transition-colors"
                      >
                        <Plus size={16} /> Add Event
                      </button>

                      <div className="flex gap-2 pt-2 border-t border-gray-200">
                        <button
                          onClick={saveChronologyAndReanalyze}
                          disabled={isSavingChronology}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-saffron hover:bg-orange-500 text-white rounded-lg font-medium disabled:opacity-50"
                        >
                          {isSavingChronology ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                          Save & Re-analyze Case
                        </button>
                        <button
                          onClick={saveChronologyWithoutReanalyze}
                          disabled={isSavingChronology}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                          <Save size={16} /> Save Only
                        </button>
                        <button
                          onClick={cancelChronologyEdit}
                          disabled={isSavingChronology}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <>
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={startEditingChronology}
                          className="text-xs text-gray-500 hover:text-saffron flex items-center gap-1"
                        >
                          <Edit3 size={12} /> Edit Chronology
                        </button>
                      </div>
                      {perspective.chronology.map((event, index) => (
                        <div key={event.id} className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0 w-8 h-8 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            {event.date && <p className="text-xs text-gray-400 mb-1">{event.date}</p>}
                            <p className="text-sm text-gray-800">{event.description}</p>
                            <p className="text-xs text-gray-500 mt-1 italic">{event.significance}</p>
                            {event.source && <p className="text-xs text-blue-500 mt-1">Source: {event.source}</p>}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Key Facts */}
            <div className="border border-gray-200 rounded-lg">
              <button onClick={() => toggleSection('keyFacts')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <Target size={18} className="text-gray-500" />
                  <span className="font-medium">Key Facts</span>
                  <span className="text-xs text-gray-400">({perspective.keyFacts.length} facts)</span>
                </div>
                {expandedSections.keyFacts ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedSections.keyFacts && (
                <div className="px-4 pb-4 space-y-2">
                  {perspective.keyFacts.map((fact, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 group">
                      <span className="text-saffron mt-1">•</span>
                      {editingField === `fact-${index}` ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                            autoFocus
                          />
                          <button onClick={() => saveEditedFact(index)} className="text-green-600 hover:text-green-700">
                            <Save size={16} />
                          </button>
                          <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-700">{fact}</span>
                          <button
                            onClick={() => startEditingFact(index, fact)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"
                          >
                            <Edit3 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evidences */}
            <div className="border border-gray-200 rounded-lg">
              <button onClick={() => toggleSection('evidences')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <Briefcase size={18} className="text-gray-500" />
                  <span className="font-medium">Evidence</span>
                  <span className="text-xs text-gray-400">({perspective.evidences?.length || 0} items)</span>
                </div>
                {expandedSections.evidences ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedSections.evidences && (
                <div className="px-4 pb-4 space-y-3">
                  {perspective.evidences && perspective.evidences.length > 0 ? (
                    perspective.evidences.map((evidence) => (
                      <div key={evidence.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm text-gray-800">{evidence.title}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded ${getEvidenceTypeBadgeColor(evidence.type)}`}>
                            {evidence.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{evidence.description}</p>
                        <p className="text-xs text-blue-600 mb-1">Relevance: {evidence.relevance}</p>
                        {evidence.supportingQuote && (
                          <p className="text-xs text-gray-500 italic border-l-2 border-gray-300 pl-2 mt-2">
                            "{evidence.supportingQuote}"
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">Source: {evidence.sourceDocument}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No evidence items extracted yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Legal Theory */}
            <div className="border border-gray-200 rounded-lg">
              <button onClick={() => toggleSection('theory')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
                <span className="font-medium">Legal Theory</span>
                {expandedSections.theory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedSections.theory && (
                <div className="px-4 pb-4">
                  {editingField === 'theory' ? (
                    <div className="space-y-2">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full px-3 py-2 border rounded text-sm h-32"
                      />
                      <div className="flex gap-2">
                        <button onClick={saveLegalTheory} className="px-3 py-1 bg-green-600 text-white text-sm rounded">Save</button>
                        <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-gray-200 text-sm rounded">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="group">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{perspective.legalTheory}</p>
                      <button
                        onClick={() => { setEditingField('theory'); setEditValue(perspective.legalTheory); }}
                        className="mt-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                      >
                        <Edit3 size={12} /> Edit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-green-200 rounded-lg bg-green-50/50">
                <button onClick={() => toggleSection('strengths')} className="w-full flex items-center justify-between p-3 hover:bg-green-50">
                  <span className="font-medium text-green-700 flex items-center gap-2">
                    <CheckCircle size={16} /> Strengths
                  </span>
                  {expandedSections.strengths ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSections.strengths && (
                  <ul className="px-4 pb-4 space-y-1">
                    {perspective.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                        <span className="text-green-500">+</span> {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border border-red-200 rounded-lg bg-red-50/50">
                <button onClick={() => toggleSection('weaknesses')} className="w-full flex items-center justify-between p-3 hover:bg-red-50">
                  <span className="font-medium text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} /> Weaknesses
                  </span>
                  {expandedSections.weaknesses ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSections.weaknesses && (
                  <ul className="px-4 pb-4 space-y-1">
                    {perspective.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-red-800 flex items-start gap-2">
                        <span className="text-red-500">-</span> {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Chat with Agent */}
            <div className="border border-gray-200 rounded-lg">
              <button onClick={() => toggleSection('chat')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-gray-500" />
                  <span className="font-medium">Chat with {activeTab === 'petitioner' ? 'Petitioner' : 'Respondent'} Agent</span>
                  {perspective.chatHistory && perspective.chatHistory.length > 0 && (
                    <span className="text-xs text-gray-400">({perspective.chatHistory.length} messages)</span>
                  )}
                </div>
                {expandedSections.chat ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedSections.chat && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-gray-500 mb-3">
                    Ask the {activeTab} agent to update, revise, or add information. You can also attach documents for the agent to analyze.
                  </p>

                  {/* Chat History */}
                  {perspective.chatHistory && perspective.chatHistory.length > 0 && (
                    <div className="mb-4 max-h-64 overflow-y-auto space-y-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
                      {perspective.chatHistory.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 ${
                              msg.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white border border-gray-200'
                            }`}
                          >
                            <p className="text-sm">{msg.text}</p>
                            {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200/50">
                                <p className="text-xs opacity-75">Attached: {msg.attachedFiles.map(f => f.name).join(', ')}</p>
                              </div>
                            )}
                            {msg.updatesApplied && msg.updatesApplied.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-xs font-medium text-green-600">Updates Applied:</p>
                                <ul className="text-xs text-gray-600 mt-1">
                                  {msg.updatesApplied.map((update, i) => (
                                    <li key={i}>• {update}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <p className="text-xs opacity-60 mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  {/* Attachments Preview */}
                  {chatAttachments.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {chatAttachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                          <Paperclip size={12} />
                          <span className="max-w-24 truncate">{file.name}</span>
                          <button onClick={() => removeChatAttachment(i)} className="text-blue-500 hover:text-blue-700">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Chat Input */}
                  <div className="flex gap-2">
                    <input
                      ref={chatFileInputRef}
                      type="file"
                      multiple
                      accept=".txt,.pdf,.docx"
                      onChange={handleChatFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={isChatting || isUploadingChatFiles}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                      title="Attach files"
                    >
                      {isUploadingChatFiles ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Upload size={16} className="text-gray-600" />
                      )}
                    </button>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                      placeholder="e.g., You missed the FIR date mentioned in document 2..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron focus:border-transparent outline-none text-sm"
                      disabled={isChatting}
                    />
                    <button
                      onClick={handleSendChatMessage}
                      disabled={(!chatInput.trim() && chatAttachments.length === 0) || isChatting}
                      className="px-4 py-2 bg-saffron hover:bg-orange-500 text-white rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {isChatting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Archive Selection Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Attach Archives</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Select case law archives for AI agents to reference during analysis
                </p>
              </div>
              <button
                onClick={() => setShowArchiveModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingArchives ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-purple-600" />
                  <span className="ml-2 text-gray-600">Loading archives...</span>
                </div>
              ) : availableArchives.length === 0 ? (
                <div className="text-center py-8">
                  <Archive size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">No archives available</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Create archives from the Archives section in the sidebar
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableArchives.map(archive => {
                    const isAttached = isArchiveAttached(archive.id);
                    return (
                      <div
                        key={archive.id}
                        onClick={() => toggleArchiveAttachment(archive.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isAttached
                            ? 'border-purple-400 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isAttached
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300'
                          }`}>
                            {isAttached && (
                              <CheckCircle size={14} className="text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900">{archive.name}</h4>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                {archive.documentCount} documents
                              </span>
                            </div>
                            {archive.description && (
                              <p className="text-sm text-gray-600 mt-1">{archive.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              Updated {new Date(archive.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <span className="text-sm text-gray-600">
                {(project.attachedArchiveIds || []).length} archive(s) attached
              </span>
              <button
                onClick={() => setShowArchiveModal(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Panel */}
      <DocumentPanel
        project={project}
        onUpdateProject={onUpdateProject}
        isOpen={isDocPanelOpen}
        onToggle={() => setIsDocPanelOpen(!isDocPanelOpen)}
      />
    </div>
  );
};

export default ProjectView;
