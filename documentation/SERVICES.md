# Services & Utilities Reference

## Services

### geminiService.ts

**Location**: `./services/geminiService.ts`

**Purpose**: AI service layer providing all Gemini API interactions.

**Model Used**: `gemini-2.5-flash`

---

#### API Key Management

##### `getAllApiKeys(): string[]`
Gets all available API keys from localStorage and environment variables.

**Sources**:
- `localStorage.getItem("gemini_api_key")` - Comma-separated keys
- `process.env.API_KEY` or `process.env.GEMINI_API_KEY`

**Returns**: Deduplicated array of API keys

---

##### `getAvailableKeys(): string[]`
Filters out recently failed keys from the available pool.

**Cooldown**: 60 seconds (`KEY_COOLDOWN_MS`)

---

##### `markKeyFailed(key: string): void`
Marks an API key as failed with current timestamp.

**Trigger Conditions**:
- Rate limit errors (429)
- Quota exceeded
- Invalid/unauthorized key (403)

---

##### `executeWithFallback<T>(operation): Promise<T>`
Executes an API operation with automatic key rotation on failure.

**Parameters**:
- `operation`: Function that takes `GoogleGenAI` client and returns Promise

**Behavior**:
1. Gets available keys
2. Tries each key sequentially
3. On failure, marks key and tries next
4. Throws last error if all keys fail

---

#### Document Analysis Functions

##### `extractDocumentMetadata(fileName, content, onProgress?): Promise<DocumentMetadata>`
Extracts comprehensive metadata from a single document using AI.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `fileName` | `string` | Original file name |
| `content` | `string` | Document text content |
| `onProgress` | `(status: string) => void` | Progress callback |

**Returns**: `DocumentMetadata` object with:
- `category`: Document category enum
- `date`: Document date if found
- `filedBy`: Who filed the document
- `courtName`: Court name if mentioned
- `caseNumber`: Case reference
- `description`: Brief description
- `contextNotes`: AI context notes
- `parties`: Array of party names
- `suggestedName`: AI-suggested filename
- `deepAnalysis`: Deep analysis object

**Content Limit**: First 20,000 characters

---

##### `extractAllDocumentsMetadata(files, onProgress?): Promise<Map<string, DocumentMetadata>>`
Extracts metadata for multiple documents in parallel batches.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `files` | `{name, content, id}[]` | Array of file objects |
| `onProgress` | `(status, current, total) => void` | Progress callback |

**Batch Size**: 3 documents per batch

**Returns**: Map of document ID to metadata

---

#### Perspective Generation Functions

##### `analyzeDocument(caseTitle, description, document, perspectiveRole, onProgress?): Promise<DocumentDraft>`
Analyzes a single document from one party's perspective.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `caseTitle` | `string` | Case title |
| `description` | `string` | Case description |
| `document` | `CaseFile` | Document to analyze |
| `perspectiveRole` | `Role.Petitioner \| Role.Respondent` | Perspective |
| `onProgress` | `(status: string) => void` | Progress callback |

**Returns**: `DocumentDraft` with:
- `summary`: Document summary
- `extractedFacts`: Facts supporting this party
- `extractedEvents`: Timeline events
- `extractedEvidences`: Evidence items
- `legalImplications`: Legal implications

**Content Limit**: First 15,000 characters

---

##### `analyzeAllDocuments(caseTitle, description, documents, perspectiveRole, onProgress?): Promise<DocumentDraft[]>`
Analyzes all documents sequentially for one perspective.

**Processing**: Sequential (one document at a time)

---

##### `generatePerspectiveFromDrafts(caseTitle, description, drafts, perspectiveRole, onProgress?): Promise<CasePerspective>`
Synthesizes document drafts into a unified case perspective.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `drafts` | `DocumentDraft[]` | Individual document analyses |
| `perspectiveRole` | `Role.Petitioner \| Role.Respondent` | Perspective |

**Returns**: Complete `CasePerspective` with:
- Unified chronology
- Deduplicated key facts
- Compiled evidence
- Cohesive legal theory
- Strengths and weaknesses

---

##### `generatePerspective(caseTitle, description, fileContents, perspectiveRole): Promise<CasePerspective>`
**[Legacy]** Generates perspective in a single API call.

**Use Case**: Backward compatibility, quick analysis

**Content Limit**: First 25,000 characters combined

---

##### `generateBothPerspectives(caseTitle, description, fileContents): Promise<{petitioner, respondent}>`
Generates both perspectives in parallel.

**Processing**: `Promise.all` for parallel execution

---

##### `regeneratePerspectiveFromEdit(caseTitle, description, existingPerspective, onProgress?): Promise<CasePerspective>`
Regenerates perspective after user edits chronology.

**Preserves**:
- Edited chronology
- Document drafts
- Chat history

**Regenerates**:
- Key facts
- Legal theory
- Strengths
- Weaknesses

---

#### Chat Functions

##### `chatWithPerspectiveAgent(project, perspective, userMessage, attachedFiles?, onProgress?): Promise<ChatResult>`
Interactive chat with perspective agent for refinements.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | `Project` | Full project context |
| `perspective` | `CasePerspective` | Current perspective |
| `userMessage` | `string` | User's message |
| `attachedFiles` | `CaseFile[]` | Optional new files |

