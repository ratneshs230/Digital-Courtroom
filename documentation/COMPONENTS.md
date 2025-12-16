# Components Reference

## Component Hierarchy

```
App.tsx
├── Dashboard.tsx
│   └── Project Creation Modal
├── ProjectView.tsx
│   ├── Perspective Panels (Petitioner/Respondent)
│   ├── Chronology Editor
│   ├── Evidence Display
│   ├── Perspective Chat
│   └── DocumentPanel.tsx
├── HearingsPage.tsx
│   ├── Session List
│   ├── Session Groups (with continuations)
│   └── New Hearing Modal
└── Simulation.tsx
    ├── Courtroom Visual Stage
    ├── Message Transcript
    ├── Message Editor
    ├── Judgment Response Box
    └── HearingDocumentsPanel
```

---

## App.tsx

**Location**: `./App.tsx`

**Purpose**: Main application container managing global state and navigation.

### Props
None (root component)

### State
| State | Type | Description |
|-------|------|-------------|
| `view` | `'dashboard' \| 'project' \| 'hearings' \| 'simulation'` | Current view |
| `activeProject` | `Project \| null` | Selected project |
| `activeSession` | `Session \| null` | Active hearing session |
| `projects` | `Project[]` | All projects |
| `apiKey` | `string` | Gemini API key |
| `continuationSession` | `Session \| null` | Session to continue from |

### Key Functions
| Function | Purpose |
|----------|---------|
| `handleCreateProject(project)` | Create new project and navigate |
| `handleSelectProject(project)` | Select project and go to project view |
| `handleDeleteProject(projectId)` | Delete project |
| `handleStartSession(session)` | Start courtroom simulation |
| `handleContinueSession(parentSession)` | Start continuation hearing |
| `updateProject(project)` | Update project in state |

### Renders
- Sidebar navigation with API key input
- Main content area switching between views

---

## Dashboard.tsx

**Location**: `./components/Dashboard.tsx`

**Purpose**: Project list display and project creation interface.

### Props
```typescript
interface DashboardProps {
  projects: Project[];
  onCreateProject: (project: Project) => void;
  onSelectProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}
```

### Features
- Display all projects as cards
- "New Case" modal with:
  - Case name input
  - Case title input
  - Case description textarea
  - User side selection (Petitioner/Respondent)
  - File upload for initial documents
- Project deletion with confirmation

### Key UI Elements
- Project cards showing name, title, file count, date
- Analysis status badge (pending/analyzing/completed/error)
- User side indicator (blue for Petitioner, red for Respondent)

---

## ProjectView.tsx

**Location**: `./components/ProjectView.tsx`

**Purpose**: Case analysis display with dual perspectives and document management.

### Props
```typescript
interface ProjectViewProps {
  project: Project;
  onProceedToHearings: () => void;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
}
```

### State
| State | Type | Description |
|-------|------|-------------|
| `isAnalyzing` | `boolean` | Analysis in progress |
| `analysisProgress` | `string` | Progress message |
| `showDocPanel` | `boolean` | Document panel visibility |
| `editingPerspective` | `Role \| null` | Which perspective is being edited |
| `editingChronology` | `TimelineEvent[]` | Chronology being edited |
| `chatMessage` | `string` | Chat input text |
| `attachedFiles` | `CaseFile[]` | Files attached to chat |

### Key Functions
| Function | Purpose |
|----------|---------|
| `startAnalysis()` | Trigger AI analysis of all documents |
| `startEditingChronology()` | Enter chronology edit mode |
| `saveChronologyAndReanalyze()` | Save edits and regenerate perspective |
| `saveChronologyWithoutReanalyze()` | Save edits without regeneration |
| `handleChatSubmit()` | Send message to perspective agent |

### Sections
1. **Header**: Case title, status, action buttons
2. **Perspective Tabs**: Toggle between Petitioner/Respondent
3. **Perspective Panel**:
   - Legal Theory
   - Chronology (editable timeline)
   - Key Facts
   - Evidence Items
   - Strengths/Weaknesses
4. **Perspective Chat**: Interactive refinement
5. **Document Panel**: Collapsible sidebar

---

## HearingsPage.tsx

**Location**: `./components/HearingsPage.tsx`

**Purpose**: Hearing session management and creation.

### Props
```typescript
interface HearingsPageProps {
  project: Project;
  onBack: () => void;
  onStartHearing: (session: Session) => void;
  initialContinuationSession?: Session | null;
}
```

### State
| State | Type | Description |
|-------|------|-------------|
| `sessions` | `Session[]` | All sessions for project |
| `showNewHearingModal` | `boolean` | Modal visibility |
| `hearingType` | `string` | Selected hearing type |
| `hearingDescription` | `string` | Optional description |
| `recentDevelopments` | `HearingDocument[]` | Uploaded documents |
| `userIntent` | `string` | Strategy intent |
| `keyPoints` | `string` | Key points (comma-separated) |
| `maxTurns` | `number` | Turn limit (default: 6) |
| `continuingFromSession` | `Session \| null` | Parent session |

