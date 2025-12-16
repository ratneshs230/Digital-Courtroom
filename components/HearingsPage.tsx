import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Calendar, Clock, Gavel, Play, FileText, Target, Trash2, ChevronRight, GitBranch, ArrowDown, CornerDownRight } from 'lucide-react';
import { Project, Session, Role, HearingDocument, SessionStrategy } from '../types';
import { processFiles, ProcessFilesResult } from '../utils/fileProcessor';

interface HearingsPageProps {
  project: Project;
  onBack: () => void;
  onStartHearing: (session: Session) => void;
  initialContinuationSession?: Session | null;
  onClearContinuationSession?: () => void;
  sessions: Session[];
  onUpdateSessions: (sessions: Session[]) => void;
}

const HEARING_TYPES = [
  'Bail Hearing',
  'Evidence Hearing',
  'Arguments on Charge',
  'Final Arguments',
  'Interim Application',
  'Cross-Examination',
  'Motion Hearing',
  'Settlement Conference',
  'Status Hearing',
  'Other'
];

const HearingsPage: React.FC<HearingsPageProps> = ({
  project,
  onBack,
  onStartHearing,
  initialContinuationSession,
  onClearContinuationSession,
  sessions,
  onUpdateSessions
}) => {
  const [showNewHearingModal, setShowNewHearingModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // New hearing form state
  const [hearingType, setHearingType] = useState(HEARING_TYPES[0]);
  const [hearingDescription, setHearingDescription] = useState('');
  const [recentDevelopments, setRecentDevelopments] = useState<HearingDocument[]>([]);
  const [userIntent, setUserIntent] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [maxTurns, setMaxTurns] = useState(6);

  // Continuation session state
  const [continuingFromSession, setContinuingFromSession] = useState<Session | null>(null);

  // Handle initial continuation session from props (e.g., from courtroom "Continue" button)
  useEffect(() => {
    if (initialContinuationSession) {
      setContinuingFromSession(initialContinuationSession);
      setHearingType('Continuation Hearing');
      setShowNewHearingModal(true);
      // Clear the continuation session from parent state to prevent re-triggering
      onClearContinuationSession?.();
    }
  }, [initialContinuationSession, onClearContinuationSession]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setLoading(true);
      const result: ProcessFilesResult = await processFiles(e.target.files);

      if (result.failedFiles.length > 0) {
        alert(`Could not process: ${result.failedFiles.join(', ')}`);
      }

      const hearingDocs: HearingDocument[] = result.files.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        content: f.content,
        uploadedAt: Date.now()
      }));

      setRecentDevelopments([...recentDevelopments, ...hearingDocs]);
      setLoading(false);
    }
  };

  const handleCreateHearing = () => {
    if (!userIntent.trim()) {
      alert('Please enter your strategy/intent for this hearing.');
      return;
    }

    if (recentDevelopments.length === 0 && !continuingFromSession) {
      alert('Please upload at least one document about recent developments.');
      return;
    }

    const strategy: SessionStrategy = {
      intent: userIntent.trim(),
      keyPoints: keyPoints.split('\n').map(p => p.trim()).filter(p => p.length > 0)
    };

    // Calculate continuation order
    let continuationOrder = 0;
    if (continuingFromSession) {
      const existingContinuations = sessions.filter(s =>
        s.parentSessionId === continuingFromSession.id ||
        (continuingFromSession.parentSessionId && s.parentSessionId === continuingFromSession.parentSessionId)
      );
      continuationOrder = (continuingFromSession.continuationOrder || 0) + 1;
    }

    const newSession: Session = {
      id: Date.now().toString(),
      projectId: project.id,
      hearingType,
      hearingDescription: hearingDescription.trim() || undefined,
      maxTurns,
      currentTurnCount: 0,
      status: 'pending',
      messages: [],
      createdAt: Date.now(),
      recentDevelopments,
      userStrategy: strategy,
      firstSpeaker: project.userSide,
      // Continuation fields
      parentSessionId: continuingFromSession?.id,
      isContinuation: !!continuingFromSession,
      continuationOrder: continuingFromSession ? continuationOrder : undefined
    };

    const updatedSessions = [...sessions, newSession];
    onUpdateSessions(updatedSessions);

    // Reset form
    setShowNewHearingModal(false);
    setContinuingFromSession(null);
    setHearingType(HEARING_TYPES[0]);
    setHearingDescription('');
    setRecentDevelopments([]);
    setUserIntent('');
    setKeyPoints('');
    setMaxTurns(6);
  };

  // Start continuation session flow
  const startContinuation = (parentSession: Session) => {
    setContinuingFromSession(parentSession);
    setHearingType('Continuation Hearing');
    setHearingDescription(`Continuation of: ${parentSession.hearingType}`);
    setShowNewHearingModal(true);
  };

  // Get sessions grouped by parent (for display)
  const getSessionGroups = () => {
    const rootSessions = sessions.filter(s => !s.isContinuation);
    return rootSessions.map(root => ({
      root,
      continuations: sessions
        .filter(s => s.parentSessionId === root.id)
        .sort((a, b) => (a.continuationOrder || 0) - (b.continuationOrder || 0))
    }));
  };

  const sessionGroups = getSessionGroups();

  // Render a session card
  const renderSessionCard = (session: Session, isContinuation = false) => (
    <div
      className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${
        isContinuation ? 'border-blue-200 bg-blue-50/30' : 'border-legal-100'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {isContinuation && (
                <GitBranch size={14} className="text-blue-500" />
              )}
              <h3 className="font-serif font-bold text-lg text-gray-900">
                {session.hearingType}
              </h3>
              <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(session.status)}`}>
                {getStatusText(session.status)}
              </span>
              {session.isContinuation && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  Continuation #{session.continuationOrder}
                </span>
              )}
            </div>
            {session.hearingDescription && (
              <p className="text-sm text-gray-600 mb-3">{session.hearingDescription}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {new Date(session.createdAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {session.currentTurnCount}/{session.maxTurns} turns
              </span>
              <span className="flex items-center gap-1">
                <FileText size={14} />
                {session.recentDevelopments?.length || 0} documents
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDeleteSession(session.id)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete Hearing"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => onStartHearing(session)}
              className="flex items-center gap-2 bg-saffron hover:bg-orange-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {session.status === 'pending' ? (
                <>
                  <Play size={16} />
                  Start
                </>
              ) : session.status === 'completed' ? (
                <>
                  <ChevronRight size={16} />
                  View
                </>
              ) : (
                <>
                  <Play size={16} />
                  Continue
                </>
              )}
            </button>
          </div>
        </div>

        {/* Strategy Preview */}
        {session.userStrategy && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-start gap-2">
              <Target size={14} className="text-blue-500 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Your Strategy</p>
                <p className="text-sm text-gray-700 line-clamp-2">{session.userStrategy.intent}</p>
              </div>
            </div>
          </div>
        )}

        {/* Verdict Preview for completed sessions */}
        {session.status === 'completed' && session.verdict && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-start gap-2">
              <Gavel size={14} className="text-legal-700 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Judgment</p>
                <p className="text-sm text-gray-700 line-clamp-2">{session.verdict}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const handleDeleteSession = (sessionId: string) => {
    if (window.confirm('Are you sure you want to delete this hearing?')) {
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      onUpdateSessions(updatedSessions);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'active': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'active': return 'In Progress';
      default: return 'Not Started';
    }
  };

  return (
    <div className="h-full flex flex-col bg-legal-50">
      {/* Header */}
      <div className="bg-white border-b border-legal-100 p-6 shadow-sm">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-serif font-bold text-legal-900">Court Hearings</h1>
                <p className="text-sm text-gray-500">{project.name} - {project.caseTitle}</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewHearingModal(true)}
              className="flex items-center gap-2 bg-legal-900 hover:bg-legal-800 text-white px-5 py-2.5 rounded-lg shadow-md transition-all"
            >
              <Plus size={18} />
              New Hearing
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {sessions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-legal-100 p-12 text-center">
              <div className="w-20 h-20 bg-legal-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Gavel className="text-legal-400" size={40} />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Hearings Yet</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Create a new hearing to simulate courtroom arguments based on recent developments in your case.
              </p>
              <button
                onClick={() => setShowNewHearingModal(true)}
                className="text-saffron font-medium hover:underline"
              >
                Schedule your first hearing &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {sessionGroups.map(({ root, continuations }) => (
                <div key={root.id} className="space-y-2">
                  {/* Root Session */}
                  {renderSessionCard(root)}

                  {/* Continuation Sessions */}
                  {continuations.length > 0 && (
                    <div className="ml-8 space-y-2">
                      {continuations.map((contSession, idx) => (
                        <div key={contSession.id} className="relative">
                          <div className="absolute -left-6 top-1/2 -translate-y-1/2 flex items-center">
                            <CornerDownRight size={16} className="text-gray-400" />
                          </div>
                          {renderSessionCard(contSession, true)}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Continuation Button for completed sessions */}
                  {root.status === 'completed' && (
                    <div className="ml-8 relative">
                      <div className="absolute -left-6 top-1/2 -translate-y-1/2">
                        <ArrowDown size={16} className="text-gray-300" />
                      </div>
                      <button
                        onClick={() => startContinuation(root)}
                        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-saffron hover:text-saffron flex items-center justify-center gap-2 transition-colors bg-white"
                      >
                        <Plus size={16} />
                        Continue from Judgment
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Hearing Modal */}
      {showNewHearingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-legal-100">
              <h3 className="text-2xl font-serif font-bold text-legal-900">
                {continuingFromSession ? 'Continue Hearing' : 'Schedule New Hearing'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {continuingFromSession
                  ? `Continuing from: ${continuingFromSession.hearingType}`
                  : 'Upload recent developments and set your strategy'}
              </p>
              {continuingFromSession && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} />
                    <span className="font-medium">This will be a continuation hearing</span>
                  </div>
                  <p className="text-xs mt-1">New evidence and arguments can be presented based on the judgment.</p>
                </div>
              )}
            </div>

            <div className="p-6 space-y-6">
              {/* Hearing Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hearing Type *</label>
                <select
                  value={hearingType}
                  onChange={e => setHearingType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron focus:border-transparent outline-none"
                >
                  {HEARING_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hearing Description (Optional)</label>
                <input
                  type="text"
                  value={hearingDescription}
                  onChange={e => setHearingDescription(e.target.value)}
                  placeholder="Brief description of this hearing..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron focus:border-transparent outline-none"
                />
              </div>

              {/* Recent Developments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recent Development Documents {continuingFromSession ? '(Optional)' : '*'}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50 text-center">
                  <input
                    type="file"
                    id="hearing-docs"
                    multiple
                    accept=".txt,.pdf,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="hearing-docs" className="cursor-pointer flex flex-col items-center">
                    <FileText className="text-gray-400 mb-2" size={32} />
                    <span className="text-sm font-medium text-legal-700">Upload Documents</span>
                    <span className="text-xs text-gray-500 mt-1">Court orders, new evidence, notices (PDF, DOCX, TXT)</span>
                  </label>
                  {recentDevelopments.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      {recentDevelopments.map((doc, i) => (
                        <span key={i} className="text-xs bg-white px-2 py-1 border rounded shadow-sm text-gray-600 flex items-center gap-1">
                          {doc.name}
                          <button
                            onClick={() => setRecentDevelopments(recentDevelopments.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-600"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {loading && <p className="text-xs text-saffron mt-2 animate-pulse">Processing...</p>}
                </div>
              </div>

              {/* User Strategy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Strategy/Intent for this Hearing *
                </label>
                <textarea
                  value={userIntent}
                  onChange={e => setUserIntent(e.target.value)}
                  placeholder="What do you want to achieve in this hearing? What arguments should your side emphasize?"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron focus:border-transparent outline-none h-28 resize-none"
                />
              </div>

              {/* Key Points */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key Points to Emphasize (Optional, one per line)
                </label>
                <textarea
                  value={keyPoints}
                  onChange={e => setKeyPoints(e.target.value)}
                  placeholder="Point 1&#10;Point 2&#10;Point 3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron focus:border-transparent outline-none h-20 resize-none"
                />
              </div>

              {/* Max Turns */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Turns</label>
                <select
                  value={maxTurns}
                  onChange={e => setMaxTurns(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saffron focus:border-transparent outline-none"
                >
                  {[4, 6, 8, 10, 12].map(n => (
                    <option key={n} value={n}>{n} turns</option>
                  ))}
                </select>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <strong>How it works:</strong> The AI will argue for your side ({project.userSide}) based on your strategy, while the opposing side will counter-argue. The hearing focuses on the recent developments while maintaining full case knowledge.
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white p-6 border-t border-legal-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewHearingModal(false);
                  setContinuingFromSession(null);
                  setHearingType(HEARING_TYPES[0]);
                  setHearingDescription('');
                  setRecentDevelopments([]);
                  setUserIntent('');
                  setKeyPoints('');
                }}
                className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateHearing}
                disabled={!userIntent.trim() || (recentDevelopments.length === 0 && !continuingFromSession)}
                className="px-6 py-2.5 bg-saffron hover:bg-orange-500 text-white font-medium rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {continuingFromSession ? 'Create Continuation' : 'Create Hearing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HearingsPage;
