/**
 * Document Relationship View Component for NyayaSutra
 * Allows linking documents with relationship types and visualizing connections
 */

import React, { useState, useMemo } from 'react';
import {
  Link2, Plus, X, ArrowRight, FileText, ChevronDown, ChevronUp,
  GitBranch, Trash2, Edit3, Save, AlertCircle
} from 'lucide-react';
import { CaseFile, DocumentRelationship, DocumentRelationshipType, Project } from '../types';

interface DocumentRelationshipViewProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  isOpen: boolean;
  onClose: () => void;
}

const RELATIONSHIP_LABELS: Record<DocumentRelationshipType, { label: string; color: string; description: string }> = {
  'response_to': {
    label: 'Response To',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Reply or written statement responding to a petition/application'
  },
  'exhibit_of': {
    label: 'Exhibit Of',
    color: 'bg-green-100 text-green-700 border-green-200',
    description: 'Evidence or exhibit attached to a main document'
  },
  'appeal_of': {
    label: 'Appeal Of',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'Appeal against a lower court order or judgment'
  },
  'amendment_to': {
    label: 'Amendment To',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    description: 'Amendment or modification to an earlier document'
  },
  'supersedes': {
    label: 'Supersedes',
    color: 'bg-red-100 text-red-700 border-red-200',
    description: 'Replaces or supersedes an earlier document'
  },
  'references': {
    label: 'References',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    description: 'References or cites another document'
  },
  'related': {
    label: 'Related To',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    description: 'Generally related to another document'
  }
};

