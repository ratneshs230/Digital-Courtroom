import React, { useState, useEffect, useRef } from 'react';
import {
  Archive as ArchiveIcon,
  Plus,
  Trash2,
  FileText,
  Upload,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Edit3,
  Save,
  BookOpen,
  Scale,
  Building2,
  Calendar,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Archive, ArchiveDocument, ArchiveCategory } from '../types';
import {
  getAllArchives,
  saveArchive,
  deleteArchive,
  addDocumentToArchive,
  removeDocumentFromArchive
} from '../services/storageService';
import { processFiles } from '../utils/fileProcessor';

interface ArchivesPageProps {
  onBack?: () => void;
}

const ARCHIVE_CATEGORIES: { value: ArchiveCategory; label: string; icon: React.ReactNode }[] = [
  { value: ArchiveCategory.SupremeCourtJudgment, label: 'Supreme Court Judgment', icon: <Scale size={14} /> },
  { value: ArchiveCategory.HighCourtJudgment, label: 'High Court Judgment', icon: <Building2 size={14} /> },
  { value: ArchiveCategory.DistrictCourtJudgment, label: 'District Court Judgment', icon: <Building2 size={14} /> },
  { value: ArchiveCategory.TribunalOrder, label: 'Tribunal Order', icon: <FileText size={14} /> },
  { value: ArchiveCategory.CaseLaw, label: 'Case Law', icon: <BookOpen size={14} /> },
  { value: ArchiveCategory.StatutoryProvision, label: 'Statutory Provision', icon: <FileText size={14} /> },
  { value: ArchiveCategory.LegalArticle, label: 'Legal Article', icon: <FileText size={14} /> },
  { value: ArchiveCategory.CircularNotification, label: 'Circular/Notification', icon: <FileText size={14} /> },
  { value: ArchiveCategory.Other, label: 'Other', icon: <FileText size={14} /> },
];

