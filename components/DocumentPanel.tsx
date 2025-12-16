import React, { useState, useCallback } from 'react';
import { FileText, Plus, Trash2, Edit3, X, Upload, ChevronDown, ChevronUp, Calendar, User, Building, Save, FolderOpen, Sparkles, BookOpen, Scale, AlertCircle, Quote, RefreshCw, AlertTriangle, Copy, Link, GitBranch } from 'lucide-react';
import { CaseFile, DocumentCategory, DocumentMetadata, Project, DocumentDeepAnalysis } from '../types';
import { processFiles, ProcessFilesResult } from '../utils/fileProcessor';
import { extractDocumentMetadata } from '../services/geminiService';
import { checkBatchForDuplicates, DuplicateCheckResult, getDuplicateSummary, suggestAction } from '../utils/duplicateDetector';
import DocumentRelationshipView from './DocumentRelationshipView';

interface DocumentPanelProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  [DocumentCategory.FIR]: 'bg-red-100 text-red-700',
  [DocumentCategory.Affidavit]: 'bg-blue-100 text-blue-700',
  [DocumentCategory.Evidence]: 'bg-green-100 text-green-700',
  [DocumentCategory.CourtProceeding]: 'bg-purple-100 text-purple-700',
  [DocumentCategory.CourtOrder]: 'bg-yellow-100 text-yellow-700',
  [DocumentCategory.Judgment]: 'bg-orange-100 text-orange-700',
  [DocumentCategory.Petition]: 'bg-indigo-100 text-indigo-700',
  [DocumentCategory.Reply]: 'bg-pink-100 text-pink-700',
  [DocumentCategory.Witness]: 'bg-teal-100 text-teal-700',
  [DocumentCategory.ChargeSheet]: 'bg-rose-100 text-rose-700',
  [DocumentCategory.MedicalReport]: 'bg-cyan-100 text-cyan-700',
  [DocumentCategory.ForensicReport]: 'bg-emerald-100 text-emerald-700',
  [DocumentCategory.LegalOpinion]: 'bg-violet-100 text-violet-700',
  [DocumentCategory.Other]: 'bg-gray-100 text-gray-700',
};

// Duplicate check pending files interface
interface PendingFileWithDuplicateCheck {
  file: { id: string; name: string; type: string; content: string };
  duplicateResult: DuplicateCheckResult;
  action: 'skip' | 'rename' | 'add_anyway' | 'pending';
}

// Progress tracking with ETA
interface UploadProgressState {
  status: string;
  current: number;
  total: number;
  percentage: number;
  startTime: number;
  estimatedTimeRemaining: string;
  currentFileName: string;
  fileStatuses: Map<string, 'pending' | 'processing' | 'success' | 'error'>;
}

// Helper to format time remaining
const formatTimeRemaining = (ms: number): string => {
  if (ms < 0 || !isFinite(ms)) return 'Calculating...';
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `~${seconds}s remaining`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `~${minutes}m ${remainingSeconds}s remaining`;
};