### Hearing Types
- Bail Hearing
- Evidence Hearing
- Arguments on Charge
- Final Arguments
- Interim Application
- Cross-Examination
- Motion Hearing
- Settlement Conference
- Status Hearing
- Other

### Session Display
- Groups sessions by root session + continuations
- Shows continuation chain with indentation
- Displays status badge (pending/active/completed)
- Shows verdict preview for completed sessions

### Key Functions
| Function | Purpose |
|----------|---------|
| `handleCreateHearing()` | Create new session |
| `handleDeleteSession(id)` | Delete session |
| `startContinuation(session)` | Open continuation modal |
| `getSessionGroups()` | Group sessions by parent |

---

## Simulation.tsx

**Location**: `./components/Simulation.tsx`

**Purpose**: Courtroom simulation interface with real-time argument generation.

### Props
```typescript
interface SimulationRoomProps {
  session: Session;
  project: Project;
  onBack: () => void;
  onContinueSession?: (parentSession: Session) => void;
}
```

### State
| State | Type | Description |
|-------|------|-------------|
| `messages` | `SimulationMessage[]` | Hearing transcript |
| `isPlaying` | `boolean` | Auto-simulation mode |
| `loading` | `boolean` | Generating turn |
| `turnCount` | `number` | Current turn |
| `showStrategy` | `boolean` | Strategy panel visibility |
| `editingMessageId` | `string \| null` | Message being edited |
| `editMessageText` | `string` | Edited message content |
| `respondingToMessageId` | `string \| null` | Judge message being responded to |
| `responseText` | `string` | Response to judge |
| `attachedFiles` | `CaseFile[]` | Files for response |
| `showDocPanel` | `boolean` | Document panel visibility |
| `parentSessionMessages` | `SimulationMessage[]` | Previous session messages |

### Visual Elements
1. **Header**: Hearing title, turn counter, controls
2. **Visual Stage**: Animated avatars for Petitioner, Respondent, Judge
3. **Transcript Area**:
   - Parent session messages (if continuation)
   - Session divider
   - Current session messages
4. **Footer Controls**: Manual turn buttons, continue button
5. **Document Panel**: Hearing documents sidebar

### Message Features
- **Editing**: AI-generated messages on user's side can be edited
- **Branching**: Editing creates a new branch, removes subsequent messages
- **Judge Response**: Special chatbox for responding to judge queries
- **File Attachment**: Attach documents to judge responses

### Key Functions
| Function | Purpose |
|----------|---------|
| `handleManualTurn(forcedRole?)` | Generate next argument |
| `getNextSpeaker(history)` | Determine whose turn |
| `canEditMessage(msg)` | Check if message is editable |
| `saveEditedMessage(id)` | Save edit and regenerate |
| `handleSubmitResponse(id, text)` | Submit response to judge |
| `saveSessionProgress(msgs, count)` | Persist to localStorage |

### Sub-Components

#### HearingDocumentsPanel
```typescript
interface Props {
  documents: HearingDocument[];
  isOpen: boolean;
  onToggle: () => void;
  hearingType?: string;
}
```
Displays hearing-specific documents with expandable content preview.

#### Avatar
Internal component rendering animated role avatars with active state indicators.

---

## DocumentPanel.tsx

**Location**: `./components/DocumentPanel.tsx`

**Purpose**: Case document management sidebar with metadata editing.

### Props
```typescript
interface DocumentPanelProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  isOpen: boolean;
  onToggle: () => void;
}
```

### Features
1. **File Upload**:
   - Supports: PDF, TXT, DOCX, PNG, JPG, GIF, WebP, BMP
   - Progress indicator with OCR status
   - Automatic AI metadata extraction

2. **Document List**:
   - Filterable by category
   - Expandable details
   - Category badges with colors

3. **Metadata Display**:
   - Category
   - Date
   - Filed By
   - Court Name
   - Description
   - Context Notes (for AI)

4. **Deep Analysis View**:
   - Document Type
   - Summary
   - Key Points
   - Legal Sections
   - Important Quotes
   - Analysis Notes

5. **Actions**:
   - Edit metadata
   - Re-analyze with AI
   - Delete document

### Category Colors
| Category | Color |
|----------|-------|
| FIR | Red |
| Affidavit | Blue |
| Evidence | Green |
| Court Proceeding | Purple |
| Court Order | Yellow |
| Judgment | Orange |
| Petition | Indigo |
| Reply | Pink |
| Witness | Teal |
| Charge Sheet | Rose |
| Medical Report | Cyan |
| Forensic Report | Emerald |
| Legal Opinion | Violet |
| Other | Gray |

---

## Component Communication

### Parent-Child Props Flow
```
App.tsx
  ├── project, onCreateProject → Dashboard
  ├── project, onUpdateProject → ProjectView
  ├── project, onStartHearing, initialContinuationSession → HearingsPage
  └── session, project, onContinueSession → Simulation
```

### State Updates Flow
```
Component Action → Handler → App.tsx state update → Props change → Re-render
```

### localStorage Sync
```
State Change → useEffect → localStorage.setItem
Page Load → useEffect → localStorage.getItem → setState
```
