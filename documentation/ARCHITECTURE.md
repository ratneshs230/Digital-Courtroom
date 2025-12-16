# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NyayaSutra Application                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Dashboard   │  │ ProjectView  │  │ HearingsPage │  │  Simulation  │ │
│  │  Component   │  │  Component   │  │  Component   │  │  Component   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│         └─────────────────┴─────────────────┴─────────────────┘          │
│                                    │                                     │
│                         ┌──────────┴──────────┐                          │
│                         │      App.tsx        │                          │
│                         │  (State Manager)    │                          │
│                         └──────────┬──────────┘                          │
│                                    │                                     │
├────────────────────────────────────┼────────────────────────────────────┤
│                         ┌──────────┴──────────┐                          │
│                         │   Services Layer    │                          │
│                         ├─────────────────────┤                          │
│                         │  geminiService.ts   │                          │
│                         │  fileProcessor.ts   │                          │
│                         └──────────┬──────────┘                          │
│                                    │                                     │
├────────────────────────────────────┼────────────────────────────────────┤
│                         ┌──────────┴──────────┐                          │
│                         │   External APIs     │                          │
│                         ├─────────────────────┤                          │
│                         │  Google Gemini API  │                          │
│                         │  (gemini-2.5-flash) │                          │
│                         └─────────────────────┘                          │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                         ┌─────────────────────┐                          │
│                         │    localStorage     │                          │
│                         │   (Persistence)     │                          │
│                         └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Project Creation Flow

```
User Input → Dashboard.tsx → App.tsx (state) → localStorage
                ↓
         geminiService.ts
                ↓
    generateBothPerspectives()
                ↓
    ProjectView.tsx (display)
```

### 2. Document Upload Flow

```
File Selection → fileProcessor.ts → processFiles()
                        ↓
              ┌─────────┴─────────┐
              │                   │
        Text-based PDF      Image/Scanned PDF
              │                   │
        pdfjs-dist         extractTextFromImage()
              │                   │
              └─────────┬─────────┘
                        ↓
              extractDocumentMetadata()
                        ↓
              Project.files updated
```

### 3. Perspective Generation Flow

```
Project.files → analyzeAllDocuments() → DocumentDraft[]
                        ↓
        generatePerspectiveFromDrafts()
                        ↓
              CasePerspective
                        ↓
    ┌───────────────────┴───────────────────┐
    │                                       │
petitionerPerspective            respondentPerspective
```

### 4. Courtroom Simulation Flow

```
Session Start → generateTurn(project, session, speaker, history)
                        ↓
              geminiService.ts
                        ↓
         ┌──────────────┴──────────────┐
         │                             │
   User's Side                   Opponent Side
(uses userStrategy)           (uses perspective)
         │                             │
         └──────────────┬──────────────┘
                        ↓
              SimulationMessage
                        ↓
              Simulation.tsx (display)
                        ↓
              localStorage (persist)
```

### 5. Continuation Session Flow

```
Previous Session (completed) → parentSessionId
              ↓
       New Session Creation
              ↓
       isContinuation: true
              ↓
       Simulation.tsx loads:
       - parentSessionMessages
       - parentSessionInfo
              ↓
       Display previous + current messages
```

## State Management

### App-Level State (App.tsx)

| State | Type | Purpose |
|-------|------|---------|
| `view` | string | Current view (dashboard/project/hearings/simulation) |
| `activeProject` | Project | Currently selected project |
| `activeSession` | Session | Currently active hearing session |
| `projects` | Project[] | All projects |
| `apiKey` | string | Gemini API key |
| `continuationSession` | Session | Session to continue from |

### Component-Level State

**ProjectView.tsx**
- `isAnalyzing`: Analysis in progress
- `analysisProgress`: Progress message
- `showDocPanel`: Document panel visibility
- `editingChronology`: Chronology edit mode

**Simulation.tsx**
- `messages`: Current session messages
- `isPlaying`: Auto-simulation mode
- `turnCount`: Current turn number
- `editingMessageId`: Message being edited
- `parentSessionMessages`: Previous session messages (continuation)

**HearingsPage.tsx**
- `sessions`: All sessions for project
- `showNewHearingModal`: Modal visibility
- `continuingFromSession`: Parent session for continuation

## Storage Schema

### localStorage Keys

| Key | Content |
|-----|---------|
| `nyayasutra_data` | JSON array of all projects |
| `gemini_api_key` | Comma-separated API keys |
| `sessions_{projectId}` | Sessions for specific project |

### Project Structure in Storage

```json
{
  "id": "unique-id",
  "name": "Project Name",
  "caseTitle": "Case Title",
  "description": "Description",
  "userSide": "Petitioner|Respondent",
  "files": [CaseFile],
  "petitionerPerspective": CasePerspective,
  "respondentPerspective": CasePerspective,
  "analysisStatus": "pending|analyzing|completed|error",
  "createdAt": timestamp
}
```

## API Key Rotation

The system supports multiple API keys with automatic rotation:

```typescript
// Key rotation logic in geminiService.ts
1. getAllApiKeys() - Gets keys from localStorage and env
2. getAvailableKeys() - Filters out recently failed keys
3. executeWithFallback() - Tries each key until success
4. markKeyFailed() - Marks key as failed with cooldown
```

**Cooldown Period**: 60 seconds before retrying a failed key

## Error Handling Strategy

1. **API Errors**: Caught in service layer, logged, key marked as failed
2. **File Processing Errors**: Return failedFiles array, continue with successful ones
3. **Storage Errors**: Caught and logged, graceful degradation
4. **UI Errors**: Display user-friendly messages

## Performance Optimizations

1. **Parallel Processing**: Documents analyzed in batches of 3
2. **Content Truncation**: Large documents truncated to prevent token overflow
3. **Lazy Loading**: Parent session messages loaded on demand
4. **Debounced Saves**: Session progress saved after each turn

## Security Considerations

1. **API Keys**: Stored in localStorage (client-side only)
2. **No Backend**: All processing happens client-side or via Gemini API
3. **Data Privacy**: Case data never leaves the client except for AI analysis
4. **HTTPS**: Gemini API calls use HTTPS