const DocumentPanel: React.FC<DocumentPanelProps> = ({ project, onUpdateProject, isOpen, onToggle }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editMetadata, setEditMetadata] = useState<DocumentMetadata | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<DocumentCategory | 'all'>('all');
  const [showDeepAnalysis, setShowDeepAnalysis] = useState<string | null>(null);
  const [reanalyzingDocId, setReanalyzingDocId] = useState<string | null>(null);

  // Enhanced progress state with ETA
  const [progressState, setProgressState] = useState<UploadProgressState | null>(null);

  // Duplicate detection state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingFilesWithDuplicates, setPendingFilesWithDuplicates] = useState<PendingFileWithDuplicateCheck[]>([]);
  const [duplicateCheckComplete, setDuplicateCheckComplete] = useState(false);

  // Document relationships state
  const [showRelationshipsModal, setShowRelationshipsModal] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsUploading(true);
    setUploadProgress('Processing files...');
    try {
      // Use progress callback to show OCR progress
      const result: ProcessFilesResult = await processFiles(
        e.target.files,
        (status, current, total) => {
          setUploadProgress(`${status} (${current}/${total})`);
        }
      );

      if (result.failedFiles.length > 0) {
        alert(`Could not process: ${result.failedFiles.join(', ')}`);
      }

      if (result.files.length === 0) {
        setUploadProgress('');
        setIsUploading(false);
        return;
      }

      // Check for duplicates before adding
      setUploadProgress('Checking for duplicates...');
      const duplicateResults = await checkBatchForDuplicates(
        result.files.map(f => ({ content: f.content, fileName: f.name })),
        project.files,
        (current, total, fileName) => {
          setUploadProgress(`Checking duplicates: ${fileName} (${current}/${total})`);
        }
      );

      // Check if any files have duplicates or high similarity
      const filesWithDuplicateInfo: PendingFileWithDuplicateCheck[] = result.files.map(file => {
        const duplicateResult = duplicateResults.get(file.name) || {
          isDuplicate: false,
          isHighSimilarity: false,
          similarDocuments: []
        };
        const suggestedAction = suggestAction(duplicateResult);

        return {
          file,
          duplicateResult,
          action: duplicateResult.isDuplicate || duplicateResult.isHighSimilarity ? 'pending' : 'add_anyway'
        };
      });

      // Check if any need user decision
      const needsUserDecision = filesWithDuplicateInfo.some(
        f => f.duplicateResult.isDuplicate || f.duplicateResult.isHighSimilarity
      );

      if (needsUserDecision) {
        // Show modal for user to decide
        setPendingFilesWithDuplicates(filesWithDuplicateInfo);
        setShowDuplicateModal(true);
        setDuplicateCheckComplete(false);
        setIsUploading(false);
        setUploadProgress('');
        e.target.value = '';
        return;
      }

      // No duplicates, proceed normally
      await processAndAddFiles(filesWithDuplicateInfo.map(f => f.file));
      e.target.value = '';
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload files. Please check your API key and try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  // Process and add files after duplicate check resolution
  const processAndAddFiles = async (files: Array<{ id: string; name: string; type: string; content: string }>) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress('Adding files...');

    // Initialize progress state with ETA tracking
    const startTime = Date.now();
    const fileStatuses = new Map<string, 'pending' | 'processing' | 'success' | 'error'>();
    files.forEach(f => fileStatuses.set(f.id, 'pending'));

    setProgressState({
      status: 'Adding files...',
      current: 0,
      total: files.length,
      percentage: 0,
      startTime,
      estimatedTimeRemaining: 'Calculating...',
      currentFileName: '',
      fileStatuses: new Map(fileStatuses)
    });

    try {
      // Create initial files
      const initialFiles: CaseFile[] = files.map(f => ({
        ...f,
        uploadedAt: Date.now(),
        metadata: {
          category: DocumentCategory.Other,
        }
      }));

      // Add files immediately so user sees them
      const updatedFiles = [...project.files, ...initialFiles];
      onUpdateProject({
        ...project,
        files: updatedFiles
      });

      // Now extract metadata with AI - track time per file for ETA
      const allResults: { id: string; metadata: DocumentMetadata; suggestedName?: string }[] = [];
      const timePerFile: number[] = [];

      for (let i = 0; i < initialFiles.length; i++) {
        const file = initialFiles[i];
        const fileStartTime = Date.now();

        // Update status to processing
        fileStatuses.set(file.id, 'processing');

        // Calculate ETA based on average time per file
        let etaMs = 0;
        if (timePerFile.length > 0) {
          const avgTimePerFile = timePerFile.reduce((a, b) => a + b, 0) / timePerFile.length;
          etaMs = avgTimePerFile * (initialFiles.length - i);
        }

        setProgressState({
          status: 'AI analyzing documents...',
          current: i + 1,
          total: initialFiles.length,
          percentage: Math.round(((i + 1) / initialFiles.length) * 100),
          startTime,
          estimatedTimeRemaining: formatTimeRemaining(etaMs),
          currentFileName: file.name,
          fileStatuses: new Map(fileStatuses)
        });

        setUploadProgress(`Analyzing ${i + 1}/${initialFiles.length}: ${file.name}`);

        try {
          const metadata = await extractDocumentMetadata(file.name, file.content);
          allResults.push({ id: file.id, metadata, suggestedName: metadata.suggestedName });
          fileStatuses.set(file.id, 'success');
        } catch (err) {
          console.error(`Failed to extract metadata for ${file.name}:`, err);
          allResults.push({ id: file.id, metadata: { category: DocumentCategory.Other } as DocumentMetadata, suggestedName: file.name });
          fileStatuses.set(file.id, 'error');
        }

        // Track time taken for this file
        const fileTime = Date.now() - fileStartTime;
        timePerFile.push(fileTime);

        // Update progress after each file
        setProgressState(prev => prev ? {
          ...prev,
          current: i + 1,
          percentage: Math.round(((i + 1) / initialFiles.length) * 100),
          fileStatuses: new Map(fileStatuses),
          estimatedTimeRemaining: i < initialFiles.length - 1
            ? formatTimeRemaining((timePerFile.reduce((a, b) => a + b, 0) / timePerFile.length) * (initialFiles.length - i - 1))
            : 'Almost done...'
        } : null);
      }

      // Update files with extracted metadata and suggested names
      const filesWithMetadata = updatedFiles.map(f => {
        const result = allResults.find(r => r.id === f.id);
        if (result) {
          return {
            ...f,
            name: result.suggestedName || f.name, // Use AI suggested name
            metadata: result.metadata
          };
        }
        return f;
      });

      onUpdateProject({
        ...project,
        files: filesWithMetadata
      });

      setUploadProgress('');
      setProgressState(null);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload files. Please check your API key and try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      setProgressState(null);
    }
  };

  // Handle duplicate modal decision
  const handleDuplicateDecision = useCallback((fileName: string, action: 'skip' | 'rename' | 'add_anyway') => {
    setPendingFilesWithDuplicates(prev =>
      prev.map(f =>
        f.file.name === fileName ? { ...f, action } : f
      )
    );
  }, []);

  // Process files after duplicate modal is confirmed
  const handleDuplicateModalConfirm = useCallback(async () => {
    const filesToAdd = pendingFilesWithDuplicates
      .filter(f => f.action === 'add_anyway' || f.action === 'rename')
      .map(f => {
        if (f.action === 'rename') {
          // Add suffix to avoid name collision
          const nameParts = f.file.name.split('.');
          const ext = nameParts.length > 1 ? nameParts.pop() : '';
          const baseName = nameParts.join('.');
          return {
            ...f.file,
            name: `${baseName}_copy${ext ? '.' + ext : ''}`
          };
        }
        return f.file;
      });

    setShowDuplicateModal(false);
    setPendingFilesWithDuplicates([]);

    if (filesToAdd.length > 0) {
      await processAndAddFiles(filesToAdd);
    }
  }, [pendingFilesWithDuplicates]);

  // Cancel duplicate modal
  const handleDuplicateModalCancel = useCallback(() => {
    setShowDuplicateModal(false);
    setPendingFilesWithDuplicates([]);
  }, []);

  // Re-analyze a single document
  const handleReanalyzeDocument = async (doc: CaseFile) => {
    setReanalyzingDocId(doc.id);
    try {
      const metadata = await extractDocumentMetadata(doc.name, doc.content);
      onUpdateProject({
        ...project,
        files: project.files.map(f =>
          f.id === doc.id ? { ...f, name: metadata.suggestedName || f.name, metadata } : f
        )
      });
    } catch (err) {
      alert('Failed to re-analyze document');
    } finally {
      setReanalyzingDocId(null);
    }
  };

  const handleDeleteDocument = (docId: string) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;

    onUpdateProject({
      ...project,
      files: project.files.filter(f => f.id !== docId)
    });
  };

  const startEditMetadata = (doc: CaseFile) => {
    setEditingDocId(doc.id);
    setEditMetadata(doc.metadata || { category: DocumentCategory.Other });
  };

  const saveMetadata = () => {
    if (!editingDocId || !editMetadata) return;

    onUpdateProject({
      ...project,
      files: project.files.map(f =>
        f.id === editingDocId ? { ...f, metadata: editMetadata } : f
      )
    });

    setEditingDocId(null);
    setEditMetadata(null);
  };

  const cancelEdit = () => {
    setEditingDocId(null);
    setEditMetadata(null);
  };

  const filteredFiles = filterCategory === 'all'
    ? project.files
    : project.files.filter(f => f.metadata?.category === filterCategory);

  const groupedByCategory = project.files.reduce((acc, file) => {
    const cat = file.metadata?.category || DocumentCategory.Other;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(file);
    return acc;
  }, {} as Record<DocumentCategory, CaseFile[]>);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-legal-900 text-white p-3 rounded-l-lg shadow-lg hover:bg-legal-800 transition-colors z-30"
        title="Open Documents Panel"
      >
        <FolderOpen size={20} />
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-legal-200 shadow-xl z-30 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-legal-100 bg-legal-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold text-legal-900 flex items-center gap-2">
            <FileText size={18} />
            Case Documents
          </h3>
          <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Upload Button */}
        <div className="relative">
          <input
            type="file"
            id="doc-panel-upload"
            multiple
            accept=".txt,.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp,.bmp,image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          {!isUploading ? (
            <label
              htmlFor="doc-panel-upload"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg transition-colors text-sm font-medium bg-saffron hover:bg-orange-500 cursor-pointer text-white"
            >
              <Upload size={16} />
              Add Documents
            </label>
          ) : (
            <div className="space-y-2">
              {/* Enhanced Progress UI */}
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <span className="flex items-center gap-1">
                    <Sparkles size={12} className="animate-spin text-saffron" />
                    {progressState?.status || uploadProgress || 'Processing...'}
                  </span>
                  {progressState && (
                    <span className="font-medium">
                      {progressState.current}/{progressState.total}
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-saffron to-orange-500 rounded-full transition-all duration-300"
                    style={{ width: `${progressState?.percentage || 0}%` }}
                  />
                </div>

                {/* Current File & ETA */}
                <div className="flex items-center justify-between text-[10px]">
                  {progressState?.currentFileName && (
                    <span className="text-gray-500 truncate max-w-[60%]">
                      {progressState.currentFileName}
                    </span>
                  )}
                  {progressState?.estimatedTimeRemaining && (
                    <span className="text-gray-400">
                      {progressState.estimatedTimeRemaining}
                    </span>
                  )}
                </div>

                {/* File Status Indicators */}
                {progressState && progressState.fileStatuses.size > 1 && progressState.fileStatuses.size <= 10 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {Array.from(progressState.fileStatuses.entries()).map(([id, status], index) => (
                      <div
                        key={id}
                        className={`w-3 h-3 rounded-full flex items-center justify-center transition-colors ${
                          status === 'pending' ? 'bg-gray-300' :
                          status === 'processing' ? 'bg-saffron animate-pulse' :
                          status === 'success' ? 'bg-green-500' :
                          'bg-red-500'
                        }`}
                        title={`File ${index + 1}: ${status}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filter and Relationships */}
        <div className="mt-3 space-y-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as DocumentCategory | 'all')}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-saffron outline-none"
          >
            <option value="all">All Categories ({project.files.length})</option>
            {Object.values(DocumentCategory).map(cat => {
              const count = groupedByCategory[cat]?.length || 0;
              return count > 0 ? (
                <option key={cat} value={cat}>{cat} ({count})</option>
              ) : null;
            })}
          </select>

          {/* Document Relationships Button */}
          <button
            onClick={() => setShowRelationshipsModal(true)}
            className="flex items-center justify-center gap-2 w-full py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <GitBranch size={14} />
            Document Relationships
            {project.documentRelationships && project.documentRelationships.length > 0 && (
              <span className="px-1.5 py-0.5 bg-saffron/10 text-saffron rounded-full text-[10px]">
                {project.documentRelationships.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredFiles.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No documents uploaded yet
          </div>
        ) : (
          filteredFiles.map(doc => (
            <div
              key={doc.id}
              className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden"
            >
              {/* Document Header */}
              <div
                className="p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[doc.metadata?.category || DocumentCategory.Other]}`}>
                        {doc.metadata?.category || 'Uncategorized'}
                      </span>
                      {doc.metadata?.date && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Calendar size={10} /> {doc.metadata.date}
                        </span>
                      )}
                    </div>
                  </div>
                  {expandedDocId === doc.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedDocId === doc.id && (
                <div className="px-3 pb-3 border-t border-gray-100 bg-white">
                  {editingDocId === doc.id && editMetadata ? (
                    // Edit Mode
                    <div className="pt-3 space-y-3">
                      <div>
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Category *</label>
                        <select
                          value={editMetadata.category}
                          onChange={(e) => setEditMetadata({ ...editMetadata, category: e.target.value as DocumentCategory })}
                          className="w-full mt-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-saffron outline-none"
                        >
                          {Object.values(DocumentCategory).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Document Date</label>
                        <input
                          type="text"
                          value={editMetadata.date || ''}
                          onChange={(e) => setEditMetadata({ ...editMetadata, date: e.target.value })}
                          placeholder="e.g., 15 March 2024"
                          className="w-full mt-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-saffron outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Filed By</label>
                        <input
                          type="text"
                          value={editMetadata.filedBy || ''}
                          onChange={(e) => setEditMetadata({ ...editMetadata, filedBy: e.target.value })}
                          placeholder="e.g., Petitioner, Respondent No. 2"
                          className="w-full mt-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-saffron outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Court Name</label>
                        <input
                          type="text"
                          value={editMetadata.courtName || ''}
                          onChange={(e) => setEditMetadata({ ...editMetadata, courtName: e.target.value })}
                          placeholder="e.g., Delhi High Court"
                          className="w-full mt-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-saffron outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Description</label>
                        <textarea
                          value={editMetadata.description || ''}
                          onChange={(e) => setEditMetadata({ ...editMetadata, description: e.target.value })}
                          placeholder="What does this document contain?"
                          className="w-full mt-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-saffron outline-none h-16 resize-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Context Notes (for AI)</label>
                        <textarea
                          value={editMetadata.contextNotes || ''}
                          onChange={(e) => setEditMetadata({ ...editMetadata, contextNotes: e.target.value })}
                          placeholder="Important context for AI analysis, e.g., 'This is a court order recording submissions, not rulings'"
                          className="w-full mt-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-saffron outline-none h-20 resize-none"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={saveMetadata}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          <Save size={12} /> Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex-1 py-1.5 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="pt-3 space-y-2 text-xs">
                      {doc.metadata?.filedBy && (
                        <p className="flex items-center gap-1 text-gray-600">
                          <User size={12} className="text-gray-400" />
                          Filed by: {doc.metadata.filedBy}
                        </p>
                      )}
                      {doc.metadata?.courtName && (
                        <p className="flex items-center gap-1 text-gray-600">
                          <Building size={12} className="text-gray-400" />
                          {doc.metadata.courtName}
                        </p>
                      )}
                      {doc.metadata?.caseNumber && (
                        <p className="flex items-center gap-1 text-gray-600">
                          <Scale size={12} className="text-gray-400" />
                          Case: {doc.metadata.caseNumber}
                        </p>
                      )}
                      {doc.metadata?.description && (
                        <p className="text-gray-600 italic">{doc.metadata.description}</p>
                      )}
                      {doc.metadata?.contextNotes && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-800">
                          <span className="font-medium">AI Context:</span> {doc.metadata.contextNotes}
                        </div>
                      )}

                      {/* Deep Analysis Section */}
                      {doc.metadata?.deepAnalysis && (
                        <div className="border-t border-gray-100 pt-2">
                          <button
                            onClick={() => setShowDeepAnalysis(showDeepAnalysis === doc.id ? null : doc.id)}
                            className="flex items-center gap-1 text-purple-600 hover:text-purple-800 font-medium"
                          >
                            <Sparkles size={12} />
                            {showDeepAnalysis === doc.id ? 'Hide' : 'View'} AI Deep Analysis
                            {showDeepAnalysis === doc.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>

                          {showDeepAnalysis === doc.id && (
                            <div className="mt-2 space-y-2 bg-purple-50 border border-purple-200 rounded p-2">
                              <div>
                                <span className="font-medium text-purple-800">Type:</span>{' '}
                                <span className="text-purple-700">{doc.metadata.deepAnalysis.documentType}</span>
                              </div>

                              <div>
                                <span className="font-medium text-purple-800">Summary:</span>
                                <p className="text-purple-700 mt-1">{doc.metadata.deepAnalysis.summary}</p>
                              </div>

                              {doc.metadata.deepAnalysis.keyPoints && doc.metadata.deepAnalysis.keyPoints.length > 0 && (
                                <div>
                                  <span className="font-medium text-purple-800 flex items-center gap-1">
                                    <BookOpen size={10} /> Key Points:
                                  </span>
                                  <ul className="mt-1 space-y-1 text-purple-700">
                                    {doc.metadata.deepAnalysis.keyPoints.map((point, i) => (
                                      <li key={i} className="flex items-start gap-1">
                                        <span className="text-purple-400 mt-1">•</span>
                                        {point}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {doc.metadata.deepAnalysis.legalSections && doc.metadata.deepAnalysis.legalSections.length > 0 && (
                                <div>
                                  <span className="font-medium text-purple-800 flex items-center gap-1">
                                    <Scale size={10} /> Legal Sections:
                                  </span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {doc.metadata.deepAnalysis.legalSections.map((section, i) => (
                                      <span key={i} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">
                                        {section}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {doc.metadata.deepAnalysis.reliefSought && (
                                <div>
                                  <span className="font-medium text-purple-800">Relief Sought:</span>
                                  <p className="text-purple-700 mt-1">{doc.metadata.deepAnalysis.reliefSought}</p>
                                </div>
                              )}

                              {doc.metadata.deepAnalysis.currentStatus && (
                                <div>
                                  <span className="font-medium text-purple-800">Current Status:</span>
                                  <p className="text-purple-700 mt-1">{doc.metadata.deepAnalysis.currentStatus}</p>
                                </div>
                              )}

                              {doc.metadata.deepAnalysis.importantQuotes && doc.metadata.deepAnalysis.importantQuotes.length > 0 && (
                                <div>
                                  <span className="font-medium text-purple-800 flex items-center gap-1">
                                    <Quote size={10} /> Important Quotes:
                                  </span>
                                  <div className="mt-1 space-y-1">
                                    {doc.metadata.deepAnalysis.importantQuotes.map((quote, i) => (
                                      <p key={i} className="text-purple-700 italic border-l-2 border-purple-300 pl-2">
                                        "{quote}"
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {doc.metadata.deepAnalysis.analysisNotes && (
                                <div className="bg-purple-100 rounded p-2">
                                  <span className="font-medium text-purple-800 flex items-center gap-1">
                                    <AlertCircle size={10} /> AI Analysis Notes:
                                  </span>
                                  <p className="text-purple-700 mt-1">{doc.metadata.deepAnalysis.analysisNotes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => startEditMetadata(doc)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleReanalyzeDocument(doc)}
                          disabled={reanalyzingDocId === doc.id}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded hover:bg-purple-200 disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={reanalyzingDocId === doc.id ? 'animate-spin' : ''} />
                          {reanalyzingDocId === doc.id ? 'AI...' : 'Re-analyze'}
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="px-3 py-1.5 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Summary */}
      <div className="p-3 border-t border-legal-100 bg-legal-50 text-xs text-gray-500">
        {project.files.length} document{project.files.length !== 1 ? 's' : ''} •{' '}
        {Object.keys(groupedByCategory).length} categor{Object.keys(groupedByCategory).length !== 1 ? 'ies' : 'y'}
      </div>

      {/* Duplicate Warning Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-yellow-500" size={24} />
                <h3 className="font-semibold text-lg">Duplicate Documents Detected</h3>
              </div>
              <button
                onClick={handleDuplicateModalCancel}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Some files you're uploading appear to be duplicates or very similar to existing documents.
                Choose how to handle each file:
              </p>

              {pendingFilesWithDuplicates.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    item.duplicateResult.exactMatch
                      ? 'bg-red-50 border-red-200'
                      : item.duplicateResult.isDuplicate
                      ? 'bg-yellow-50 border-yellow-200'
                      : item.duplicateResult.isHighSimilarity
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-sm truncate">{item.file.name}</span>
                      </div>

                      {item.duplicateResult.exactMatch && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                          <Copy size={12} />
                          <span>Exact duplicate of: <strong>{item.duplicateResult.exactMatch.documentName}</strong></span>
                        </div>
                      )}

                      {!item.duplicateResult.exactMatch && item.duplicateResult.similarDocuments.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <Link size={12} />
                            <span>Similar to:</span>
                          </div>
                          <ul className="mt-1 space-y-1 ml-4">
                            {item.duplicateResult.similarDocuments.slice(0, 3).map((sim, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="text-gray-500">{sim.documentName}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  sim.matchType === 'near_duplicate'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {Math.round(sim.similarityScore * 100)}% match
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleDuplicateDecision(item.file.name, 'skip')}
                        className={`px-3 py-1 text-xs rounded ${
                          item.action === 'skip'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => handleDuplicateDecision(item.file.name, 'rename')}
                        className={`px-3 py-1 text-xs rounded ${
                          item.action === 'rename'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Add as Copy
                      </button>
                      <button
                        onClick={() => handleDuplicateDecision(item.file.name, 'add_anyway')}
                        className={`px-3 py-1 text-xs rounded ${
                          item.action === 'add_anyway'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Add Anyway
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {pendingFilesWithDuplicates.filter(f => f.action === 'skip').length} to skip •{' '}
                {pendingFilesWithDuplicates.filter(f => f.action === 'add_anyway' || f.action === 'rename').length} to add •{' '}
                {pendingFilesWithDuplicates.filter(f => f.action === 'pending').length} pending
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDuplicateModalCancel}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDuplicateModalConfirm}
                  disabled={pendingFilesWithDuplicates.some(f => f.action === 'pending')}
                  className="px-4 py-2 text-sm bg-saffron text-white rounded-lg hover:bg-saffron/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Relationships Modal */}
      <DocumentRelationshipView
        project={project}
        onUpdateProject={onUpdateProject}
        isOpen={showRelationshipsModal}
        onClose={() => setShowRelationshipsModal(false)}
      />
    </div>
  );
};

export default DocumentPanel;