const DocumentRelationshipView: React.FC<DocumentRelationshipViewProps> = ({
  project,
  onUpdateProject,
  isOpen,
  onClose
}) => {
  const [isAddingRelationship, setIsAddingRelationship] = useState(false);
  const [sourceDocId, setSourceDocId] = useState<string>('');
  const [targetDocId, setTargetDocId] = useState<string>('');
  const [relationshipType, setRelationshipType] = useState<DocumentRelationshipType>('related');
  const [description, setDescription] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  const relationships = project.documentRelationships || [];
  const files = project.files;

  // Build a map of document relationships for easy lookup
  const relationshipMap = useMemo(() => {
    const map: Map<string, DocumentRelationship[]> = new Map();

    relationships.forEach(rel => {
      // Add to source document's relationships
      if (!map.has(rel.sourceDocumentId)) {
        map.set(rel.sourceDocumentId, []);
      }
      map.get(rel.sourceDocumentId)!.push(rel);
    });

    return map;
  }, [relationships]);

  // Get document by ID
  const getDocumentById = (id: string): CaseFile | undefined => {
    return files.find(f => f.id === id);
  };

  // Add a new relationship
  const handleAddRelationship = () => {
    if (!sourceDocId || !targetDocId || sourceDocId === targetDocId) return;

    // Check if relationship already exists
    const exists = relationships.some(
      r => r.sourceDocumentId === sourceDocId &&
           r.targetDocumentId === targetDocId &&
           r.relationshipType === relationshipType
    );

    if (exists) {
      alert('This relationship already exists');
      return;
    }

    const newRelationship: DocumentRelationship = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceDocumentId: sourceDocId,
      targetDocumentId: targetDocId,
      relationshipType,
      description: description.trim() || undefined,
      createdAt: Date.now()
    };

    onUpdateProject({
      ...project,
      documentRelationships: [...relationships, newRelationship]
    });

    // Reset form
    setSourceDocId('');
    setTargetDocId('');
    setRelationshipType('related');
    setDescription('');
    setIsAddingRelationship(false);
  };

  // Delete a relationship
  const handleDeleteRelationship = (relationshipId: string) => {
    onUpdateProject({
      ...project,
      documentRelationships: relationships.filter(r => r.id !== relationshipId)
    });
  };

  // Toggle document expansion in graph view
  const toggleDocExpansion = (docId: string) => {
    const newExpanded = new Set(expandedDocs);
    if (newExpanded.has(docId)) {
      newExpanded.delete(docId);
    } else {
      newExpanded.add(docId);
    }
    setExpandedDocs(newExpanded);
  };

  // Count relationships for a document
  const getRelationshipCount = (docId: string): number => {
    return relationships.filter(
      r => r.sourceDocumentId === docId || r.targetDocumentId === docId
    ).length;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-legal-900 flex items-center gap-2">
              <GitBranch size={20} />
              Document Relationships
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode('graph')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    viewMode === 'graph' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                  }`}
                >
                  Graph
                </button>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span>{files.length} documents</span>
            <span>{relationships.length} relationships</span>
          </div>
        </div>

        {/* Add Relationship Form */}
        {isAddingRelationship ? (
          <div className="p-4 border-b border-gray-100 bg-blue-50">
            <h3 className="text-sm font-medium text-gray-800 mb-3">Create New Relationship</h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Source Document */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Source Document</label>
                <select
                  value={sourceDocId}
                  onChange={(e) => setSourceDocId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-saffron outline-none bg-white"
                >
                  <option value="">Select document...</option>
                  {files.map(file => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Relationship Type */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Relationship Type</label>
                <select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value as DocumentRelationshipType)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-saffron outline-none bg-white"
                >
                  {Object.entries(RELATIONSHIP_LABELS).map(([type, { label }]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {RELATIONSHIP_LABELS[relationshipType].description}
                </p>
              </div>

              {/* Target Document */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Target Document</label>
                <select
                  value={targetDocId}
                  onChange={(e) => setTargetDocId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-saffron outline-none bg-white"
                >
                  <option value="">Select document...</option>
                  {files.filter(f => f.id !== sourceDocId).map(file => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="mt-3">
              <label className="block text-xs text-gray-600 mb-1">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the relationship..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-saffron outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setIsAddingRelationship(false)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRelationship}
                disabled={!sourceDocId || !targetDocId || sourceDocId === targetDocId}
                className="px-4 py-2 text-sm bg-saffron hover:bg-orange-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Create Relationship
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-gray-100">
            <button
              onClick={() => setIsAddingRelationship(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-saffron hover:bg-orange-500 text-white rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Relationship
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {viewMode === 'list' ? (
            // List View
            <div className="space-y-3">
              {relationships.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Link2 size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No document relationships defined</p>
                  <p className="text-sm mt-1">Click "Add Relationship" to link documents together</p>
                </div>
              ) : (
                relationships.map(rel => {
                  const sourceDoc = getDocumentById(rel.sourceDocumentId);
                  const targetDoc = getDocumentById(rel.targetDocumentId);
                  const relInfo = RELATIONSHIP_LABELS[rel.relationshipType];

                  return (
                    <div
                      key={rel.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      {/* Source Document */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {sourceDoc?.name || 'Unknown Document'}
                          </span>
                        </div>
                        {sourceDoc?.metadata?.category && (
                          <span className="text-xs text-gray-500 ml-5">
                            {sourceDoc.metadata.category}
                          </span>
                        )}
                      </div>

                      {/* Relationship Badge */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-1 text-xs rounded-full border ${relInfo.color}`}>
                          {relInfo.label}
                        </span>
                        <ArrowRight size={16} className="text-gray-400" />
                      </div>

                      {/* Target Document */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {targetDoc?.name || 'Unknown Document'}
                          </span>
                        </div>
                        {targetDoc?.metadata?.category && (
                          <span className="text-xs text-gray-500 ml-5">
                            {targetDoc.metadata.category}
                          </span>
                        )}
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteRelationship(rel.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                        title="Delete relationship"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            // Graph View (Tree-like visualization)
            <div className="space-y-2">
              {files.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No documents in this project</p>
                </div>
              ) : (
                files.map(file => {
                  const docRelationships = relationshipMap.get(file.id) || [];
                  const incomingRels = relationships.filter(r => r.targetDocumentId === file.id);
                  const isExpanded = expandedDocs.has(file.id);
                  const totalConnections = docRelationships.length + incomingRels.length;

                  return (
                    <div key={file.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Document Header */}
                      <button
                        onClick={() => toggleDocExpansion(file.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <FileText size={16} className="text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                          {file.metadata?.category && (
                            <p className="text-xs text-gray-500">{file.metadata.category}</p>
                          )}
                        </div>
                        {totalConnections > 0 && (
                          <span className="px-2 py-0.5 text-xs bg-saffron/10 text-saffron rounded-full">
                            {totalConnections} connection{totalConnections !== 1 ? 's' : ''}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      {/* Expanded Relationships */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2">
                          {/* Outgoing relationships */}
                          {docRelationships.length > 0 && (
                            <div className="ml-6 space-y-1">
                              <p className="text-xs text-gray-500 font-medium">Outgoing:</p>
                              {docRelationships.map(rel => {
                                const targetDoc = getDocumentById(rel.targetDocumentId);
                                const relInfo = RELATIONSHIP_LABELS[rel.relationshipType];
                                return (
                                  <div key={rel.id} className="flex items-center gap-2 pl-4 border-l-2 border-blue-200">
                                    <span className={`px-2 py-0.5 text-xs rounded ${relInfo.color}`}>
                                      {relInfo.label}
                                    </span>
                                    <ArrowRight size={12} className="text-gray-400" />
                                    <span className="text-sm text-gray-700">
                                      {targetDoc?.name || 'Unknown'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Incoming relationships */}
                          {incomingRels.length > 0 && (
                            <div className="ml-6 space-y-1">
                              <p className="text-xs text-gray-500 font-medium">Incoming:</p>
                              {incomingRels.map(rel => {
                                const sourceDoc = getDocumentById(rel.sourceDocumentId);
                                const relInfo = RELATIONSHIP_LABELS[rel.relationshipType];
                                return (
                                  <div key={rel.id} className="flex items-center gap-2 pl-4 border-l-2 border-green-200">
                                    <span className="text-sm text-gray-700">
                                      {sourceDoc?.name || 'Unknown'}
                                    </span>
                                    <ArrowRight size={12} className="text-gray-400" />
                                    <span className={`px-2 py-0.5 text-xs rounded ${relInfo.color}`}>
                                      {relInfo.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {totalConnections === 0 && (
                            <p className="ml-6 text-xs text-gray-400 italic">No relationships</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Types:</span>
            {Object.entries(RELATIONSHIP_LABELS).map(([type, { label, color }]) => (
              <span key={type} className={`px-2 py-0.5 rounded border ${color}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentRelationshipView;