**Returns**:
```typescript
{
  agentResponse: string;
  updatedPerspective: CasePerspective;
  updatesApplied: string[];
}
```

**Capabilities**:
- Add new facts, events, evidences
- Revise legal theory
- Add strengths/weaknesses
- Analyze attached files

---

#### Hearing Functions

##### `analyzeRecentDevelopments(project, developmentDocs, userIntent): Promise<DevelopmentAnalysis>`
Analyzes hearing-specific documents in case context.

**Returns**:
```typescript
{
  summary: string;
  relevantLegalPoints: string[];
  suggestedArguments: string[];
}
```

---

##### `generateTurn(project, session, nextSpeaker, history): Promise<TurnResult>`
Generates the next courtroom argument.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | `Project` | Case context |
| `session` | `Session` | Current session |
| `nextSpeaker` | `Role` | Who speaks next |
| `history` | `SimulationMessage[]` | Previous messages |

**Returns**:
```typescript
{
  text: string;        // The argument
  references: string[]; // Legal citations
  isUserSideAI: boolean; // Generated for user's side
}
```

**Turn-Based Instructions**:
- **Early turns (1-2)**: Opening contentions, main positions
- **Mid turns**: Rebuttals, counter-arguments, new points
- **Late turns**: Closing arguments, summaries

**Judge Behavior**:
- Non-final turns: Questions, clarifications
- Final turn: Full verdict with reasoning

**Argument Length**: 100-180 words

---

##### `analyzeLegalContext(title, description, fileContents): Promise<string>`
**[Legacy]** Generates basic legal context summary.

**Returns**: Legal brief (max 400 words)

---

## Utilities

### fileProcessor.ts

**Location**: `./utils/fileProcessor.ts`

**Purpose**: File upload processing with OCR support.

---

#### Main Function

##### `processFiles(fileList, onProgress?): Promise<ProcessFilesResult>`
Processes uploaded files into extractable text content.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `fileList` | `FileList \| null` | Files from input |
| `onProgress` | `(status, current, total) => void` | Progress callback |

**Returns**:
```typescript
{
  files: CaseFile[];     // Successfully processed
  failedFiles: string[]; // Failed file names
}
```

**Supported File Types**:
| Type | Handling |
|------|----------|
| PDF (text-based) | pdfjs-dist extraction |
| PDF (image-based) | Gemini Vision OCR |
| Images (PNG, JPG, etc.) | Gemini Vision OCR |
| TXT, DOCX | Direct text read |

---

#### Helper Functions

##### `isImageFile(file): boolean`
Checks if file is an image based on MIME type or extension.

**Supported**:
- `image/png`, `image/jpeg`, `image/jpg`, `image/gif`, `image/webp`, `image/bmp`
- Extensions: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`

---

##### `fileToBase64(file): Promise<string>`
Converts file to base64 string using FileReader.

---

##### `pdfPageToImage(page, scale?): Promise<string>`
Renders PDF page to canvas and exports as base64 PNG.

**Parameters**:
- `page`: PDF.js page object
- `scale`: Render scale (default: 2)

---

##### `extractTextFromImage(base64Image, mimeType?): Promise<string>`
Extracts text from image using Gemini Vision API.

**API**: `gemini-2.0-flash` with vision capability

**Prompt Instructions**:
- Extract all visible text
- Maintain structure/formatting
- Include headers, footers, stamps
- Transcribe handwritten text
- Note tables and forms
- Mark unclear text with `[unclear]`

**Key Rotation**: Supports multiple API keys with fallback

---

##### `processImagePdf(arrayBuffer, fileName): Promise<string>`
Processes image-based PDF by converting pages to images.

**Page Limit**: First 20 pages

**Output Format**:
```
--- Page 1 ---
[extracted text]

--- Page 2 ---
[extracted text]

[Note: Only first 20 of N pages were processed]
```

---

#### Image-Based PDF Detection

A PDF is considered image-based if:
1. Text extraction yields < 100 characters, OR
2. No page has > 50 characters of text

When detected:
1. Each page rendered to canvas at 2x scale
2. Canvas exported as PNG base64
3. Sent to Gemini Vision for OCR
4. Results compiled with page markers

---

## Error Handling

### geminiService.ts Errors

| Error Type | Handling |
|------------|----------|
| Rate limit | Mark key failed, try next |
| Invalid key | Mark key failed, try next |
| All keys failed | Throw with message |
| JSON parse error | Log and rethrow |
| Network error | Propagate to UI |

### fileProcessor.ts Errors

| Error Type | Handling |
|------------|----------|
| File read error | Add to failedFiles, continue |
| PDF parse error | Add to failedFiles, continue |
| OCR error | Fall back to extracted text |
| No content | Add to failedFiles |

---

## Performance Considerations

### geminiService.ts
- Batch document analysis (3 parallel)
- Content truncation (15k-25k chars)
- Key rotation avoids single-key bottleneck

### fileProcessor.ts
- Sequential file processing (OCR rate limits)
- Page limit for large PDFs (20 pages)
- Canvas cleanup after rendering
