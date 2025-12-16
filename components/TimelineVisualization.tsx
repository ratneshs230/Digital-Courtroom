/**
 * Timeline Visualization Component for NyayaSutra
 * Displays case chronology with visual timeline, color-coded by source
 */

import React, { useState, useMemo } from 'react';
import { Calendar, FileText, ZoomIn, ZoomOut, Filter, ChevronDown, ChevronUp, Clock, MapPin } from 'lucide-react';
import { TimelineEvent, CasePerspective, Role } from '../types';
import { parseDate, compareDates, formatForChronology } from '../utils/dateParser';

interface TimelineVisualizationProps {
  petitionerPerspective?: CasePerspective;
  respondentPerspective?: CasePerspective;
  onEventClick?: (event: TimelineEvent, perspective: Role) => void;
}

// Color palette for different document sources
const SOURCE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'FIR': { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' },
  'Petition': { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
  'Court Order': { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700' },
  'Judgment': { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700' },
  'Evidence': { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' },
  'Affidavit': { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700' },
  'Witness': { bg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-700' },
  'default': { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700' }
};

interface ProcessedEvent extends TimelineEvent {
  perspective: Role;
  parsedDate: ReturnType<typeof parseDate>;
  colorScheme: typeof SOURCE_COLORS[string];
}

const TimelineVisualization: React.FC<TimelineVisualizationProps> = ({
  petitionerPerspective,
  respondentPerspective,
  onEventClick
}) => {
  const [zoomLevel, setZoomLevel] = useState<'compact' | 'normal' | 'expanded'>('normal');
  const [filterSource, setFilterSource] = useState<string | 'all'>('all');
  const [filterPerspective, setFilterPerspective] = useState<'all' | 'petitioner' | 'respondent'>('all');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Get color scheme for a source
  const getColorScheme = (source?: string) => {
    if (!source) return SOURCE_COLORS.default;
    const key = Object.keys(SOURCE_COLORS).find(k =>
      source.toLowerCase().includes(k.toLowerCase())
    );
    return key ? SOURCE_COLORS[key] : SOURCE_COLORS.default;
  };

  // Process and merge events from both perspectives
  const processedEvents = useMemo(() => {
    const events: ProcessedEvent[] = [];

    // Add petitioner events
    if (petitionerPerspective) {
      petitionerPerspective.chronology.forEach(event => {
        events.push({
          ...event,
          perspective: Role.Petitioner,
          parsedDate: parseDate(event.date || ''),
          colorScheme: getColorScheme(event.source)
        });
      });
    }

    // Add respondent events
    if (respondentPerspective) {
      respondentPerspective.chronology.forEach(event => {
        events.push({
          ...event,
          perspective: Role.Respondent,
          parsedDate: parseDate(event.date || ''),
          colorScheme: getColorScheme(event.source)
        });
      });
    }

    // Sort by date
    events.sort((a, b) => compareDates(a.parsedDate, b.parsedDate));

    return events;
  }, [petitionerPerspective, respondentPerspective]);

  // Get unique sources for filtering
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    processedEvents.forEach(e => {
      if (e.source) sources.add(e.source);
    });
    return Array.from(sources);
  }, [processedEvents]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return processedEvents.filter(event => {
      if (filterSource !== 'all' && event.source !== filterSource) return false;
      if (filterPerspective === 'petitioner' && event.perspective !== Role.Petitioner) return false;
      if (filterPerspective === 'respondent' && event.perspective !== Role.Respondent) return false;
      return true;
    });
  }, [processedEvents, filterSource, filterPerspective]);

  // Group events by year/month for timeline clusters
  const groupedEvents = useMemo(() => {
    const groups: Map<string, ProcessedEvent[]> = new Map();

    filteredEvents.forEach(event => {
      const key = event.parsedDate.year
        ? `${event.parsedDate.year}${event.parsedDate.month ? `-${String(event.parsedDate.month).padStart(2, '0')}` : ''}`
        : 'unknown';

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    });

    return groups;
  }, [filteredEvents]);

  const getEventSize = () => {
    switch (zoomLevel) {
      case 'compact': return 'py-2 px-3';
      case 'expanded': return 'py-4 px-4';
      default: return 'py-3 px-3';
    }
  };

  if (!petitionerPerspective && !respondentPerspective) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Calendar size={48} className="mx-auto mb-4 opacity-50" />
        <p>No timeline data available</p>
        <p className="text-sm">Generate case perspectives to view the timeline</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header with controls */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold text-legal-900 flex items-center gap-2">
            <Clock size={18} />
            Case Timeline
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{filteredEvents.length} events</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setZoomLevel('compact')}
              className={`p-1.5 rounded ${zoomLevel === 'compact' ? 'bg-saffron text-white' : 'hover:bg-gray-100'}`}
              title="Compact view"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => setZoomLevel('normal')}
              className={`p-1.5 rounded ${zoomLevel === 'normal' ? 'bg-saffron text-white' : 'hover:bg-gray-100'}`}
              title="Normal view"
            >
              <Calendar size={14} />
            </button>
            <button
              onClick={() => setZoomLevel('expanded')}
              className={`p-1.5 rounded ${zoomLevel === 'expanded' ? 'bg-saffron text-white' : 'hover:bg-gray-100'}`}
              title="Expanded view"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Perspective filter */}
          <select
            value={filterPerspective}
            onChange={(e) => setFilterPerspective(e.target.value as typeof filterPerspective)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-1 focus:ring-saffron outline-none"
          >
            <option value="all">All Perspectives</option>
            <option value="petitioner">Petitioner Only</option>
            <option value="respondent">Respondent Only</option>
          </select>

          {/* Source filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-1 focus:ring-saffron outline-none"
          >
            <option value="all">All Sources</option>
            {uniqueSources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline content */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Filter size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events match your filters</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-saffron via-indiaGreen to-saffron" />

            {/* Events */}
            <div className="space-y-4 ml-10">
              {filteredEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={`relative ${getEventSize()} rounded-lg border transition-all cursor-pointer
                    ${event.colorScheme.bg} ${event.colorScheme.border}
                    ${expandedEventId === event.id ? 'ring-2 ring-saffron ring-offset-2' : 'hover:shadow-md'}
                  `}
                  onClick={() => {
                    setExpandedEventId(expandedEventId === event.id ? null : event.id);
                    onEventClick?.(event, event.perspective);
                  }}
                >
                  {/* Timeline dot */}
                  <div className={`absolute -left-[34px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow
                    ${event.perspective === Role.Petitioner ? 'bg-blue-500' : 'bg-orange-500'}
                  `} />

                  {/* Event content */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Date and perspective badge */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${event.colorScheme.text}`}>
                          {formatForChronology(event.date || '')}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          event.perspective === Role.Petitioner
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {event.perspective}
                        </span>
                        {event.parsedDate.confidence === 'low' && (
                          <span className="text-[10px] text-gray-400">(approx.)</span>
                        )}
                      </div>

                      {/* Description */}
                      <p className={`text-sm text-gray-800 ${
                        zoomLevel === 'compact' && expandedEventId !== event.id ? 'line-clamp-1' : ''
                      }`}>
                        {event.description}
                      </p>

                      {/* Expanded details */}
                      {(expandedEventId === event.id || zoomLevel === 'expanded') && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-gray-600">
                            <strong>Significance:</strong> {event.significance}
                          </p>
                          {event.source && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <FileText size={10} />
                              Source: {event.source}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expand indicator */}
                    {zoomLevel !== 'expanded' && (
                      <button className="flex-shrink-0 p-1 hover:bg-white/50 rounded">
                        {expandedEventId === event.id ? (
                          <ChevronUp size={14} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={14} className="text-gray-400" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-gray-100 bg-gray-50">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-gray-500">Legend:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Petitioner</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Respondent</span>
          </div>
          <span className="text-gray-300">|</span>
          {Object.entries(SOURCE_COLORS).slice(0, 4).map(([key, colors]) => (
            key !== 'default' && (
              <div key={key} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${colors.bg} ${colors.border} border`} />
                <span>{key}</span>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimelineVisualization;
