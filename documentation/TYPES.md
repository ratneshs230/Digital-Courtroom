# Types & Interfaces Reference

**Location**: `./types.ts`

## Enums

### Role
```typescript
export enum Role {
  Petitioner = 'Petitioner',
  Respondent = 'Respondent',
  Judge = 'Judge'
}
```
Represents parties in a court case.

---

### FileType
```typescript
export enum FileType {
  PDF = 'application/pdf',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT = 'text/plain'
}
```
MIME types for supported document formats.

---

### DocumentCategory
```typescript
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
```
Categories for classifying legal documents.

---

## Core Interfaces

### Project
```typescript
export interface Project {
  id: string;
  name: string;
  caseTitle: string;
  description: string;
  userSide: Role.Petitioner | Role.Respondent;
  files: CaseFile[];
  createdAt: number;

  // AI Analysis
  petitionerPerspective?: CasePerspective;
  respondentPerspective?: CasePerspective;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'error';
  analysisError?: string;

  // Legacy
  legalContext?: string;
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (generated) |
| `name` | User-defined project name |
| `caseTitle` | Official case title |
| `description` | Case description/background |
| `userSide` | Which side user represents |
| `files` | Uploaded case documents |
| `petitionerPerspective` | AI analysis for petitioner |
| `respondentPerspective` | AI analysis for respondent |
| `analysisStatus` | Current analysis state |

---

### CaseFile
```typescript
export interface CaseFile {
  id: string;
  name: string;
  type: string;
  content: string;
  metadata?: DocumentMetadata;
  uploadedAt?: number;
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique file identifier |
| `name` | Display name (may be AI-suggested) |
| `type` | MIME type |
| `content` | Extracted text content |
| `metadata` | AI-extracted metadata |
| `uploadedAt` | Upload timestamp |

---

### DocumentMetadata
```typescript
export interface DocumentMetadata {
  category: DocumentCategory;
  date?: string;
  filedBy?: string;
  courtName?: string;
  caseNumber?: string;
  description?: string;
  contextNotes?: string;
  parties?: string[];
  suggestedName?: string;
  deepAnalysis?: DocumentDeepAnalysis;
}
```

| Field | Description |
|-------|-------------|
| `category` | Document classification |
| `date` | Document date (e.g., "15 March 2024") |
| `filedBy` | Filing party |
| `courtName` | Court where filed |
| `caseNumber` | Case reference number |
| `description` | Brief description |
| `contextNotes` | AI context notes for interpretation |
| `parties` | Parties mentioned |
| `suggestedName` | AI-suggested filename |
| `deepAnalysis` | Detailed AI analysis |

---

### DocumentDeepAnalysis
```typescript
export interface DocumentDeepAnalysis {
  documentType: string;
  summary: string;
  keyPoints: string[];
  legalSections?: string[];
  datesMentioned?: string[];
  partiesInvolved?: string[];
  reliefSought?: string;
  currentStatus?: string;
  importantQuotes?: string[];
  analysisNotes?: string;
}
```

| Field | Description |
|-------|-------------|
| `documentType` | Specific document type |
| `summary` | 3-5 sentence summary |
| `keyPoints` | Key takeaways |
| `legalSections` | Legal sections referenced (e.g., "Section 302 IPC") |
| `datesMentioned` | Important dates in document |
| `partiesInvolved` | Parties with their roles |
| `reliefSought` | Relief/action sought |
| `currentStatus` | Matter status per document |
| `importantQuotes` | Significant quotes |
| `analysisNotes` | AI interpretation notes |

---

## Perspective Interfaces

### CasePerspective
```typescript
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
  documentDrafts: DocumentDraft[];
  chatHistory: PerspectiveChatMessage[];
}
```

| Field | Description |
|-------|-------------|
| `role` | Which party this represents |
| `chronology` | Timeline of events |
| `keyFacts` | Supporting facts |
| `evidences` | Evidence items |
| `legalTheory` | Overall legal position |
| `strengths` | Case strengths |
| `weaknesses` | Potential vulnerabilities |
| `generatedAt` | Generation timestamp |
| `isEdited` | User has edited |
| `documentDrafts` | Per-document analyses |
| `chatHistory` | Chat with agent |

---

### TimelineEvent
```typescript
export interface TimelineEvent {
  id: string;
  date?: string;
  description: string;
  source?: string;
  significance: string;
  order: number;
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique event identifier |
| `date` | Event date if known |
| `description` | What happened |
| `source` | Document source |
| `significance` | Legal significance |
| `order` | Display order |

---

### Evidence
```typescript
export interface Evidence {
  id: string;
  title: string;
  description: string;
  sourceDocument: string;
  relevance: string;
  supportingQuote?: string;
  type: 'documentary' | 'testimonial' | 'circumstantial' | 'physical' | 'other';
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique evidence identifier |
| `title` | Evidence title |
| `description` | What the evidence shows |
| `sourceDocument` | Origin document |
| `relevance` | Why it matters |
| `supportingQuote` | Direct quote if available |
| `type` | Evidence classification |

---

### DocumentDraft
```typescript
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
```
Per-document analysis before synthesis.

---

### PerspectiveChatMessage
```typescript
export interface PerspectiveChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
  updatesApplied?: string[];
  attachedFiles?: CaseFile[];
}
```
Chat message in perspective refinement.

---

## Session Interfaces

### Session
```typescript
export interface Session {
  id: string;
  projectId: string;
  hearingType: string;
  hearingDescription?: string;
  maxTurns: number;
  currentTurnCount: number;
  status: 'pending' | 'active' | 'completed';
  messages: SimulationMessage[];
  verdict?: string;
  createdAt: number;

  // Documents
  recentDevelopments: HearingDocument[];

  // Strategy
  userStrategy: SessionStrategy;
  firstSpeaker: Role.Petitioner | Role.Respondent;

  // Continuation
  parentSessionId?: string;
  isContinuation?: boolean;
  continuationOrder?: number;

  // Branching
  branchFromMessageId?: string;
  branchId?: string;

  // Legacy
  selectedFileIds?: string[];
  reason?: string;
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique session identifier |
| `projectId` | Parent project ID |
| `hearingType` | Type of hearing |
| `hearingDescription` | Optional description |
| `maxTurns` | Turn limit before judgment |
| `currentTurnCount` | Current turn number |
| `status` | Session state |
| `messages` | Hearing transcript |
| `verdict` | Judge's verdict (if completed) |
| `recentDevelopments` | Hearing-specific documents |
| `userStrategy` | User's strategy for this hearing |
| `firstSpeaker` | Who starts (user's side) |
| `parentSessionId` | Parent session (for continuation) |
| `isContinuation` | Is continuation hearing |
| `continuationOrder` | Position in chain |
| `branchFromMessageId` | Message where branch started |
| `branchId` | Unique branch identifier |

---

### HearingDocument
```typescript
export interface HearingDocument {
  id: string;
  name: string;
  type: string;
  content: string;
  uploadedAt: number;
}
```
Document uploaded for specific hearing (recent developments).

---

### SessionStrategy
```typescript
export interface SessionStrategy {
  intent: string;
  keyPoints: string[];
}
```

| Field | Description |
|-------|-------------|
| `intent` | User's strategic intent |
| `keyPoints` | Key points to emphasize |

---

### SimulationMessage
```typescript
export interface SimulationMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  references?: string[];

