# API Integration Guide

## Google Gemini API

NyayaSutra uses Google's Gemini API for all AI-powered features.

### API Configuration

#### API Key Setup

**Option 1: UI Configuration**
1. Enter API key in sidebar input
2. Stored in `localStorage` as `gemini_api_key`
3. Supports comma-separated multiple keys

**Option 2: Environment Variables**
```bash
# .env file (if using environment variables)
API_KEY=your-api-key-here
# or
GEMINI_API_KEY=your-api-key-here
```

#### Multiple API Keys (Recommended)
```
key1,key2,key3
```
- Provides fallback when rate limits hit
- 60-second cooldown before retrying failed keys
- Automatic rotation on errors

---

### Models Used

| Model | Purpose | Token Context |
|-------|---------|---------------|
| `gemini-2.5-flash` | Text generation, analysis | ~30k tokens |
| `gemini-2.0-flash` | Vision/OCR for images | ~30k tokens |

---

### API Endpoints Used

#### 1. Text Generation
```typescript
// @google/genai SDK
const ai = new GoogleGenAI({ apiKey: key });
await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: schema,
    systemInstruction: instruction
  }
});
```

#### 2. Vision API (OCR)
```typescript
// Direct REST API call
await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: base64Image } }
        ]
      }]
    })
  }
);
```

---

### Structured Output Schemas

NyayaSutra uses Gemini's structured output feature with JSON schemas.

#### Document Metadata Schema
```typescript
const metadataSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING },
    date: { type: Type.STRING },
    filedBy: { type: Type.STRING },
    courtName: { type: Type.STRING },
    caseNumber: { type: Type.STRING },
    description: { type: Type.STRING },
    contextNotes: { type: Type.STRING },
    parties: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestedName: { type: Type.STRING },
    deepAnalysis: {
      type: Type.OBJECT,
      properties: {
        documentType: { type: Type.STRING },
        summary: { type: Type.STRING },
        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        legalSections: { type: Type.ARRAY, items: { type: Type.STRING } },
        // ... more fields
      }
    }
  },
  required: ["category", "description", "suggestedName", "deepAnalysis"]
};
```

#### Perspective Schema
```typescript
const perspectiveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    chronology: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          description: { type: Type.STRING },
          source: { type: Type.STRING },
          significance: { type: Type.STRING }
        },
        required: ["description", "significance"]
      }
    },
    keyFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
    evidences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          sourceDocument: { type: Type.STRING },
          relevance: { type: Type.STRING },
          type: { type: Type.STRING }
        }
      }
    },
    legalTheory: { type: Type.STRING },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["chronology", "keyFacts", "evidences", "legalTheory", "strengths", "weaknesses"]
};
```

#### Courtroom Turn Schema
```typescript
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    argument: {
      type: Type.STRING,
      description: "The spoken argument or verdict."
    },
    citations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of specific laws or cases cited."
    }
  },
  required: ["argument", "citations"]
};
```

---

### Rate Limiting & Error Handling

#### Rate Limit Strategy
```
1. First request → Try key1
2. If 429/quota error → Mark key1 failed, try key2
3. If key2 fails → Mark key2 failed, try key3
4. If all fail → Throw error with message
5. After 60 seconds → key1 available again
```

#### Error Detection
```typescript
const errorMsg = error.message.toLowerCase();
const shouldMarkFailed = (
  errorMsg.includes("rate") ||
  errorMsg.includes("quota") ||
  errorMsg.includes("limit") ||
  errorMsg.includes("unauthorized") ||
  errorMsg.includes("invalid") ||
  errorMsg.includes("api key") ||
  errorMsg.includes("403") ||
  errorMsg.includes("429")
);
```

#### User-Facing Errors
| Error | Message Shown |
|-------|---------------|
| No API key | "API Key is missing. Please enter your Gemini API Key in the sidebar." |
| All keys failed | "All API keys are temporarily unavailable. Please wait a moment and try again." |
| Network error | "System Error: Please check your API Key settings." |

