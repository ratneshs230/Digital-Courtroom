export enum Role {
  Petitioner = 'Petitioner',
  Respondent = 'Respondent',
  Judge = 'Judge'
}

export enum FileType {
  PDF = 'application/pdf',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT = 'text/plain'
}

// Document categories for organization
export enum DocumentCategory {
  FIR = 'FIR',
  Affidavit = 'Affidavit',
  Evidence = 'Evidence',
  CourtProceeding = 'Court Proceeding',
  CourtOrder = 'Court Order',
  Judgment = 'Judgment',
  Petition = 'Petition',
  Reply = 'Reply/Written Statement',
  Witness = 'Witness Statement',
  ChargeSheet = 'Charge Sheet',
  MedicalReport = 'Medical Report',
  ForensicReport = 'Forensic Report',
  LegalOpinion = 'Legal Opinion',
  Other = 'Other'
}

// Document metadata for context
export interface DocumentMetadata {
  category: DocumentCategory;
  date?: string; // Document date
  filedBy?: string; // Who filed/submitted this document
  courtName?: string; // Which court
  caseNumber?: string; // Case reference number
  description?: string; // User's description of what this document contains
  contextNotes?: string; // Important context notes for AI understanding
  parties?: string[]; // Parties mentioned in this document
  suggestedName?: string; // AI-suggested document name
  deepAnalysis?: DocumentDeepAnalysis; // Deep analysis by AI
}

// Deep analysis of a document
export interface DocumentDeepAnalysis {
  documentType: string; // Type of legal document
  summary: string; // Brief summary of contents
  keyPoints: string[]; // Key points in the document
  legalSections?: string[]; // Legal sections/laws referenced
  datesMentioned?: string[]; // Important dates mentioned
  partiesInvolved?: string[]; // Parties mentioned
  reliefSought?: string; // What relief/action is being sought
  currentStatus?: string; // Status of matter in this document
  importantQuotes?: string[]; // Important quotes from document
  analysisNotes?: string; // AI's analysis notes
}

export interface CaseFile {
  id: string;
  name: string;
  type: string;
  content: string;
  metadata?: DocumentMetadata;
  uploadedAt?: number;
}

// Document relationship types
export type DocumentRelationshipType =
  | 'response_to'      // Reply or written statement responding to a petition
  | 'exhibit_of'       // Exhibit attached to a main document
  | 'appeal_of'        // Appeal against a lower court order/judgment
  | 'amendment_to'     // Amendment to an earlier document
  | 'supersedes'       // Supersedes an earlier document
  | 'references'       // References another document
  | 'related';         // Generally related

export interface DocumentRelationship {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  relationshipType: DocumentRelationshipType;
  description?: string;
  createdAt: number;
}

// Timeline event for chronology
export interface TimelineEvent {
  id: string;
  date?: string;
  description: string;
  source?: string;
  significance: string;
  order: number;
}

// Evidence item identified from documents
export interface Evidence {
  id: string;
  title: string;
  description: string;
  sourceDocument: string;
  relevance: string;
  supportingQuote?: string;
  type: 'documentary' | 'testimonial' | 'circumstantial' | 'physical' | 'other';
}

// Enhanced precedent citation with validation
export interface PrecedentCitation {
  id: string;
  citation: string;           // Full citation string e.g., "AIR 2020 SC 1234"
  caseName: string;           // Case name e.g., "Vishakha v. State of Rajasthan"
  court: string;              // Court e.g., "Supreme Court", "Delhi High Court"
  year: string;               // Year of judgment
  citationFormat: string;     // Format type: AIR, SCC, SCALE, etc.
  relevantPrinciple: string;  // The legal principle from this case
  howItApplies: string;       // How it applies to current case
  isRatioDecidendi: boolean;  // True if ratio decidendi, false if obiter dicta
  bindingOn: 'all_courts' | 'high_courts' | 'district_courts' | 'persuasive_only';
  sourceDocument?: string;    // Document where this citation was found
  isValidated: boolean;       // Whether citation format was validated
}

// Disputed fact between parties
export interface DisputedFact {
  id: string;
  fact: string;
  petitionerVersion: string;
  respondentVersion: string;
  disputeType: 'contradiction' | 'omission' | 'interpretation';
  importanceLevel: 'critical' | 'significant' | 'minor';
  relatedEvidence?: string[];
  relatedDocuments?: string[];
}

// Draft analysis from a single document
export interface DocumentDraft {
  id: string;
  documentId: string;
  documentName: string;
  role: Role.Petitioner | Role.Respondent;
  summary: string;
  extractedFacts: string[];
  extractedEvents: TimelineEvent[];
  extractedEvidences: Evidence[];
  legalImplications: string[];
  analyzedAt: number;
}

// Chat message between user and perspective agent
export interface PerspectiveChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
  updatesApplied?: string[]; // What was updated based on this message
  attachedFiles?: CaseFile[]; // Files attached with this message
}

// Perspective from one side (Petitioner or Respondent)
export interface CasePerspective {
  role: Role.Petitioner | Role.Respondent;
  chronology: TimelineEvent[];
  keyFacts: string[];
  evidences: Evidence[];
  legalTheory: string;
  strengths: string[];
  weaknesses: string[];
  generatedAt: number;
  isEdited: boolean;

  // Document-by-document analysis drafts
  documentDrafts: DocumentDraft[];

  // Chat history with user
  chatHistory: PerspectiveChatMessage[];

  // Enhanced precedent citations
  precedentCitations?: PrecedentCitation[];
}

// Session hearing documents (recent developments)
export interface HearingDocument {
  id: string;
  name: string;
  type: string;
  content: string;
  uploadedAt: number;
}

// User's strategy/intent for a session
export interface SessionStrategy {
  intent: string;
  keyPoints: string[];
}

export interface Project {
  id: string;
  name: string;
  caseTitle: string;
  description: string;
  userSide: Role.Petitioner | Role.Respondent;
  files: CaseFile[];
  createdAt: number;

  // Dual perspectives from AI analysis
  petitionerPerspective?: CasePerspective;
  respondentPerspective?: CasePerspective;

  // Disputed facts identified between perspectives
  disputedFacts?: DisputedFact[];

  // Document relationships
  documentRelationships?: DocumentRelationship[];

  // Attached archives (case laws, judgments for AI reference)
  attachedArchiveIds?: string[];

  // Analysis status
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'error';
  analysisError?: string;

  // Legacy field for backward compatibility
  legalContext?: string;
}

// User's response to judgment (when judge asks questions)
export interface JudgmentResponse {
  id: string;
  questionFromJudge: string;
  userResponse: string;
  attachedDocuments?: CaseFile[];
  timestamp: number;
}

export interface SimulationMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  references?: string[];

  // Track if AI generated for user's side
  isUserSideAI?: boolean;
  strategyUsed?: string;

  // For judge messages that require user response
  requiresResponse?: boolean;
  userResponse?: JudgmentResponse;

  // For message editing/branching
  isEdited?: boolean;
  originalText?: string; // Original text before edit
  editedAt?: number;
  branchId?: string; // If this message is part of a branch
}

export interface Session {
  id: string;
  projectId: string;

  // Hearing details
  hearingType: string;
  hearingDescription?: string;

  maxTurns: number;
  currentTurnCount: number;
  status: 'pending' | 'active' | 'completed';
  messages: SimulationMessage[];
  verdict?: string;
  createdAt: number;

  // Session-specific documents (recent developments)
  recentDevelopments: HearingDocument[];

  // User's strategy for this hearing
  userStrategy: SessionStrategy;

  // Who starts (always user's side)
  firstSpeaker: Role.Petitioner | Role.Respondent;

  // Continuation session support
  parentSessionId?: string; // ID of the session this continues from
  isContinuation?: boolean; // Whether this is a continuation session
  continuationOrder?: number; // Order in the continuation chain (0 = original, 1 = first continuation, etc.)

  // For branching (when user edits a message)
  branchFromMessageId?: string; // If this is a branched session, which message it branched from
  branchId?: string; // Unique ID for this branch

  // Legacy field for backward compatibility
  selectedFileIds?: string[];
  reason?: string;
}

// Archive categories for case laws and judgments
export enum ArchiveCategory {
  SupremeCourtJudgment = 'Supreme Court Judgment',
  HighCourtJudgment = 'High Court Judgment',
  DistrictCourtJudgment = 'District Court Judgment',
  TribunalOrder = 'Tribunal Order',
  CaseLaw = 'Case Law',
  StatutoryProvision = 'Statutory Provision',
  LegalArticle = 'Legal Article',
  CircularNotification = 'Circular/Notification',
  Other = 'Other'
}

// Individual document in an archive
export interface ArchiveDocument {
  id: string;
  name: string;
  type: string; // MIME type
  content: string; // Full text content
  category: ArchiveCategory;
  citation?: string; // e.g., "AIR 2020 SC 1234"
  court?: string; // Court name
  year?: string; // Year of judgment
  parties?: string; // e.g., "State of Maharashtra vs. XYZ"
  summary?: string; // Brief summary
  keyPrinciples?: string[]; // Key legal principles established
  sectionsReferenced?: string[]; // Sections of law referenced
  uploadedAt: number;
  lastAccessedAt?: number;
}

// Archive collection
export interface Archive {
  id: string;
  name: string;
  description?: string;
  documents: ArchiveDocument[];
  createdAt: number;
  updatedAt: number;
  // Stats
  documentCount: number;
}