  // AI generation tracking
  isUserSideAI?: boolean;
  strategyUsed?: string;

  // Judge interaction
  requiresResponse?: boolean;
  userResponse?: JudgmentResponse;

  // Editing/Branching
  isEdited?: boolean;
  originalText?: string;
  editedAt?: number;
  branchId?: string;
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique message identifier |
| `role` | Speaker (Petitioner/Respondent/Judge) |
| `text` | Message content |
| `timestamp` | When generated |
| `references` | Legal citations |
| `isUserSideAI` | Generated for user's side |
| `strategyUsed` | Strategy that guided generation |
| `requiresResponse` | Judge asking question |
| `userResponse` | User's response to judge |
| `isEdited` | Message was edited |
| `originalText` | Text before edit |
| `editedAt` | Edit timestamp |
| `branchId` | Branch identifier |

---

### JudgmentResponse
```typescript
export interface JudgmentResponse {
  id: string;
  questionFromJudge: string;
  userResponse: string;
  attachedDocuments?: CaseFile[];
  timestamp: number;
}
```
User's response to judge's query during hearing.

---

## Type Relationships

```
Project
├── CaseFile[]
│   └── DocumentMetadata
│       └── DocumentDeepAnalysis
├── CasePerspective (petitioner)
│   ├── TimelineEvent[]
│   ├── Evidence[]
│   ├── DocumentDraft[]
│   └── PerspectiveChatMessage[]
└── CasePerspective (respondent)
    └── [same structure]

Session
├── HearingDocument[]
├── SessionStrategy
└── SimulationMessage[]
    └── JudgmentResponse
```

---

## ID Generation Patterns

| Entity | Pattern | Example |
|--------|---------|---------|
| Project | Random 9-char | `abc123xyz` |
| Session | Timestamp-based | `1702345678901` |
| Message | Timestamp | `1702345678901` |
| Event | `event_{docId}_{timestamp}_{index}` | `event_abc_1702345678_0` |
| Evidence | `evidence_{docId}_{timestamp}_{index}` | `evidence_abc_1702345678_0` |
| Draft | `draft_{docId}_{role}_{timestamp}` | `draft_abc_Petitioner_1702345678` |
| Chat | `chat_{role}_{timestamp}` | `chat_user_1702345678` |
| Branch | `branch_{timestamp}` | `branch_1702345678901` |