---

### Token Management

#### Content Truncation Limits
| Function | Limit |
|----------|-------|
| `extractDocumentMetadata` | 20,000 chars |
| `analyzeDocument` | 15,000 chars |
| `generatePerspective` | 25,000 chars combined |
| `chatWithPerspectiveAgent` | 25,000 chars (docs) + 5,000 chars (attachments) |
| `generateTurn` | 5,000 chars (recent developments) |

#### Best Practices
1. **Batch Processing**: Documents analyzed in batches of 3
2. **Page Limits**: PDFs limited to 20 pages for OCR
3. **Summary Truncation**: Long verdicts truncated in UI (200 chars)

---

### Prompt Engineering

#### System Instructions
Each API call includes detailed system instructions:

**Document Analysis**
```
You are an expert Indian Legal Document Analyst.
- Distinguish between COURT FINDINGS and PARTY SUBMISSIONS
- Identify specific Indian law sections (IPC, CrPC, Evidence Act)
- Note document type, parties, dates
```

**Courtroom Simulation**
```
You are simulating a [Role] in an Indian Courtroom.
- STRUCTURE argument based on turn position (early/mid/late)
- AVOID repetition of previous arguments
- BE SPECIFIC with evidence citations
- Use proper court address ("My Lord", "Your Lordship")
```

**Chat Agent**
```
You are an expert Indian Legal Analyst representing the [Role].
- If user points out missed info, SEARCH THE DOCUMENTS
- If new files attached, ANALYZE THOROUGHLY
- Distinguish court findings vs party submissions
```

---

### API Usage Patterns

#### Parallel Requests
```typescript
// Both perspectives generated in parallel
const [petitioner, respondent] = await Promise.all([
  generatePerspective(title, desc, files, Role.Petitioner),
  generatePerspective(title, desc, files, Role.Respondent)
]);
```

#### Sequential with Progress
```typescript
// Documents analyzed one by one with progress
for (let i = 0; i < documents.length; i++) {
  onProgress?.(`Analyzing ${i + 1}/${documents.length}`);
  const draft = await analyzeDocument(doc);
  drafts.push(draft);
}
```

#### Batched Parallel
```typescript
// Metadata extraction in batches of 3
const BATCH_SIZE = 3;
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE);
  const results = await Promise.all(
    batch.map(f => extractDocumentMetadata(f.name, f.content))
  );
}
```

---

### Security Considerations

1. **API Keys Client-Side**: Keys stored in localStorage
   - Risk: Accessible via browser dev tools
   - Mitigation: Users use their own keys

2. **No Backend**: All processing client-side
   - Risk: No server-side validation
   - Mitigation: API-level validation by Gemini

3. **Data Privacy**: Document content sent to Gemini API
   - Risk: Sensitive legal documents processed externally
   - Mitigation: Users should be aware; no server storage

---

### Debugging API Calls

#### Console Logging
```typescript
console.error(`API call failed with key ...${key.slice(-4)}:`, error.message);
console.warn(`API key ending in ...${key.slice(-4)} marked as failed.`);
```

#### Key Status Check
```javascript
// In browser console
const keys = localStorage.getItem('gemini_api_key');
console.log('Configured keys:', keys?.split(',').length);
```

---

### Cost Estimation

| Operation | Estimated Tokens | Frequency |
|-----------|------------------|-----------|
| Document metadata | ~2,000 output | Per document |
| Document analysis | ~3,000 output | Per document × 2 perspectives |
| Perspective synthesis | ~5,000 output | Per perspective |
| Courtroom turn | ~500 output | Per turn |
| OCR (image) | ~1,000 output | Per page |

**Example Project Cost** (10 documents, 6-turn hearing):
- Metadata: 10 × 2,000 = 20,000 tokens
- Analysis: 10 × 2 × 3,000 = 60,000 tokens
- Synthesis: 2 × 5,000 = 10,000 tokens
- Hearing: 6 × 500 = 3,000 tokens
- **Total: ~93,000 output tokens**
