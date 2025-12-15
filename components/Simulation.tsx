import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Mic2, Pause, Play, User, UserCheck, Gavel, BookOpen } from 'lucide-react';
import { Project, Session, Role, SimulationMessage } from '../types';
import { generateTurn } from '../services/geminiService';

interface SimulationRoomProps {
  session: Session;
  project: Project;
  onBack: () => void;
}

const SimulationRoom: React.FC<SimulationRoomProps> = ({ session, project, onBack }) => {
  const [messages, setMessages] = useState<SimulationMessage[]>(session.messages || []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(session.currentTurnCount);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine whose turn it is
  const getNextSpeaker = (history: SimulationMessage[]): Role => {
    if (history.length === 0) return Role.Petitioner; // Default start
    const lastRole = history[history.length - 1].role;
    
    // Simple round robin: Petitioner -> Respondent -> Petitioner...
    // Judge interjects only at the end
    if (turnCount >= session.maxTurns) return Role.Judge;
    
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
      timestamp: Date.now()
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
    // In a real app, API call. Here, localStorage update.
    const savedSessions = localStorage.getItem(`sessions_${project.id}`);
    if (savedSessions) {
      const allSessions: Session[] = JSON.parse(savedSessions);
      const updatedSessions = allSessions.map(s => 
        s.id === session.id 
          ? { ...s, messages: msgs, currentTurnCount: count, status: count >= session.maxTurns ? 'completed' : 'active' } 
          : s
      );
      localStorage.setItem(`sessions_${project.id}`, JSON.stringify(updatedSessions));
    }
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
        // Stop if judge has spoken (end of session)
        if (messages.length > 0 && messages[messages.length - 1].role === Role.Judge) {
            setIsPlaying(false);
            return;
        }

        interval = setInterval(() => {
            handleManualTurn();
        }, 4000); // 4 seconds delay between turns for reading
    }
    return () => clearInterval(interval);
  }, [isPlaying, loading, turnCount, messages]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  // Avatar Component
  const Avatar = ({ role, isActive }: { role: Role, isActive: boolean }) => {
    const isPetitioner = role === Role.Petitioner;
    const isJudge = role === Role.Judge;
    
    return (
      <div className={`flex flex-col items-center transition-all duration-500 ${isActive ? 'scale-110 opacity-100' : 'scale-100 opacity-60'}`}>
        <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center bg-white shadow-xl relative
          ${isActive ? 'border-saffron' : 'border-gray-200'}
        `}>
          {isJudge ? (
            <Gavel size={40} className="text-legal-900" />
          ) : (
            <User size={40} className={isPetitioner ? 'text-blue-600' : 'text-red-600'} />
          )}
          
          {isActive && loading && (
            <div className="absolute inset-0 rounded-full border-4 border-saffron border-t-transparent animate-spin"></div>
          )}
        </div>
        <div className={`mt-3 px-4 py-1 rounded-full text-sm font-bold shadow-sm ${
          isActive ? 'bg-legal-900 text-white' : 'bg-gray-100 text-gray-500'
        }`}>
          {role}
        </div>
      </div>
    );
  };

  const isSessionComplete = messages.some(m => m.role === Role.Judge);

  return (
    <div className="h-full flex flex-col bg-legal-50">
      {/* Simulation Header */}
      <div className="bg-white border-b border-legal-100 p-4 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="text-gray-600" />
          </button>
          <div>
            <h2 className="font-serif font-bold text-legal-900">Session: {session.reason}</h2>
            <p className="text-xs text-gray-500">Turn {Math.min(turnCount, session.maxTurns)} / {session.maxTurns}</p>
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

      {/* Visual Stage */}
      <div className="bg-legal-200 h-64 relative flex items-center justify-center border-b border-legal-300 overflow-hidden flex-shrink-0">
        {/* Background elements to look like a court */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-10"></div>
        <div className="absolute top-10 left-1/2 -translate-x-1/2">
             <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" className="h-16 opacity-20" alt="Emblem" />
        </div>

        <div className="relative z-10 flex w-full max-w-4xl justify-between px-10 items-end pb-8">
           {/* Petitioner */}
           <Avatar role={Role.Petitioner} isActive={loading && getNextSpeaker(messages) === Role.Petitioner} />
           
           {/* Judge (Top Center roughly) */}
           <div className="mb-12">
            <Avatar role={Role.Judge} isActive={loading && getNextSpeaker(messages) === Role.Judge} />
           </div>
           
           {/* Respondent */}
           <Avatar role={Role.Respondent} isActive={loading && getNextSpeaker(messages) === Role.Respondent} />
        </div>
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-10 italic">
              The court is in session. Select a speaker to begin arguments.
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === Role.Respondent ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white
                ${msg.role === Role.Petitioner ? 'bg-blue-600' : msg.role === Role.Respondent ? 'bg-red-600' : 'bg-legal-900'}
              `}>
                {msg.role[0]}
              </div>
              
              <div className={`flex-1 max-w-[80%] rounded-2xl p-4 shadow-sm ${
                msg.role === Role.Judge 
                  ? 'bg-legal-100 border-2 border-legal-200' 
                  : 'bg-white border border-gray-100'
              }`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-gray-700">{msg.role}</span>
                  <span className="text-xs text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-gray-800 leading-relaxed text-sm md:text-base">{msg.text}</p>
                
                {msg.references && msg.references.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                      <BookOpen size={12} /> Cited:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {msg.references.map((ref, idx) => (
                        <span key={idx} className="text-xs bg-yellow-50 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200">
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
             <div className="flex justify-center py-4">
               <div className="animate-pulse flex flex-col items-center">
                 <span className="text-saffron font-medium text-sm">AI is thinking...</span>
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
               {messages.length === 0 ? 'Start Opening Statement' : 'Generate Next Argument'}
             </button>
          )}
          {isSessionComplete && (
             <div className="text-center text-legal-600 font-medium">
                Session Concluded. Judgment has been delivered.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimulationRoom;