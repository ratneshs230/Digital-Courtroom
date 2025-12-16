# User Flows

## 1. Project Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROJECT CREATION                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "New Case" on Dashboard                                  │
│                    ↓                                                     │
│  2. Modal appears with form:                                             │
│     • Project Name                                                       │
│     • Case Title                                                         │
│     • Case Description                                                   │
│     • Side Selection (Petitioner/Respondent)                            │
│     • File Upload (optional)                                             │
│                    ↓                                                     │
│  3. User fills form and clicks "Create"                                  │
│                    ↓                                                     │
│  4. Project created with status: "pending"                               │
│                    ↓                                                     │
│  5. Navigate to ProjectView                                              │
│                    ↓                                                     │
│  6. If files uploaded → Start analysis automatically                     │
│     OR user can upload files later and click "Analyze Case"              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Document Upload Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT UPLOAD                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User selects files in DocumentPanel or ProjectView                   │
│                    ↓                                                     │
│  2. fileProcessor.ts processes each file:                                │
│                    ↓                                                     │
│     ┌────────────────────────────────────────┐                          │
│     │ Is it an image file?                   │                          │
│     │ (PNG, JPG, etc.)                       │                          │
│     └──────────────┬─────────────────────────┘                          │
│            YES     │      NO                                             │
│             ↓      │       ↓                                             │
│     ┌──────────────┘  ┌────────────────────────────────┐                │
│     │                 │ Is it a PDF?                   │                │
│     │                 └──────────────┬─────────────────┘                │
│     │                        YES     │      NO                           │
│     │                         ↓      │       ↓                           │
│     │                 ┌──────────────┘       │                           │
│     │                 │ Extract text         │ Read as text              │
│     │                 │ with pdfjs-dist      │ (TXT, DOCX)              │
│     │                 │                      │                           │
│     │                 │ < 100 chars?         │                           │
│     │                 │                      │                           │
│     │           YES   │    NO                │                           │
│     │            ↓    │     ↓                │                           │
│     │     ┌──────────────┐  │                │                           │
│     ↓     ↓              │  ↓                ↓                           │
│  ┌────────────────┐   ┌────────────┐   ┌──────────┐                     │
│  │ Gemini Vision  │   │ Use text   │   │ Use text │                     │
│  │ OCR            │   │ extraction │   │ content  │                     │
│  └────────┬───────┘   └─────┬──────┘   └────┬─────┘                     │
│           │                 │               │                            │
│           └─────────────────┼───────────────┘                            │
│                             ↓                                            │
│  3. Files added to project with basic metadata                           │
│                             ↓                                            │
│  4. extractDocumentMetadata() called for each file                       │
│                             ↓                                            │
│  5. AI extracts:                                                         │
│     • Category                                                           │
│     • Date, Filed By, Court Name                                         │
│     • Suggested Name                                                     │
│     • Deep Analysis                                                      │
│                             ↓                                            │
│  6. Document renamed with suggested name                                 │
│                             ↓                                            │
│  7. Project.files updated with metadata                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Case Analysis Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CASE ANALYSIS                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "Analyze Case" in ProjectView                            │
│                    ↓                                                     │
│  2. analysisStatus → "analyzing"                                         │
│                    ↓                                                     │
│  3. PARALLEL: Generate both perspectives                                 │
│                                                                          │
│     ┌─────────────────────┐     ┌─────────────────────┐                 │
│     │  PETITIONER PATH    │     │  RESPONDENT PATH    │                 │
│     ├─────────────────────┤     ├─────────────────────┤                 │
│     │                     │     │                     │                 │
│     │  For each document: │     │  For each document: │                 │
│     │  analyzeDocument()  │     │  analyzeDocument()  │                 │
│     │        ↓            │     │        ↓            │                 │
│     │  DocumentDraft[]    │     │  DocumentDraft[]    │                 │
│     │        ↓            │     │        ↓            │                 │
│     │  generatePerspective│     │  generatePerspective│                 │
│     │  FromDrafts()       │     │  FromDrafts()       │                 │
│     │        ↓            │     │        ↓            │                 │
│     │  CasePerspective    │     │  CasePerspective    │                 │
│     └──────────┬──────────┘     └──────────┬──────────┘                 │
│                │                           │                             │
│                └─────────────┬─────────────┘                             │
│                              ↓                                           │
│  4. Project updated with both perspectives                               │
│                              ↓                                           │
│  5. analysisStatus → "completed"                                         │
│                              ↓                                           │
│  6. UI shows dual perspective panels                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Chronology Editing Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CHRONOLOGY EDITING                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "Edit Chronology" on perspective panel                   │
│                    ↓                                                     │
│  2. Timeline becomes editable:                                           │
│     • Add new event                                                      │
│     • Edit existing event                                                │
│     • Delete event                                                       │
│     • Reorder events                                                     │
│                    ↓                                                     │
│  3. User makes changes                                                   │
│                    ↓                                                     │
│  4. User clicks save:                                                    │
│                                                                          │
│     ┌─────────────────────────────────────────────────────────┐         │
│     │  "Save & Re-analyze"        OR       "Save Only"        │         │
│     └────────────┬───────────────────────────┬────────────────┘         │
│                  ↓                           ↓                           │
│     regeneratePerspectiveFromEdit()    Save chronology only              │
│                  ↓                           ↓                           │
│     AI regenerates:                    Preserve existing                 │
│     • Key facts                        analysis                          │
│     • Legal theory                                                       │
│     • Strengths/Weaknesses                                               │
│                  ↓                           ↓                           │
│                  └───────────────────────────┘                           │
│                              ↓                                           │
│  5. Perspective marked as "edited"                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Perspective Chat Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       PERSPECTIVE CHAT                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User opens chat panel for a perspective                              │
│                    ↓                                                     │
│  2. User types message (e.g., "You missed the FIR dated...")             │
│                    ↓                                                     │
│  3. (Optional) User attaches new documents                               │
│                    ↓                                                     │
│  4. User sends message                                                   │
│                    ↓                                                     │
│  5. chatWithPerspectiveAgent() called                                    │
│                    ↓                                                     │
│  6. AI agent:                                                            │
│     • Reviews user message                                               │
│     • Searches all documents                                             │
│     • Analyzes attached files                                            │
│     • Identifies missing information                                     │
│                    ↓                                                     │
│  7. Agent returns:                                                       │
│     • Response text                                                      │
│     • Updates applied (list)                                             │
│     • Modified perspective                                               │
│                    ↓                                                     │
│  8. Updates may include:                                                 │
│     • New facts added                                                    │
│     • New events in chronology                                           │
│     • New evidence items                                                 │
│     • Revised legal theory                                               │
│     • New strengths/weaknesses                                           │
│                    ↓                                                     │
│  9. Perspective updated, chat history preserved                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Hearing Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      HEARING CREATION                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User goes to Hearings page                                           │
│                    ↓                                                     │
│  2. User clicks "New Hearing"                                            │
│                    ↓                                                     │
│  3. Modal appears with form:                                             │
│                                                                          │
│     ┌─────────────────────────────────────────────────────┐             │
│     │  Hearing Type: [Dropdown]                           │             │
│     │  • Bail Hearing                                     │             │
│     │  • Evidence Hearing                                 │             │
│     │  • Arguments on Charge                              │             │
│     │  • Final Arguments                                  │             │
│     │  • etc.                                             │             │
│     │                                                     │             │
│     │  Description: [Optional text]                       │             │
│     │                                                     │             │
│     │  Recent Developments: [File Upload] *Required       │             │
│     │                                                     │             │
│     │  Your Strategy: [Textarea] *Required                │             │
│     │  "What do you want to achieve in this hearing?"     │             │
│     │                                                     │             │
│     │  Key Points: [Text input]                           │             │
│     │  "Comma-separated points to emphasize"              │             │
│     │                                                     │             │
│     │  Max Turns: [Number] (default: 6)                   │             │
│     └─────────────────────────────────────────────────────┘             │
│                    ↓                                                     │
│  4. User fills form and clicks "Create"                                  │
│                    ↓                                                     │
│  5. Session created with:                                                │
│     • status: "pending"                                                  │
│     • firstSpeaker: project.userSide                                     │
│     • userStrategy: { intent, keyPoints }                                │
│                    ↓                                                     │
│  6. Session appears in list, user can click "Start"                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Courtroom Simulation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     COURTROOM SIMULATION                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "Start" on a hearing                                     │
│                    ↓                                                     │
│  2. Navigate to Simulation room                                          │
│                    ↓                                                     │
│  3. Display visual courtroom stage                                       │
│                    ↓                                                     │
│  4. TURN LOOP:                                                           │
│     ┌───────────────────────────────────────────────────────────┐       │
│     │                                                           │       │
│     │  User clicks "Generate Argument" or "Let Opponent Respond"│       │
│     │                       ↓                                   │       │
│     │  generateTurn() called                                    │       │
│     │                       ↓                                   │       │
│     │  AI generates argument using:                             │       │
│     │  • Both perspectives                                      │       │
│     │  • Recent developments                                    │       │
│     │  • User strategy (if user's side)                         │       │
│     │  • Turn-based instructions                                │       │
│     │                       ↓                                   │       │
│     │  Message added to transcript                              │       │
│     │                       ↓                                   │       │
│     │  turnCount++                                              │       │
│     │                       ↓                                   │       │
│     │  Is turnCount >= maxTurns?                                │       │
│     │           YES                    NO                       │       │
│     │            ↓                      ↓                       │       │
│     │  Generate Judge verdict    Continue loop                  │       │
│     │                       ↓                                   │       │
│     └───────────────────────────────────────────────────────────┘       │
│                    ↓                                                     │
│  5. Session marked as "completed"                                        │
│                    ↓                                                     │
│  6. "Continue to Next Hearing" button appears                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Message Editing (Branching) Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MESSAGE EDITING                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User sees message from their side (AI-generated)                     │
│                    ↓                                                     │
│  2. User clicks "Edit" button                                            │
│                    ↓                                                     │
│  3. Warning displayed:                                                   │
│     "Editing will create a new branch. All arguments after this          │
│     message will be removed."                                            │
│                    ↓                                                     │
│  4. Textarea appears with current text                                   │
│                    ↓                                                     │
│  5. User modifies argument                                               │
│                    ↓                                                     │
│  6. User clicks "Save & Continue"                                        │
│                    ↓                                                     │
│  7. System:                                                              │
│     • Stores original text                                               │
│     • Marks message as edited                                            │
│     • Removes all messages after edited message                          │
│     • Adjusts turn count                                                 │
│     • Creates branch ID                                                  │
│                    ↓                                                     │
│  8. Automatically generates opponent's response                          │
│                    ↓                                                     │
│  9. Simulation continues from branched point                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Continuation Session Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTINUATION SESSION                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ENTRY POINT 1: From Hearings Page                                       │
│  1a. User sees completed session with verdict                            │
│  2a. User clicks "Continue" button below verdict                         │
│                    ↓                                                     │
│  ENTRY POINT 2: From Courtroom                                           │
│  1b. Session completes with judgment                                     │
│  2b. User clicks "Continue to Next Hearing"                              │
│                    ↓                                                     │
│  3. New Hearing modal opens with:                                        │
│     • "Continuing from: [Previous Hearing Type]"                         │
│     • Parent session info displayed                                      │
│     • Recent developments (optional)                                     │
│     • New strategy (required)                                            │
│                    ↓                                                     │
│  4. User fills form and creates                                          │
│                    ↓                                                     │
│  5. New session created with:                                            │
│     • parentSessionId: previous session ID                               │
│     • isContinuation: true                                               │
│     • continuationOrder: previous order + 1                              │
│                    ↓                                                     │
│  6. In Hearings Page:                                                    │
│     • Shows grouped under parent session                                 │
│     • Indented display with arrow icon                                   │
│                    ↓                                                     │
│  7. In Simulation:                                                       │
│     • Loads parent session messages                                      │
│     • Shows previous hearing arguments (faded)                           │
│     • Shows previous verdict summary                                     │
│     • Divider line: "Continuation: [New Hearing Type]"                   │
│     • New arguments appear below divider                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Judge Response Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       JUDGE RESPONSE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Judge message contains question indicators:                          │
│     • Question mark (?)                                                  │
│     • "clarify", "explain", "submit", "provide"                          │
│     • "Court directs", "Court requires"                                  │
│                    ↓                                                     │
│  2. "Respond to Court's Query" button appears                            │
│                    ↓                                                     │
│  3. User clicks button                                                   │
│                    ↓                                                     │
│  4. Response box expands:                                                │
│     • Textarea for response                                              │
│     • "Attach Document" button                                           │
│     • Submit/Cancel buttons                                              │
│                    ↓                                                     │
│  5. User types response                                                  │
│                    ↓                                                     │
│  6. (Optional) User attaches supporting documents                        │
│                    ↓                                                     │
│  7. User clicks "Submit Response"                                        │
│                    ↓                                                     │
│  8. JudgmentResponse created and attached to message                     │
│                    ↓                                                     │
│  9. Response displayed in green box below judge's message                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```
