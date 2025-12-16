/**
 * Comparison View Component for NyayaSutra
 * Split-screen view comparing Petitioner and Respondent perspectives
 * with synchronized scrolling and color-coded differences
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Split, Link2, Link2Off, Calendar, Target, Briefcase, Scale,
  CheckCircle, AlertTriangle, ChevronDown, ChevronUp, FileText,
  Eye, Columns, Maximize2, Minimize2
} from 'lucide-react';
import { CasePerspective, Role, TimelineEvent, Evidence, DisputedFact } from '../types';

interface ComparisonViewProps {
  petitionerPerspective?: CasePerspective;
  respondentPerspective?: CasePerspective;
  disputedFacts?: DisputedFact[];
  onClose: () => void;
}

type ComparisonSection = 'chronology' | 'keyFacts' | 'evidences' | 'theory' | 'strengths' | 'weaknesses' | 'disputed';

interface SectionState {
  expanded: boolean;
  syncScroll: boolean;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({
  petitionerPerspective,
  respondentPerspective,
  disputedFacts,
  onClose
}) => {
  const [syncScroll, setSyncScroll] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSection, setActiveSection] = useState<ComparisonSection>('chronology');
  const [expandedSections, setExpandedSections] = useState<Record<ComparisonSection, SectionState>>({
    chronology: { expanded: true, syncScroll: true },
    keyFacts: { expanded: true, syncScroll: true },
    evidences: { expanded: false, syncScroll: true },
    theory: { expanded: false, syncScroll: true },
    strengths: { expanded: false, syncScroll: true },
    weaknesses: { expanded: false, syncScroll: true },
    disputed: { expanded: true, syncScroll: true }
  });

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // Synchronized scrolling
  useEffect(() => {
    if (!syncScroll) return;

    const handleLeftScroll = () => {
      if (isScrollingRef.current) return;
      isScrollingRef.current = true;
      if (rightPanelRef.current && leftPanelRef.current) {
        rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop;
      }
      setTimeout(() => { isScrollingRef.current = false; }, 50);
    };

    const handleRightScroll = () => {
      if (isScrollingRef.current) return;
      isScrollingRef.current = true;
      if (leftPanelRef.current && rightPanelRef.current) {
        leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop;
      }
      setTimeout(() => { isScrollingRef.current = false; }, 50);
    };

    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;

    if (leftPanel) leftPanel.addEventListener('scroll', handleLeftScroll);
    if (rightPanel) rightPanel.addEventListener('scroll', handleRightScroll);

    return () => {
      if (leftPanel) leftPanel.removeEventListener('scroll', handleLeftScroll);
      if (rightPanel) rightPanel.removeEventListener('scroll', handleRightScroll);
    };
  }, [syncScroll]);

  const toggleSection = (section: ComparisonSection) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: { ...prev[section], expanded: !prev[section].expanded }
    }));
  };

  // Find matching/conflicting facts between perspectives
  const factAnalysis = useMemo(() => {
    if (!petitionerPerspective || !respondentPerspective) return null;

    const petFacts = new Set(petitionerPerspective.keyFacts.map(f => f.toLowerCase().trim()));
    const resFacts = new Set(respondentPerspective.keyFacts.map(f => f.toLowerCase().trim()));

    const commonFacts: string[] = [];
    const petitionerOnly: string[] = [];
    const respondentOnly: string[] = [];

    petitionerPerspective.keyFacts.forEach(fact => {
      const normalized = fact.toLowerCase().trim();
      // Check for similar facts (not exact match but overlapping)
      const hasMatch = respondentPerspective.keyFacts.some(rf => {
        const rfNorm = rf.toLowerCase().trim();
        return rfNorm === normalized ||
               normalized.includes(rfNorm) ||
               rfNorm.includes(normalized) ||
               calculateSimilarity(normalized, rfNorm) > 0.7;
      });
      if (hasMatch) {
        commonFacts.push(fact);
      } else {
        petitionerOnly.push(fact);
      }
    });

    respondentPerspective.keyFacts.forEach(fact => {
      const normalized = fact.toLowerCase().trim();
      const hasMatch = petitionerPerspective.keyFacts.some(pf => {
        const pfNorm = pf.toLowerCase().trim();
        return pfNorm === normalized ||
               normalized.includes(pfNorm) ||
               pfNorm.includes(normalized) ||
               calculateSimilarity(normalized, pfNorm) > 0.7;
      });
      if (!hasMatch) {
        respondentOnly.push(fact);
      }
    });

    return { commonFacts, petitionerOnly, respondentOnly };
  }, [petitionerPerspective, respondentPerspective]);

  // Simple word-based similarity calculation
  function calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 3));
    if (words1.size === 0 || words2.size === 0) return 0;

    let intersection = 0;
    words1.forEach(w => { if (words2.has(w)) intersection++; });
    return intersection / Math.min(words1.size, words2.size);
  }

  const renderChronologyComparison = () => {
    const petChron = petitionerPerspective?.chronology || [];
    const resChron = respondentPerspective?.chronology || [];
    const maxLength = Math.max(petChron.length, resChron.length);

    return (
      <div className="space-y-2">
        {Array.from({ length: maxLength }).map((_, index) => (
          <div key={index} className="grid grid-cols-2 gap-4">
            {/* Petitioner Event */}
            <div className={`p-3 rounded-lg border ${
              petChron[index] ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
            }`}>
              {petChron[index] ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    {petChron[index].date && (
                      <span className="text-xs text-blue-600 font-medium">{petChron[index].date}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800">{petChron[index].description}</p>
                  <p className="text-xs text-gray-500 mt-1 italic">{petChron[index].significance}</p>
                  {petChron[index].source && (
                    <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                      <FileText size={10} /> {petChron[index].source}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-4">No corresponding event</p>
              )}
            </div>

            {/* Respondent Event */}
            <div className={`p-3 rounded-lg border ${
              resChron[index] ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
            }`}>
              {resChron[index] ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    {resChron[index].date && (
                      <span className="text-xs text-orange-600 font-medium">{resChron[index].date}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800">{resChron[index].description}</p>
                  <p className="text-xs text-gray-500 mt-1 italic">{resChron[index].significance}</p>
                  {resChron[index].source && (
                    <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                      <FileText size={10} /> {resChron[index].source}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-4">No corresponding event</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFactsComparison = () => {
    if (!factAnalysis) return null;

    return (
      <div className="space-y-4">
        {/* Common Facts */}
        {factAnalysis.commonFacts.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle size={14} />
              Common/Agreed Facts ({factAnalysis.commonFacts.length})
            </h4>
            <ul className="space-y-1">
              {factAnalysis.commonFacts.map((fact, i) => (
                <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Split View for Unique Facts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              Petitioner's Unique Facts ({factAnalysis.petitionerOnly.length})
            </h4>
            {factAnalysis.petitionerOnly.length > 0 ? (
              <ul className="space-y-1">
                {factAnalysis.petitionerOnly.map((fact, i) => (
                  <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    {fact}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-blue-400 italic">All facts are common</p>
            )}
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-orange-800 mb-2">
              Respondent's Unique Facts ({factAnalysis.respondentOnly.length})
            </h4>
            {factAnalysis.respondentOnly.length > 0 ? (
              <ul className="space-y-1">
                {factAnalysis.respondentOnly.map((fact, i) => (
                  <li key={i} className="text-sm text-orange-700 flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5">•</span>
                    {fact}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-orange-400 italic">All facts are common</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderEvidenceComparison = () => {
    const petEvidence = petitionerPerspective?.evidences || [];
    const resEvidence = respondentPerspective?.evidences || [];

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            Petitioner's Evidence ({petEvidence.length})
          </h4>
          {petEvidence.map((ev) => (
            <div key={ev.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start justify-between mb-1">
                <h5 className="text-sm font-medium text-gray-800">{ev.title}</h5>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{ev.type}</span>
              </div>
              <p className="text-xs text-gray-600">{ev.description}</p>
              <p className="text-xs text-blue-600 mt-1">{ev.relevance}</p>
            </div>
          ))}
          {petEvidence.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-4">No evidence</p>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-orange-800 mb-2">
            Respondent's Evidence ({resEvidence.length})
          </h4>
          {resEvidence.map((ev) => (
            <div key={ev.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start justify-between mb-1">
                <h5 className="text-sm font-medium text-gray-800">{ev.title}</h5>
                <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700">{ev.type}</span>
              </div>
              <p className="text-xs text-gray-600">{ev.description}</p>
              <p className="text-xs text-orange-600 mt-1">{ev.relevance}</p>
            </div>
          ))}
          {resEvidence.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-4">No evidence</p>
          )}
        </div>
      </div>
    );
  };

  const renderTheoryComparison = () => {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Petitioner's Legal Theory</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {petitionerPerspective?.legalTheory || 'Not available'}
          </p>
        </div>
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h4 className="text-sm font-medium text-orange-800 mb-2">Respondent's Legal Theory</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {respondentPerspective?.legalTheory || 'Not available'}
          </p>
        </div>
      </div>
    );
  };

  const renderStrengthsWeaknessesComparison = (type: 'strengths' | 'weaknesses') => {
    const petItems = type === 'strengths'
      ? petitionerPerspective?.strengths || []
      : petitionerPerspective?.weaknesses || [];
    const resItems = type === 'strengths'
      ? respondentPerspective?.strengths || []
      : respondentPerspective?.weaknesses || [];

    const bgColor = type === 'strengths' ? 'green' : 'red';
    const Icon = type === 'strengths' ? CheckCircle : AlertTriangle;

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className={`p-4 bg-${bgColor}-50 border border-${bgColor}-200 rounded-lg`}>
          <h4 className={`text-sm font-medium text-${bgColor}-800 mb-2 flex items-center gap-2`}>
            <Icon size={14} />
            Petitioner's {type === 'strengths' ? 'Strengths' : 'Weaknesses'}
          </h4>
          <ul className="space-y-1">
            {petItems.map((item, i) => (
              <li key={i} className={`text-sm text-${bgColor}-700 flex items-start gap-2`}>
                <span className={`text-${bgColor}-500 mt-0.5`}>{type === 'strengths' ? '+' : '-'}</span>
                {item}
              </li>
            ))}
            {petItems.length === 0 && (
              <li className="text-sm text-gray-400 italic">None identified</li>
            )}
          </ul>
        </div>
        <div className={`p-4 bg-${bgColor}-50 border border-${bgColor}-200 rounded-lg`}>
          <h4 className={`text-sm font-medium text-${bgColor}-800 mb-2 flex items-center gap-2`}>
            <Icon size={14} />
            Respondent's {type === 'strengths' ? 'Strengths' : 'Weaknesses'}
          </h4>
          <ul className="space-y-1">
            {resItems.map((item, i) => (
              <li key={i} className={`text-sm text-${bgColor}-700 flex items-start gap-2`}>
                <span className={`text-${bgColor}-500 mt-0.5`}>{type === 'strengths' ? '+' : '-'}</span>
                {item}
              </li>
            ))}
            {resItems.length === 0 && (
              <li className="text-sm text-gray-400 italic">None identified</li>
            )}
          </ul>
        </div>
      </div>
    );
  };

  const renderDisputedFactsSection = () => {
    if (!disputedFacts || disputedFacts.length === 0) {
      return (
        <div className="text-center py-8 text-gray-400">
          <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No disputed facts identified</p>
          <p className="text-xs mt-1">Generate both perspectives to identify disputes</p>
        </div>
      );
    }

    const getImportanceBadge = (level: DisputedFact['importanceLevel']) => {
      switch (level) {
        case 'critical': return 'bg-red-100 text-red-700';
        case 'significant': return 'bg-yellow-100 text-yellow-700';
        default: return 'bg-gray-100 text-gray-700';
      }
    };

    const getTypeBadge = (type: DisputedFact['disputeType']) => {
      switch (type) {
        case 'contradiction': return 'bg-red-50 text-red-600';
        case 'omission': return 'bg-purple-50 text-purple-600';
        default: return 'bg-blue-50 text-blue-600';
      }
    };

    return (
      <div className="space-y-4">
        {disputedFacts.map((df) => (
          <div key={df.id} className="border border-yellow-200 bg-yellow-50/50 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-yellow-200 bg-yellow-100/50">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-800">{df.fact}</h4>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getTypeBadge(df.disputeType)}`}>
                    {df.disputeType}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getImportanceBadge(df.importanceLevel)}`}>
                    {df.importanceLevel}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-yellow-200">
              <div className="p-3">
                <h5 className="text-xs font-medium text-blue-700 mb-1">Petitioner's Version:</h5>
                <p className="text-sm text-gray-700">{df.petitionerVersion}</p>
              </div>
              <div className="p-3">
                <h5 className="text-xs font-medium text-orange-700 mb-1">Respondent's Version:</h5>
                <p className="text-sm text-gray-700">{df.respondentVersion}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const sections: { key: ComparisonSection; label: string; icon: React.ReactNode }[] = [
    { key: 'chronology', label: 'Chronology', icon: <Calendar size={16} /> },
    { key: 'keyFacts', label: 'Key Facts', icon: <Target size={16} /> },
    { key: 'evidences', label: 'Evidence', icon: <Briefcase size={16} /> },
    { key: 'theory', label: 'Legal Theory', icon: <Scale size={16} /> },
    { key: 'strengths', label: 'Strengths', icon: <CheckCircle size={16} /> },
    { key: 'weaknesses', label: 'Weaknesses', icon: <AlertTriangle size={16} /> },
    { key: 'disputed', label: 'Disputed Facts', icon: <Scale size={16} /> }
  ];

  if (!petitionerPerspective && !respondentPerspective) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Columns size={48} className="mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">No perspectives available for comparison</p>
        <p className="text-sm text-gray-400 mt-1">Generate both perspectives first</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${
      isFullscreen ? 'fixed inset-4 z-50' : ''
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold text-legal-900 flex items-center gap-2">
            <Columns size={18} />
            Perspective Comparison
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSyncScroll(!syncScroll)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                syncScroll
                  ? 'bg-saffron text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={syncScroll ? 'Synchronized scrolling ON' : 'Synchronized scrolling OFF'}
            >
              {syncScroll ? <Link2 size={12} /> : <Link2Off size={12} />}
              Sync Scroll
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-2">
          {sections.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                activeSection === key
                  ? 'bg-saffron text-white'
                  : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-2 divide-x divide-gray-200 bg-gray-100">
        <div className="px-4 py-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-blue-800">Petitioner</span>
        </div>
        <div className="px-4 py-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-sm font-medium text-orange-800">Respondent</span>
        </div>
      </div>

      {/* Content */}
      <div className={`p-4 overflow-y-auto ${isFullscreen ? 'max-h-[calc(100vh-200px)]' : 'max-h-[600px]'}`}>
        {activeSection === 'chronology' && renderChronologyComparison()}
        {activeSection === 'keyFacts' && renderFactsComparison()}
        {activeSection === 'evidences' && renderEvidenceComparison()}
        {activeSection === 'theory' && renderTheoryComparison()}
        {activeSection === 'strengths' && renderStrengthsWeaknessesComparison('strengths')}
        {activeSection === 'weaknesses' && renderStrengthsWeaknessesComparison('weaknesses')}
        {activeSection === 'disputed' && renderDisputedFactsSection()}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>
              Chronology: {petitionerPerspective?.chronology.length || 0} / {respondentPerspective?.chronology.length || 0}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Target size={12} />
            <span>
              Facts: {petitionerPerspective?.keyFacts.length || 0} / {respondentPerspective?.keyFacts.length || 0}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Briefcase size={12} />
            <span>
              Evidence: {petitionerPerspective?.evidences?.length || 0} / {respondentPerspective?.evidences?.length || 0}
            </span>
          </div>
          {disputedFacts && disputedFacts.length > 0 && (
            <div className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle size={12} />
              <span>{disputedFacts.length} disputed facts</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonView;
