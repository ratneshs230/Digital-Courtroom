import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Pause, Play, User, Gavel, BookOpen, Target, FileText, ChevronDown, ChevronUp, MessageCircle, Send, Upload, X, Paperclip, Edit3, GitBranch, Save, RotateCcw, FolderOpen, Calendar, History, AlertCircle } from 'lucide-react';
import { Project, Session, Role, SimulationMessage, CaseFile, JudgmentResponse, DocumentCategory, HearingDocument } from '../types';
import { generateTurn } from '../services/geminiService';
import { processFiles, ProcessFilesResult } from '../utils/fileProcessor';

interface SimulationRoomProps {
  session: Session;
  project: Project;
  onBack: () => void;
  onContinueSession?: (parentSession: Session) => void;
  onSessionUpdate?: (session: Session) => void;
}

// Component to display hearing documents
const HearingDocumentsPanel: React.FC<{
  documents: HearingDocument[];
  isOpen: boolean;
  onToggle: () => void;
  hearingType?: string;
}> = ({ documents, isOpen, onToggle, hearingType }) => {
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-legal-900 text-white p-3 rounded-l-lg shadow-lg hover:bg-legal-800 transition-colors z-30"
        title="Open Hearing Documents"
      >
        <FolderOpen size={20} />
      </button>
    );
  }

  return (
    <div className="w-72 bg-white border-l border-legal-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-legal-100 bg-legal-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif font-bold text-sm text-legal-900 flex items-center gap-2">
            <FileText size={16} />
            Hearing Documents
          </h3>
          <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        {hearingType && (
          <p className="text-xs text-gray-500">{hearingType}</p>
        )}
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {documents.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs">
            No documents for this hearing
          </div>
        ) : (
          documents.map(doc => (
            <div key={doc.id} className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
              <div
                className="p-2 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{doc.name}</p>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Calendar size={10} /> {new Date(doc.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {expandedDocId === doc.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>

              {/* Expanded Content Preview */}
              {expandedDocId === doc.id && (
                <div className="px-2 pb-2 border-t border-gray-100 bg-white">
                  <div className="pt-2 max-h-40 overflow-y-auto text-xs text-gray-600 whitespace-pre-wrap">
                    {doc.content.substring(0, 500)}
                    {doc.content.length > 500 && '...'}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-legal-100 bg-legal-50 text-xs text-gray-500">
        {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded for this hearing
      </div>
    </div>
  );
};

const SimulationRoom: React.FC<SimulationRoomProps> = ({ session, project, onBack, onContinueSession, onSessionUpdate }) => {
  const [messages, setMessages] = useState<SimulationMessage[]>(session.messages || []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(session.currentTurnCount);
  const [showStrategy, setShowStrategy] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Judgment response state
  const [respondingToMessageId, setRespondingToMessageId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<CaseFile[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Message editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [showBranchWarning, setShowBranchWarning] = useState(false);

  // Document panel state
  const [showDocPanel, setShowDocPanel] = useState(true);

  // Parent session messages (for continuation hearings)
  const [parentSessionMessages, setParentSessionMessages] = useState<SimulationMessage[]>([]);
  const [parentSessionInfo, setParentSessionInfo] = useState<{ hearingType: string; verdict?: string } | null>(null);

  // Load parent session messages for continuation hearings
  useEffect(() => {
    if (session.isContinuation && session.parentSessionId) {
      const savedSessions = localStorage.getItem(`sessions_${project.id}`);
      if (savedSessions) {
        const allSessions: Session[] = JSON.parse(savedSessions);
        const parentSession = allSessions.find(s => s.id === session.parentSessionId);
        if (parentSession) {
          setParentSessionMessages(parentSession.messages || []);
          setParentSessionInfo({
            hearingType: parentSession.hearingType || parentSession.reason || 'Previous Hearing',
            verdict: parentSession.verdict
          });
        }
      }
    }
  }, [session.isContinuation, session.parentSessionId, project.id]);

  // Determine whose turn it is - User's side starts first
  const getNextSpeaker = (history: SimulationMessage[]): Role => {
    // User's side starts first
    if (history.length === 0) {
      return session.firstSpeaker || project.userSide;
    }

    const lastRole = history[history.length - 1].role;

    // Judge speaks at the end
    if (turnCount >= session.maxTurns) return Role.Judge;

    // Alternate between Petitioner and Respondent
    return lastRole === Role.Petitioner ? Role.Respondent : Role.Petitioner;
  };

  const handleManualTurn = async (forcedRole?: Role) => {
    if (loading || (turnCount > session.maxTurns && messages.some(m => m.role === Role.Judge))) return;

    setLoading(true);
    const speaker = forcedRole || getNextSpeaker(messages);

    // Call AI
    const result = await generateTurn(project, session, speaker, messages);

    const newMessage: SimulationMessage = {
      id: Date.now().toString(),
      role: speaker,
      text: result.text,
      references: result.references,
      timestamp: Date.now(),
      isUserSideAI: result.isUserSideAI,
      strategyUsed: result.isUserSideAI ? session.userStrategy?.intent : undefined
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);

    if (speaker !== Role.Judge) {
      setTurnCount(prev => prev + 1);
    }

    setLoading(false);

    // Persist
    saveSessionProgress(updatedMessages, (speaker !== Role.Judge ? turnCount + 1 : turnCount));
  };

  const saveSessionProgress = (msgs: SimulationMessage[], count: number) => {
    const isJudgeMessage = msgs.length > 0 && msgs[msgs.length - 1].role === Role.Judge;
    const newStatus: 'pending' | 'active' | 'completed' = isJudgeMessage ? 'completed' : (count > 0 ? 'active' : 'pending');
    const verdict = isJudgeMessage ? msgs[msgs.length - 1].text : session.verdict;

    const updatedSession: Session = {
      ...session,
      messages: msgs,
      currentTurnCount: count,
      status: newStatus,
      verdict
    };

    // Call the parent's update handler if provided
    if (onSessionUpdate) {
      onSessionUpdate(updatedSession);
    } else {
      // Fallback to direct localStorage update for backward compatibility
      const savedSessions = localStorage.getItem(`sessions_${project.id}`);
      if (savedSessions) {
        const allSessions: Session[] = JSON.parse(savedSessions);
        const updatedSessions = allSessions.map(s =>
          s.id === session.id ? updatedSession : s
        );
        localStorage.setItem(`sessions_${project.id}`, JSON.stringify(updatedSessions));
      }
    }
  };

  // Check if a judge's message contains a question that requires response
  const messageRequiresResponse = (text: string): boolean => {
    const questionIndicators = [
      '?',
      'clarify',
      'explain',
      'submit',
      'provide',
      'produce',
      'file',
      'respond',
      'answer',
      'what is your',
      'do you have',
      'can you',
      'would you',
      'court directs',
      'court requires',
      'please explain',
      'kindly clarify'
    ];
    const lowerText = text.toLowerCase();
    return questionIndicators.some(indicator => lowerText.includes(indicator));
  };

  // Handle file upload for judgment response
  const handleResponseFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsUploadingFiles(true);
    try {
      const result: ProcessFilesResult = await processFiles(e.target.files);

      if (result.failedFiles.length > 0) {
        alert(`Could not process: ${result.failedFiles.join(', ')}`);
      }

      const newFiles: CaseFile[] = result.files.map(f => ({
        ...f,
        uploadedAt: Date.now(),
        metadata: {
          category: DocumentCategory.Evidence,
        }
      }));

      setAttachedFiles(prev => [...prev, ...newFiles]);
    } catch (err) {
      alert('Failed to upload files');
    } finally {
      setIsUploadingFiles(false);
      e.target.value = '';
    }
  };

  // Remove attached file
  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Submit response to judge's question
  const handleSubmitResponse = (messageId: string, questionText: string) => {
    if (!responseText.trim() && attachedFiles.length === 0) return;

    const response: JudgmentResponse = {
      id: Date.now().toString(),
      questionFromJudge: questionText,
      userResponse: responseText.trim(),
      attachedDocuments: attachedFiles.length > 0 ? attachedFiles : undefined,
      timestamp: Date.now()
    };

    // Update the message with the response
    const updatedMessages = messages.map(msg =>
      msg.id === messageId
        ? { ...msg, userResponse: response }
        : msg
    );

    setMessages(updatedMessages);
    saveSessionProgress(updatedMessages, turnCount);

    // Reset response state
    setRespondingToMessageId(null);
    setResponseText('');
    setAttachedFiles([]);
  };

  // Start responding to a judge's message
  const startResponding = (messageId: string) => {
    setRespondingToMessageId(messageId);
    setResponseText('');
    setAttachedFiles([]);
  };

  // Cancel responding
  const cancelResponding = () => {
    setRespondingToMessageId(null);
    setResponseText('');
    setAttachedFiles([]);
  };

  // Start editing a message
  const startEditingMessage = (msg: SimulationMessage) => {
    setEditingMessageId(msg.id);
    setEditMessageText(msg.text);
    setShowBranchWarning(true);
  };

  // Cancel editing
  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditMessageText('');
    setShowBranchWarning(false);
  };

  // Save edited message and create a branch
  const saveEditedMessage = async (messageId: string) => {
    if (!editMessageText.trim()) return;

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const editedMessage = messages[messageIndex];
    const branchId = `branch_${Date.now()}`;

    // Create the edited message
    const updatedMessage: SimulationMessage = {
      ...editedMessage,
      text: editMessageText,
      originalText: editedMessage.originalText || editedMessage.text,
      isEdited: true,
      editedAt: Date.now(),
      branchId
    };

    // Keep messages up to the edited one, then regenerate from there
    const messagesBeforeEdit = messages.slice(0, messageIndex);
    const updatedMessages = [...messagesBeforeEdit, updatedMessage];

    // Calculate new turn count based on messages before edit + 1
    const newTurnCount = messagesBeforeEdit.filter(m => m.role !== Role.Judge).length + 1;

    setMessages(updatedMessages);
    setTurnCount(newTurnCount);
    saveSessionProgress(updatedMessages, newTurnCount);

    // Reset editing state
    setEditingMessageId(null);
    setEditMessageText('');
    setShowBranchWarning(false);

    // Continue the hearing from the edited message (generate opponent's response)
    if (updatedMessage.role === project.userSide && newTurnCount < session.maxTurns) {
      // Let opponent respond to the edited message
      setTimeout(() => {
        handleManualTurn();
      }, 500);
    }
  };

  // Check if a message can be edited (only user's side messages that are AI-generated)
  const canEditMessage = (msg: SimulationMessage): boolean => {
    const hasJudgeSpoken = messages.some(m => m.role === Role.Judge);
    return msg.role === project.userSide && msg.isUserSideAI === true && !hasJudgeSpoken;
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Auto-play logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && !loading) {
      if (messages.length > 0 && messages[messages.length - 1].role === Role.Judge) {
        setIsPlaying(false);
        return;
      }

      interval = setInterval(() => {
        handleManualTurn();
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, loading, turnCount, messages]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  // Avatar Component
  const Avatar = ({ role, isActive }: { role: Role, isActive: boolean }) => {
    const isPetitioner = role === Role.Petitioner;
    const isJudge = role === Role.Judge;
    const isUserSide = role === project.userSide;

    return (
      <div className={`flex flex-col items-center transition-all duration-500 ${isActive ? 'scale-110 opacity-100' : 'scale-100 opacity-60'}`}>
        <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-4 flex items-center justify-center bg-white shadow-xl relative
          ${isActive ? 'border-saffron' : 'border-gray-200'}
        `}>
          {isJudge ? (
            <Gavel size={36} className="text-legal-900" />
          ) : (
            <User size={36} className={isPetitioner ? 'text-blue-600' : 'text-red-600'} />
          )}

          {isActive && loading && (
            <div className="absolute inset-0 rounded-full border-4 border-saffron border-t-transparent animate-spin"></div>
          )}
        </div>
        <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
          isActive ? 'bg-legal-900 text-white' : 'bg-gray-100 text-gray-500'
        }`}>
          {role}
        </div>
        {isUserSide && !isJudge && (
          <span className="mt-1 text-xs text-saffron font-medium">Your Side</span>
        )}
      </div>
    );
  };

  const isSessionComplete = messages.some(m => m.role === Role.Judge);
  const hearingTitle = session.hearingType || session.reason || 'Court Hearing';

  // Get hearing documents
  const hearingDocuments = session.recentDevelopments || [];

  return (
    <div className="h-full flex bg-legal-50">
      {/* Main Courtroom Area */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Simulation Header */}
      <div className="bg-white border-b border-legal-100 p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-legal-900">{hearingTitle}</h2>
                {session.isContinuation && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded flex items-center gap-1">
                    <History size={10} /> Continuation
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Turn {Math.min(turnCount, session.maxTurns)} / {session.maxTurns} •
                You are: <span className={project.userSide === Role.Petitioner ? 'text-blue-600' : 'text-red-600'}>{project.userSide}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isSessionComplete ? (
              <button
                onClick={togglePlay}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isPlaying ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                }`}
              >
                {isPlaying ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Auto-Simulate</>}
              </button>
            ) : (
              <div className="px-4 py-2 bg-legal-800 text-white rounded-lg flex items-center gap-2">
                <Gavel size={18} /> Judgment Delivered
              </div>
            )}
          </div>
        </div>

        {/* Strategy Panel */}
        {session.userStrategy && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <button
              onClick={() => setShowStrategy(!showStrategy)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <Target size={14} />
              <span className="font-medium">Your Strategy</span>
              {showStrategy ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showStrategy && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                <p className="text-blue-800">{session.userStrategy.intent}</p>
                {session.userStrategy.keyPoints && session.userStrategy.keyPoints.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {session.userStrategy.keyPoints.map((point, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {point}
                      </span>
                    ))}
                  </div>
                )}
                {session.recentDevelopments && session.recentDevelopments.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                    <FileText size={12} />
                    {session.recentDevelopments.length} recent development document(s)
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual Stage */}
      <div className="bg-legal-200 h-48 md:h-56 relative flex items-center justify-center border-b border-legal-300 overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-10"></div>
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" className="h-12 opacity-20" alt="Emblem" />
        </div>

        <div className="relative z-10 flex w-full max-w-4xl justify-between px-6 md:px-10 items-end pb-6">
          {/* Petitioner */}
          <Avatar role={Role.Petitioner} isActive={loading && getNextSpeaker(messages) === Role.Petitioner} />

          {/* Judge (Top Center) */}
          <div className="mb-8">
            <Avatar role={Role.Judge} isActive={loading && getNextSpeaker(messages) === Role.Judge} />
          </div>

          {/* Respondent */}
          <Avatar role={Role.Respondent} isActive={loading && getNextSpeaker(messages) === Role.Respondent} />
        </div>
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Parent Session Messages (for continuation hearings) */}
          {session.isContinuation && parentSessionMessages.length > 0 && (
            <div className="mb-6">
              {/* Parent Session Header */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                  <History size={16} />
                  Previous Hearing: {parentSessionInfo?.hearingType}
                </div>
                {parentSessionInfo?.verdict && (
                  <div className="mt-2 text-xs text-amber-600 bg-amber-100 rounded p-2">
                    <span className="font-medium">Previous Judgment:</span> {parentSessionInfo.verdict.substring(0, 200)}...
                  </div>
                )}
              </div>

              {/* Parent Session Messages (read-only) */}
              {parentSessionMessages.map((msg) => {
                const isUserSideMessage = msg.role === project.userSide;
                const isJudgeMessage = msg.role === Role.Judge;

                return (
                  <div key={`parent-${msg.id}`} className={`flex gap-3 opacity-70 ${msg.role === Role.Respondent ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-sm
                      ${msg.role === Role.Petitioner ? 'bg-blue-400' : msg.role === Role.Respondent ? 'bg-red-400' : 'bg-legal-600'}
                    `}>
                      {msg.role[0]}
                    </div>

                    <div className={`flex-1 max-w-[80%] rounded-xl p-4 shadow-sm ${
                      isJudgeMessage
                        ? 'bg-legal-50 border border-legal-200'
                        : isUserSideMessage
                        ? 'bg-blue-50/50 border border-blue-100'
                        : 'bg-gray-50 border border-gray-100'
                    }`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-xs text-gray-500">{msg.role}</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <History size={10} /> Previous hearing
                        </span>
                      </div>
                      <p className="text-gray-600 leading-relaxed text-sm">{msg.text}</p>
                    </div>
                  </div>
                );
              })}

              {/* Divider between parent and current session */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent"></div>
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                  <AlertCircle size={12} />
                  Continuation: {hearingTitle}
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent"></div>
              </div>
            </div>
          )}

          {messages.length === 0 && !session.isContinuation && (
            <div className="text-center text-gray-400 py-10 italic">
              The court is in session. {project.userSide} ({project.userSide === Role.Petitioner ? 'Your side' : 'Your side'}) will begin the arguments.
            </div>
          )}

          {messages.length === 0 && session.isContinuation && (
            <div className="text-center text-gray-400 py-6 italic">
              Continue the hearing with new arguments based on the previous session above.
            </div>
          )}

          {messages.map((msg) => {
            const isUserSideMessage = msg.role === project.userSide;
            const isJudgeMessage = msg.role === Role.Judge;
            const requiresResponse = isJudgeMessage && messageRequiresResponse(msg.text);
            const isRespondingToThis = respondingToMessageId === msg.id;
            const hasResponse = msg.userResponse;
            const isEditingThis = editingMessageId === msg.id;
            const canEdit = canEditMessage(msg);

            return (
              <div key={msg.id} className={`flex gap-3 ${msg.role === Role.Respondent ? 'flex-row-reverse' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-sm
                  ${msg.role === Role.Petitioner ? 'bg-blue-600' : msg.role === Role.Respondent ? 'bg-red-600' : 'bg-legal-900'}
                `}>
                  {msg.role[0]}
                </div>

                <div className={`flex-1 max-w-[80%] rounded-xl p-4 shadow-sm ${
                  isJudgeMessage
                    ? 'bg-legal-100 border-2 border-legal-200'
                    : isUserSideMessage
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-white border border-gray-100'
                } ${msg.isEdited ? 'ring-2 ring-yellow-300' : ''}`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-700">{msg.role}</span>
                      {msg.isUserSideAI && (
                        <span className="text-xs bg-saffron/20 text-saffron px-2 py-0.5 rounded">AI for You</span>
                      )}
                      {msg.isEdited && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded flex items-center gap-1">
                          <GitBranch size={10} /> Edited
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && !isEditingThis && (
                        <button
                          onClick={() => startEditingMessage(msg)}
                          className="text-xs text-gray-400 hover:text-saffron flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      )}
                      <span className="text-xs text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Editing Mode */}
                  {isEditingThis ? (
                    <div className="space-y-3">
                      {showBranchWarning && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                          <div className="flex items-center gap-2 font-medium mb-1">
                            <GitBranch size={14} />
                            Editing will create a new branch
                          </div>
                          <p>All arguments after this message will be removed and the hearing will continue from this edited argument.</p>
                        </div>
                      )}
                      <textarea
                        value={editMessageText}
                        onChange={(e) => setEditMessageText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-saffron focus:border-transparent outline-none"
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEditedMessage(msg.id)}
                          className="flex items-center gap-1 px-4 py-1.5 bg-saffron hover:bg-orange-500 text-white rounded text-sm font-medium"
                        >
                          <Save size={14} /> Save & Continue
                        </button>
                        <button
                          onClick={cancelEditingMessage}
                          className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-800 leading-relaxed text-sm">{msg.text}</p>
                  )}

                  {msg.references && msg.references.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                        <BookOpen size={12} /> Cited:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {msg.references.map((ref, idx) => (
                          <span key={idx} className="text-xs bg-yellow-50 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200">
                            {ref}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Judge's question - Show response option */}
                  {isJudgeMessage && requiresResponse && !hasResponse && !isRespondingToThis && (
                    <div className="mt-3 pt-3 border-t border-legal-200">
                      <button
                        onClick={() => startResponding(msg.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-saffron/10 hover:bg-saffron/20 text-saffron rounded-lg text-sm font-medium transition-colors"
                      >
                        <MessageCircle size={16} />
                        Respond to Court's Query
                      </button>
                    </div>
                  )}

                  {/* Response input box */}
                  {isRespondingToThis && (
                    <div className="mt-3 pt-3 border-t border-legal-200 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-legal-700">
                        <MessageCircle size={14} />
                        Your Response to the Court
                      </div>

                      {/* Text input */}
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Enter your response to the court's query..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-saffron focus:border-saffron outline-none"
                        rows={3}
                      />

                      {/* Attached files display */}
                      {attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {attachedFiles.map(file => (
                            <div
                              key={file.id}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                            >
                              <FileText size={12} />
                              <span className="max-w-[120px] truncate">{file.name}</span>
                              <button
                                onClick={() => removeAttachedFile(file.id)}
                                className="ml-1 hover:text-red-500"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".txt,.pdf,.docx"
                          onChange={handleResponseFileUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingFiles}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {isUploadingFiles ? (
                            <span className="animate-pulse">Uploading...</span>
                          ) : (
                            <>
                              <Paperclip size={12} />
                              Attach Document
                            </>
                          )}
                        </button>

                        <div className="flex-1" />

                        <button
                          onClick={cancelResponding}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSubmitResponse(msg.id, msg.text)}
                          disabled={!responseText.trim() && attachedFiles.length === 0}
                          className="flex items-center gap-1 px-4 py-1.5 bg-saffron hover:bg-orange-500 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <Send size={12} />
                          Submit Response
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Display submitted response */}
                  {hasResponse && (
                    <div className="mt-3 pt-3 border-t border-legal-200">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-green-700 mb-2">
                          <MessageCircle size={12} />
                          Your Response (submitted {new Date(msg.userResponse!.timestamp).toLocaleTimeString()})
                        </div>
                        <p className="text-sm text-green-800">{msg.userResponse!.userResponse}</p>

                        {msg.userResponse!.attachedDocuments && msg.userResponse!.attachedDocuments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-green-200">
                            <div className="flex items-center gap-1 text-xs text-green-600 mb-1">
                              <Paperclip size={10} />
                              Attached Documents:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {msg.userResponse!.attachedDocuments.map(doc => (
                                <span key={doc.id} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                  {doc.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-center py-4">
              <div className="animate-pulse flex flex-col items-center">
                <span className="text-saffron font-medium text-sm">
                  {getNextSpeaker(messages) === project.userSide ? 'AI is preparing your argument...' : 'Opposition is responding...'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-white p-4 border-t border-legal-100 shadow-lg">
        <div className="max-w-3xl mx-auto flex justify-center gap-4">
          {!isPlaying && !isSessionComplete && (
            <button
              onClick={() => handleManualTurn()}
              disabled={loading}
              className="w-full md:w-auto px-8 py-3 bg-legal-900 hover:bg-legal-800 text-white font-medium rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {messages.length === 0
                ? `Start ${project.userSide}'s Opening Argument`
                : getNextSpeaker(messages) === Role.Judge
                ? 'Request Judgment'
                : getNextSpeaker(messages) === project.userSide
                ? 'Generate Your Argument'
                : 'Let Opposition Respond'
              }
            </button>
          )}
          {isSessionComplete && (
            <div className="flex flex-col items-center gap-3">
              <div className="text-center text-legal-600 font-medium">
                Session Concluded. Judgment has been delivered.
              </div>
              {onContinueSession && (
                <button
                  onClick={() => onContinueSession(session)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shadow-md transition-colors"
                >
                  <History size={18} />
                  Continue to Next Hearing
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Document Panel (Right Side) */}
      <HearingDocumentsPanel
        documents={hearingDocuments}
        isOpen={showDocPanel}
        onToggle={() => setShowDocPanel(!showDocPanel)}
        hearingType={hearingTitle}
      />
    </div>
  );
};

export default SimulationRoom;