const ArchivesPage: React.FC<ArchivesPageProps> = ({ onBack }) => {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<Archive | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<ArchiveDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showNewArchiveModal, setShowNewArchiveModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDocumentDetail, setShowDocumentDetail] = useState(false);

  // Form states
  const [newArchiveName, setNewArchiveName] = useState('');
  const [newArchiveDescription, setNewArchiveDescription] = useState('');

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document editing
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [editedDocument, setEditedDocument] = useState<Partial<ArchiveDocument>>({});

  // Load archives on mount
  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async () => {
    setIsLoading(true);
    try {
      const loaded = await getAllArchives();
      setArchives(loaded);
    } catch (error) {
      console.error('Failed to load archives:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateArchive = async () => {
    if (!newArchiveName.trim()) return;

    const newArchive: Archive = {
      id: Date.now().toString(),
      name: newArchiveName.trim(),
      description: newArchiveDescription.trim() || undefined,
      documents: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      documentCount: 0
    };

    await saveArchive(newArchive);
    setArchives([newArchive, ...archives]);
    setNewArchiveName('');
    setNewArchiveDescription('');
    setShowNewArchiveModal(false);
    setSelectedArchive(newArchive);
  };

  const handleDeleteArchive = async (archiveId: string) => {
    if (!confirm('Delete this archive and all its documents?')) return;

    await deleteArchive(archiveId);
    setArchives(archives.filter(a => a.id !== archiveId));
    if (selectedArchive?.id === archiveId) {
      setSelectedArchive(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedArchive) return;

    setIsUploading(true);
    setUploadProgress('Processing files...');

    try {
      const result = await processFiles(
        e.target.files,
        (status) => setUploadProgress(status)
      );

      if (result.files.length > 0) {
        // Create archive documents from processed files
        for (const file of result.files) {
          const newDoc: ArchiveDocument = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type,
            content: file.content,
            category: ArchiveCategory.Other,
            uploadedAt: Date.now()
          };

          await addDocumentToArchive(selectedArchive.id, newDoc);
        }

        // Refresh the selected archive
        const updated = await getAllArchives();
        setArchives(updated);
        setSelectedArchive(updated.find(a => a.id === selectedArchive.id) || null);
      }

      if (result.failedFiles.length > 0) {
        alert(`Some files failed to upload:\n${result.failedFiles.join('\n')}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload files');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      setShowUploadModal(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!selectedArchive || !confirm('Delete this document?')) return;

    await removeDocumentFromArchive(selectedArchive.id, docId);

    // Refresh
    const updated = await getAllArchives();
    setArchives(updated);
    setSelectedArchive(updated.find(a => a.id === selectedArchive.id) || null);
    setSelectedDocument(null);
    setShowDocumentDetail(false);
  };

  const handleSaveDocumentMetadata = async () => {
    if (!selectedArchive || !selectedDocument) return;

    const updatedDoc: ArchiveDocument = {
      ...selectedDocument,
      ...editedDocument as ArchiveDocument
    };

    // Update in archive
    const updatedArchive = {
      ...selectedArchive,
      documents: selectedArchive.documents.map(d =>
        d.id === updatedDoc.id ? updatedDoc : d
      )
    };

    await saveArchive(updatedArchive);

    // Refresh
    const updated = await getAllArchives();
    setArchives(updated);
    setSelectedArchive(updated.find(a => a.id === selectedArchive.id) || null);
    setSelectedDocument(updatedDoc);
    setIsEditingDocument(false);
  };

  const filteredDocuments = selectedArchive?.documents.filter(doc => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      doc.name.toLowerCase().includes(searchLower) ||
      doc.citation?.toLowerCase().includes(searchLower) ||
      doc.parties?.toLowerCase().includes(searchLower) ||
      doc.summary?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const getCategoryIcon = (category: ArchiveCategory) => {
    const found = ARCHIVE_CATEGORIES.find(c => c.value === category);
    return found?.icon || <FileText size={14} />;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-legal-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArchiveIcon className="h-6 w-6 text-saffron" />
            <div>
              <h1 className="text-xl font-serif font-bold text-legal-900">Legal Archives</h1>
              <p className="text-xs text-legal-500">Case laws, judgments & legal documents for AI reference</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewArchiveModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-saffron hover:bg-orange-500 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            New Archive
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Archives List */}
        <div className="w-72 border-r border-legal-100 bg-legal-50 flex flex-col">
          <div className="p-3 border-b border-legal-100">
            <div className="text-xs font-semibold text-legal-500 uppercase tracking-wider">
              Archives ({archives.length})
            </div>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-legal-400" />
            </div>
          ) : archives.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
              <ArchiveIcon size={40} className="text-legal-300 mb-3" />
              <p className="text-sm text-legal-500">No archives yet</p>
              <p className="text-xs text-legal-400 mt-1">Create an archive to store case laws and judgments</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {archives.map(archive => (
                <div
                  key={archive.id}
                  onClick={() => setSelectedArchive(archive)}
                  className={`p-3 border-b border-legal-100 cursor-pointer transition-colors ${
                    selectedArchive?.id === archive.id
                      ? 'bg-white border-l-4 border-l-saffron'
                      : 'hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-legal-900 truncate">{archive.name}</div>
                      {archive.description && (
                        <p className="text-xs text-legal-500 truncate mt-0.5">{archive.description}</p>
                      )}
                      <div className="text-xs text-legal-400 mt-1">
                        {archive.documentCount} document{archive.documentCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteArchive(archive.id);
                      }}
                      className="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Archive Detail */}
        {selectedArchive ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Archive Header */}
            <div className="p-4 border-b border-legal-100 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif font-bold text-lg text-legal-900">{selectedArchive.name}</h2>
                  {selectedArchive.description && (
                    <p className="text-sm text-legal-500">{selectedArchive.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search documents..."
                      className="pl-9 pr-4 py-2 border border-legal-200 rounded-lg text-sm focus:outline-none focus:border-saffron"
                    />
                  </div>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indiaGreen hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Upload size={16} />
                    Upload Documents
                  </button>
                </div>
              </div>
            </div>

            {/* Documents Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FileText size={48} className="text-legal-300 mb-3" />
                  <p className="text-legal-500">
                    {searchQuery ? 'No documents match your search' : 'No documents in this archive'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="mt-3 text-sm text-saffron hover:underline"
                    >
                      Upload your first document
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDocuments.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setSelectedDocument(doc);
                        setShowDocumentDetail(true);
                        setEditedDocument(doc);
                      }}
                      className="bg-white border border-legal-100 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-legal-50 rounded-lg">
                          {getCategoryIcon(doc.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm text-legal-900 truncate">{doc.name}</h3>
                          {doc.citation && (
                            <p className="text-xs text-saffron mt-0.5">{doc.citation}</p>
                          )}
                          {doc.parties && (
                            <p className="text-xs text-legal-500 truncate mt-0.5">{doc.parties}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 bg-legal-100 text-legal-600 rounded">
                              {doc.category}
                            </span>
                            {doc.year && (
                              <span className="text-xs text-legal-400">{doc.year}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {doc.summary && (
                        <p className="text-xs text-legal-500 mt-3 line-clamp-2">{doc.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <ArchiveIcon size={64} className="text-legal-200 mb-4" />
            <h2 className="text-xl font-serif text-legal-700">Select an Archive</h2>
            <p className="text-sm text-legal-500 mt-2 max-w-md">
              Choose an archive from the list to view and manage its documents,
              or create a new archive to start organizing your legal references.
            </p>
          </div>
        )}
      </div>

      {/* New Archive Modal */}
      {showNewArchiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-lg">Create New Archive</h3>
              <button onClick={() => setShowNewArchiveModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Archive Name *</label>
                <input
                  type="text"
                  value={newArchiveName}
                  onChange={(e) => setNewArchiveName(e.target.value)}
                  placeholder="e.g., Contract Law Cases"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-saffron"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={newArchiveDescription}
                  onChange={(e) => setNewArchiveDescription(e.target.value)}
                  placeholder="Brief description of this archive..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-saffron resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewArchiveModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateArchive}
                disabled={!newArchiveName.trim()}
                className="px-4 py-2 bg-saffron hover:bg-orange-500 text-white rounded-lg disabled:opacity-50"
              >
                Create Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-lg">Upload Documents</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {isUploading ? (
              <div className="py-8 text-center">
                <Loader2 size={32} className="animate-spin mx-auto text-saffron mb-4" />
                <p className="text-sm text-gray-600">{uploadProgress}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-saffron transition-colors"
                >
                  <Upload size={32} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600">Click to select files or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT supported</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Detail Modal */}
      {showDocumentDetail && selectedDocument && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-legal-100 flex items-center justify-between">
              <h3 className="font-serif font-bold text-lg truncate">{selectedDocument.name}</h3>
              <div className="flex items-center gap-2">
                {isEditingDocument ? (
                  <>
                    <button
                      onClick={() => setIsEditingDocument(false)}
                      className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveDocumentMetadata}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indiaGreen text-white rounded"
                    >
                      <Save size={14} /> Save
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditingDocument(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <Edit3 size={14} /> Edit Metadata
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(selectedDocument.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setShowDocumentDetail(false);
                    setIsEditingDocument(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Metadata */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-legal-700 uppercase tracking-wider">Document Metadata</h4>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Category</label>
                    {isEditingDocument ? (
                      <select
                        value={editedDocument.category || selectedDocument.category}
                        onChange={(e) => setEditedDocument({ ...editedDocument, category: e.target.value as ArchiveCategory })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      >
                        {ARCHIVE_CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm">{selectedDocument.category}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Citation</label>
                    {isEditingDocument ? (
                      <input
                        type="text"
                        value={editedDocument.citation ?? selectedDocument.citation ?? ''}
                        onChange={(e) => setEditedDocument({ ...editedDocument, citation: e.target.value })}
                        placeholder="e.g., AIR 2020 SC 1234"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    ) : (
                      <p className="text-sm text-saffron">{selectedDocument.citation || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Court</label>
                    {isEditingDocument ? (
                      <input
                        type="text"
                        value={editedDocument.court ?? selectedDocument.court ?? ''}
                        onChange={(e) => setEditedDocument({ ...editedDocument, court: e.target.value })}
                        placeholder="e.g., Supreme Court of India"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    ) : (
                      <p className="text-sm">{selectedDocument.court || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Year</label>
                    {isEditingDocument ? (
                      <input
                        type="text"
                        value={editedDocument.year ?? selectedDocument.year ?? ''}
                        onChange={(e) => setEditedDocument({ ...editedDocument, year: e.target.value })}
                        placeholder="e.g., 2020"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    ) : (
                      <p className="text-sm">{selectedDocument.year || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Parties</label>
                    {isEditingDocument ? (
                      <input
                        type="text"
                        value={editedDocument.parties ?? selectedDocument.parties ?? ''}
                        onChange={(e) => setEditedDocument({ ...editedDocument, parties: e.target.value })}
                        placeholder="e.g., State of Maharashtra vs. ABC"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    ) : (
                      <p className="text-sm">{selectedDocument.parties || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Summary</label>
                    {isEditingDocument ? (
                      <textarea
                        value={editedDocument.summary ?? selectedDocument.summary ?? ''}
                        onChange={(e) => setEditedDocument({ ...editedDocument, summary: e.target.value })}
                        placeholder="Brief summary of the case..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none"
                      />
                    ) : (
                      <p className="text-sm">{selectedDocument.summary || '-'}</p>
                    )}
                  </div>

                  {selectedDocument.keyPrinciples && selectedDocument.keyPrinciples.length > 0 && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Key Principles</label>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {selectedDocument.keyPrinciples.map((principle, i) => (
                          <li key={i}>{principle}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Document Content Preview */}
                <div>
                  <h4 className="font-medium text-sm text-legal-700 uppercase tracking-wider mb-2">Document Content</h4>
                  <div className="bg-legal-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-legal-700">
                      {selectedDocument.content.substring(0, 5000)}
                      {selectedDocument.content.length > 5000 && '...\n\n[Content truncated]'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivesPage;
