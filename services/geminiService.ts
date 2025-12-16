import { GoogleGenAI, Schema, Type } from "@google/genai";
import { Project, Session, Role, SimulationMessage, CasePerspective, TimelineEvent, HearingDocument, DocumentDraft, Evidence, CaseFile, PerspectiveChatMessage, DocumentCategory, DocumentMetadata, DocumentDeepAnalysis, PrecedentCitation, DisputedFact } from "../types";
import {
  generateContentHash,
  getDocumentMetadataFromCache,
  cacheDocumentMetadata,
  getCachedPerspective,
  cachePerspective,
  getCachedDocumentAnalysis,
  cacheDocumentAnalysis
} from './cacheService';
import {
  IndianState,
  CourtLevel,
  buildJurisdictionContext,
  formatJurisdictionForPrompt,
  getHighCourtForState,
  getActsForState,
  getActByShortName,
  extractCitationsFromText,
  validateCitation,
  HIGH_COURTS,
  STATE_SPECIFIC_ACTS,
  TRIBUNALS
} from '../data/indianLaws';
import {
  formatTerminologyForPrompt,
  COURT_ADDRESS_FORMS,
  getLegalTerm,
  LEGAL_PHRASES
} from '../data/legalTerminology';
import { getRequestDeduplicator } from '../utils/requestDeduplicator';

// Initialize request deduplicator for API calls
const requestDeduplicator = getRequestDeduplicator({
  maxPendingAge: 60000, // 60 seconds for AI API calls
  debounceInterval: 100,
  enableLogging: false
});

/**
 * Safely parse JSON response from AI with validation and fallback
 * @param text - Raw text to parse
 * @param defaultValue - Default value if parsing fails
 * @param validator - Optional function to validate parsed result
 * @returns Parsed and validated object or default value
 */
const safeJsonParse = <T>(
  text: string | undefined | null,
  defaultValue: T,
  validator?: (obj: unknown) => obj is T
): T => {
  if (!text || text.trim() === '') {
    console.warn('safeJsonParse: Empty or null text received');
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(text);

    // If no validator provided, return parsed result
    if (!validator) {
      return parsed as T;
    }

    // Validate the parsed result
    if (validator(parsed)) {
      return parsed;
    }

    console.warn('safeJsonParse: Validation failed, using default value');
    return defaultValue;
  } catch (error) {
    console.error('safeJsonParse: JSON parse error:', error);
    return defaultValue;
  }
};

/**
 * Validate that a value is a non-null object
 */
const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Validate evidence type is one of the allowed values
 */
const validateEvidenceType = (type: unknown): 'documentary' | 'testimonial' | 'circumstantial' | 'physical' | 'other' => {
  const validTypes = ['documentary', 'testimonial', 'circumstantial', 'physical', 'other'] as const;
  if (typeof type === 'string' && validTypes.includes(type as typeof validTypes[number])) {
    return type as typeof validTypes[number];
  }
  return 'other';
};

/**
 * Safely get array from parsed object with fallback
 */
const safeArray = <T>(value: unknown, defaultValue: T[] = []): T[] => {
  return Array.isArray(value) ? value : defaultValue;
};

/**
 * Safely get string from parsed object with fallback
 */
const safeString = (value: unknown, defaultValue: string = ''): string => {
  return typeof value === 'string' ? value : defaultValue;
};

/**
 * Extract jurisdiction information from project/session context
 * Detects state, court level, and relevant subject matter
 */
const detectJurisdiction = (project: Project, session?: Session): {
  state?: IndianState;
  courtLevel: CourtLevel;
  subjectKeywords: string[];
} => {
  const textToAnalyze = `${project.caseTitle} ${project.description} ${session?.hearingType || ''} ${session?.hearingDescription || ''}`.toLowerCase();

  // Detect state from text
  const statePatterns: Array<{ pattern: RegExp; state: IndianState }> = [
    { pattern: /maharashtra|mumbai|bombay|pune|nagpur/i, state: 'Maharashtra' },
    { pattern: /delhi|new delhi/i, state: 'Delhi' },
    { pattern: /karnataka|bangalore|bengaluru|mysore/i, state: 'Karnataka' },
    { pattern: /tamil nadu|chennai|madras/i, state: 'Tamil Nadu' },
    { pattern: /uttar pradesh|\bu\.?p\.?\b|lucknow|allahabad|varanasi/i, state: 'Uttar Pradesh' },
    { pattern: /gujarat|ahmedabad|surat/i, state: 'Gujarat' },
    { pattern: /rajasthan|jaipur|jodhpur/i, state: 'Rajasthan' },
    { pattern: /west bengal|kolkata|calcutta/i, state: 'West Bengal' },
    { pattern: /kerala|kochi|thiruvananthapuram/i, state: 'Kerala' },
    { pattern: /andhra pradesh|hyderabad|visakhapatnam/i, state: 'Andhra Pradesh' },
    { pattern: /telangana|hyderabad/i, state: 'Telangana' },
    { pattern: /madhya pradesh|\bm\.?p\.?\b|bhopal|indore/i, state: 'Madhya Pradesh' },
    { pattern: /bihar|patna/i, state: 'Bihar' },
    { pattern: /punjab|chandigarh|amritsar/i, state: 'Punjab' },
    { pattern: /haryana|chandigarh|gurgaon|gurugram/i, state: 'Haryana' },
    { pattern: /odisha|orissa|bhubaneswar/i, state: 'Odisha' },
    { pattern: /jharkhand|ranchi/i, state: 'Jharkhand' },
    { pattern: /chhattisgarh|raipur/i, state: 'Chhattisgarh' },
    { pattern: /assam|guwahati/i, state: 'Assam' },
    { pattern: /himachal pradesh|shimla/i, state: 'Himachal Pradesh' },
    { pattern: /uttarakhand|dehradun/i, state: 'Uttarakhand' },
    { pattern: /goa|panaji/i, state: 'Goa' },
  ];

  let detectedState: IndianState | undefined;
  for (const { pattern, state } of statePatterns) {
    if (pattern.test(textToAnalyze)) {
      detectedState = state;
      break;
    }
  }

  // Detect court level
  let courtLevel: CourtLevel = 'district';
  if (/supreme court|apex court|hon'ble sc/i.test(textToAnalyze)) {
    courtLevel = 'supreme';
  } else if (/high court|hon'ble hc/i.test(textToAnalyze)) {
    courtLevel = 'high';
  } else if (/district court|civil court|sessions court/i.test(textToAnalyze)) {
    courtLevel = 'district';
  } else if (/tribunal|nclt|nclat|ngt|drt|cat/i.test(textToAnalyze)) {
    courtLevel = 'tribunal';
  } else if (/magistrate|jmfc|cjm/i.test(textToAnalyze)) {
    courtLevel = 'magistrate';
  }

  // Detect subject matter keywords
  const subjectKeywords: string[] = [];
  const subjectPatterns: Array<{ pattern: RegExp; keyword: string }> = [
    { pattern: /rent|tenancy|landlord|tenant|eviction/i, keyword: 'rent' },
    { pattern: /property|land|mutation|revenue/i, keyword: 'property' },
    { pattern: /murder|death|homicide|302/i, keyword: 'criminal' },
    { pattern: /cheque|dishonour|138|negotiable/i, keyword: 'cheque' },
    { pattern: /company|director|insolvency|ibc/i, keyword: 'company' },
    { pattern: /consumer|deficiency|product/i, keyword: 'consumer' },
    { pattern: /labour|industrial|worker|employee|wages/i, keyword: 'labour' },
    { pattern: /tax|income|gst|excise/i, keyword: 'tax' },
    { pattern: /environment|pollution|forest/i, keyword: 'environment' },
    { pattern: /divorce|maintenance|custody|marriage|498a/i, keyword: 'family' },
    { pattern: /contract|agreement|breach/i, keyword: 'contract' },
    { pattern: /motor|accident|claim|compensation/i, keyword: 'motor accident' },
    { pattern: /service|appointment|termination|departmental/i, keyword: 'service' },
    { pattern: /rera|real estate|builder|flat/i, keyword: 'real estate' },
    { pattern: /arbitration|award|dispute resolution/i, keyword: 'arbitration' },
  ];

  for (const { pattern, keyword } of subjectPatterns) {
    if (pattern.test(textToAnalyze)) {
      subjectKeywords.push(keyword);
    }
  }

  return { state: detectedState, courtLevel, subjectKeywords };
};

/**
 * Detect case type for terminology selection
 */
const detectCaseType = (project: Project, session?: Session): 'civil' | 'criminal' | 'constitutional' | 'family' | 'commercial' | 'all' => {
  const textToAnalyze = `${project.caseTitle} ${project.description} ${session?.hearingType || ''}`.toLowerCase();

  if (/murder|fir|ipc|crpc|bail|criminal|accused|prosecution|offence|crime/i.test(textToAnalyze)) {
    return 'criminal';
  }
  if (/writ|article 32|article 226|pil|fundamental right|constitution/i.test(textToAnalyze)) {
    return 'constitutional';
  }
  if (/divorce|maintenance|custody|marriage|hma|498a|domestic violence|family/i.test(textToAnalyze)) {
    return 'family';
  }
  if (/company|ibc|insolvency|nclt|commercial|arbitration|contract|cheque|138/i.test(textToAnalyze)) {
    return 'commercial';
  }
  if (/suit|decree|injunction|property|civil|specific performance/i.test(textToAnalyze)) {
    return 'civil';
  }
  return 'all';
};

/**
 * Build jurisdiction-aware context for AI prompts
 */
const buildJurisdictionPromptSection = (project: Project, session?: Session): string => {
  const { state, courtLevel, subjectKeywords } = detectJurisdiction(project, session);

  if (!state && subjectKeywords.length === 0) {
    return ''; // No jurisdiction context to add
  }

  const context = buildJurisdictionContext(state, courtLevel, subjectKeywords);
  return formatJurisdictionForPrompt(context);
};

/**
 * Build terminology guidelines for AI prompts
 */
const buildTerminologyPromptSection = (project: Project, session?: Session): string => {
  const caseType = detectCaseType(project, session);
  return formatTerminologyForPrompt(caseType);
};

// Track failed API keys with timestamp (to allow retry after cooldown)
const failedKeys: Map<string, number> = new Map();
const KEY_COOLDOWN_MS = 60000; // 1 minute cooldown before retrying a failed key

// Helper to get all available API keys
const getAllApiKeys = (): string[] => {
  const keys: string[] = [];

  // First, check localStorage for user-entered keys (comma-separated)
  const localKeys = localStorage.getItem("gemini_api_key");
  if (localKeys) {
    const parsed = localKeys.split(",").map(k => k.trim()).filter(k => k.length > 0);
    keys.push(...parsed);
  }

  // Then, check environment variables (comma-separated)
  const envKeys = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (envKeys) {
    const parsed = envKeys.split(",").map(k => k.trim()).filter(k => k.length > 0);
    keys.push(...parsed);
  }

  return [...new Set(keys)];
};

// Get available keys (excluding recently failed ones)
const getAvailableKeys = (): string[] => {
  const allKeys = getAllApiKeys();
  const now = Date.now();

  return allKeys.filter(key => {
    const failedAt = failedKeys.get(key);
    if (!failedAt) return true;
    if (now - failedAt > KEY_COOLDOWN_MS) {
      failedKeys.delete(key);
      return true;
    }
    return false;
  });
};

// Mark a key as failed
const markKeyFailed = (key: string): void => {
  failedKeys.set(key, Date.now());
  console.warn(`API key ending in ...${key.slice(-4)} marked as failed. Will retry after cooldown.`);
};

// Helper to execute API call with fallback
const executeWithFallback = async <T>(
  operation: (client: GoogleGenAI) => Promise<T>
): Promise<T> => {
  const availableKeys = getAvailableKeys();

  if (availableKeys.length === 0) {
    const allKeys = getAllApiKeys();
    if (allKeys.length === 0) {
      throw new Error("API Key is missing. Please enter your Gemini API Key in the sidebar.");
    }
    throw new Error("All API keys are temporarily unavailable. Please wait a moment and try again.");
  }

  let lastError: Error | null = null;

  for (const key of availableKeys) {
    try {
      const client = new GoogleGenAI({ apiKey: key });
      const result = await operation(client);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`API call failed with key ...${key.slice(-4)}:`, lastError.message);

      const errorMsg = lastError.message.toLowerCase();
      if (
        errorMsg.includes("rate") ||
        errorMsg.includes("quota") ||
        errorMsg.includes("limit") ||
        errorMsg.includes("unauthorized") ||
        errorMsg.includes("invalid") ||
        errorMsg.includes("api key") ||
        errorMsg.includes("403") ||
        errorMsg.includes("429")
      ) {
        markKeyFailed(key);
      }
    }
  }

  throw lastError || new Error("All API keys failed.");
};

/**
 * Extract metadata and deep analysis from a document using AI
 * Uses content-hash based caching to avoid redundant API calls
 */
export const extractDocumentMetadata = async (
  fileName: string,
  content: string,
  onProgress?: (status: string) => void,
  skipCache: boolean = false
): Promise<DocumentMetadata> => {
  const modelId = "gemini-2.5-flash";

  // Check cache first (unless explicitly skipped)
  if (!skipCache) {
    try {
      const cachedMetadata = await getDocumentMetadataFromCache(content);
      if (cachedMetadata) {
        console.log(`Cache hit for document: ${fileName}`);
        onProgress?.(`Using cached analysis for "${fileName}"`);
        return cachedMetadata;
      }
    } catch (error) {
      console.warn('Cache lookup failed, proceeding with API call:', error);
    }
  }

  // Generate content hash for request deduplication
  const contentHash = await generateContentHash(content);
  const requestKey = `extractMetadata:${contentHash}`;

  // Check if there's already a pending request for this content
  if (requestDeduplicator.isPending(requestKey)) {
    console.log(`Returning pending request for document: ${fileName}`);
    onProgress?.(`Waiting for pending analysis of similar document...`);
  }

  onProgress?.(`Analyzing "${fileName}"...`);

  const metadataSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: "Document category: FIR, Affidavit, Evidence, Court Proceeding, Court Order, Judgment, Petition, Reply/Written Statement, Witness Statement, Charge Sheet, Medical Report, Forensic Report, Legal Opinion, or Other"
      },
      date: {
        type: Type.STRING,
        description: "Date of the document if mentioned (e.g., '15 March 2024')"
      },
      filedBy: {
        type: Type.STRING,
        description: "Who filed/submitted this document (e.g., 'Petitioner', 'Respondent No. 2', 'State')"
      },
      courtName: {
        type: Type.STRING,
        description: "Name of the court if mentioned"
      },
      caseNumber: {
        type: Type.STRING,
        description: "Case number/reference if mentioned"
      },
      description: {
        type: Type.STRING,
        description: "Brief description of what this document contains (2-3 sentences)"
      },
      contextNotes: {
        type: Type.STRING,
        description: "Important context notes for understanding this document correctly"
      },
      parties: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Names of parties mentioned in this document"
      },
      suggestedName: {
        type: Type.STRING,
        description: "Suggested document name based on content (e.g., 'FIR_123_2024_Delhi', 'Court_Order_15Mar2024')"
      },
      deepAnalysis: {
        type: Type.OBJECT,
        properties: {
          documentType: {
            type: Type.STRING,
            description: "Specific type of legal document"
          },
          summary: {
            type: Type.STRING,
            description: "Brief summary of the document contents (3-5 sentences)"
          },
          keyPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key points/takeaways from this document"
          },
          legalSections: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Legal sections/laws referenced (e.g., 'Section 302 IPC', 'Section 164 CrPC')"
          },
          datesMentioned: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Important dates mentioned in the document"
          },
          partiesInvolved: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Parties involved with their roles"
          },
          reliefSought: {
            type: Type.STRING,
            description: "What relief/action is being sought (if applicable)"
          },
          currentStatus: {
            type: Type.STRING,
            description: "Current status of the matter as per this document"
          },
          importantQuotes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Important quotes/statements from the document"
          },
          analysisNotes: {
            type: Type.STRING,
            description: "AI's notes on how to correctly interpret this document"
          }
        },
        required: ["documentType", "summary", "keyPoints"]
      }
    },
    required: ["category", "description", "suggestedName", "deepAnalysis"]
  };

  const prompt = `
You are an expert Indian Legal Document Analyst. Analyze this document and extract comprehensive metadata.

FILE NAME: ${fileName}

DOCUMENT CONTENT:
${content.substring(0, 20000)}

TASK: Extract detailed metadata and provide deep analysis of this document.

IMPORTANT INSTRUCTIONS:
1. Identify the CATEGORY from these options:
   - FIR: First Information Report
   - Affidavit: Sworn statement
   - Evidence: Physical/documentary evidence
   - Court Proceeding: Record of court proceedings
   - Court Order: Order passed by court
   - Judgment: Final judgment/decree
   - Petition: Writ petition, appeal petition, etc.
   - Reply/Written Statement: Response to petition/plaint
   - Witness Statement: Statement of witness (under Section 161/164 CrPC)
   - Charge Sheet: Police charge sheet
   - Medical Report: Medical examination report
   - Forensic Report: Forensic analysis report
   - Legal Opinion: Legal opinion document
   - Other: If none of the above

2. For SUGGESTED NAME, create a descriptive name like:
   - "FIR_[number]_[year]_[place]"
   - "Court_Order_[date]_[type]"
   - "Judgment_[case]_[court]_[date]"
   - "[Party]_Petition_[type]_[date]"

3. In CONTEXT NOTES, explain:
   - How to correctly interpret this document
   - Common misinterpretations to avoid
   - Whether it contains party submissions vs court findings (CRITICAL!)

4. DISTINGUISH FACT SOURCES (VERY IMPORTANT):
   When analyzing this document, clearly distinguish between:
   - COURT FINDINGS: Facts/conclusions DETERMINED BY THE COURT after hearing both sides
     - These are authoritative and binding on the parties
     - Look for phrases: "The Court finds...", "It is established that...", "The evidence proves..."
   - ADMITTED FACTS: Facts AGREED BY BOTH PARTIES
     - These are not disputed and can be relied upon
     - Look for phrases: "It is admitted that...", "Both parties agree...", "Undisputed facts..."
   - PARTY CLAIMS: Allegations/contentions made by ONE PARTY (not yet proven)
     - These are NOT FACTS until proven in court
     - Look for phrases: "The petitioner alleges...", "According to the respondent...", "It is submitted that..."
   - DISPUTED FACTS: Facts claimed by one party but contested by the other
     - These require evidence to be established

   This distinction is CRITICAL for legal analysis. NEVER treat a party's claim as established fact.

5. In DEEP ANALYSIS:
   - Be thorough and extract all relevant information
   - Identify legal sections with full citations
   - Note important quotes verbatim if significant
   - Explain the significance of this document to the case
   - For each key fact extracted, note whether it is a court finding, admitted, or alleged

Be accurate and thorough - this metadata will help in correct case analysis.
`;

  // Use request deduplication to prevent duplicate API calls
  return requestDeduplicator.execute(requestKey, async () => {
    try {
      const response = await executeWithFallback(async (ai) => {
        return await ai.models.generateContent({
          model: modelId,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: metadataSchema,
          }
        });
      });

      // Safely parse JSON with validation
      const json = safeJsonParse<Record<string, unknown>>(response.text, {}, isObject);

      // Map category string to enum
      const categoryMap: Record<string, DocumentCategory> = {
        'FIR': DocumentCategory.FIR,
        'Affidavit': DocumentCategory.Affidavit,
        'Evidence': DocumentCategory.Evidence,
        'Court Proceeding': DocumentCategory.CourtProceeding,
        'Court Order': DocumentCategory.CourtOrder,
        'Judgment': DocumentCategory.Judgment,
        'Petition': DocumentCategory.Petition,
        'Reply/Written Statement': DocumentCategory.Reply,
        'Witness Statement': DocumentCategory.Witness,
        'Charge Sheet': DocumentCategory.ChargeSheet,
        'Medical Report': DocumentCategory.MedicalReport,
        'Forensic Report': DocumentCategory.ForensicReport,
        'Legal Opinion': DocumentCategory.LegalOpinion,
        'Other': DocumentCategory.Other
      };

      const categoryStr = safeString(json.category, 'Other');
      const category = categoryMap[categoryStr] || DocumentCategory.Other;

      // Safely extract deep analysis
      const rawDeepAnalysis = isObject(json.deepAnalysis) ? json.deepAnalysis : {};
      const deepAnalysis: DocumentDeepAnalysis = {
        documentType: safeString(rawDeepAnalysis.documentType, 'Unknown'),
        summary: safeString(rawDeepAnalysis.summary),
        keyPoints: safeArray<string>(rawDeepAnalysis.keyPoints),
        legalSections: Array.isArray(rawDeepAnalysis.legalSections) ? rawDeepAnalysis.legalSections as string[] : undefined,
        datesMentioned: Array.isArray(rawDeepAnalysis.datesMentioned) ? rawDeepAnalysis.datesMentioned as string[] : undefined,
        partiesInvolved: Array.isArray(rawDeepAnalysis.partiesInvolved) ? rawDeepAnalysis.partiesInvolved as string[] : undefined,
        reliefSought: typeof rawDeepAnalysis.reliefSought === 'string' ? rawDeepAnalysis.reliefSought : undefined,
        currentStatus: typeof rawDeepAnalysis.currentStatus === 'string' ? rawDeepAnalysis.currentStatus : undefined,
        importantQuotes: Array.isArray(rawDeepAnalysis.importantQuotes) ? rawDeepAnalysis.importantQuotes as string[] : undefined,
        analysisNotes: typeof rawDeepAnalysis.analysisNotes === 'string' ? rawDeepAnalysis.analysisNotes : undefined
      };

      const metadata: DocumentMetadata = {
        category,
        date: typeof json.date === 'string' ? json.date : undefined,
        filedBy: typeof json.filedBy === 'string' ? json.filedBy : undefined,
        courtName: typeof json.courtName === 'string' ? json.courtName : undefined,
        caseNumber: typeof json.caseNumber === 'string' ? json.caseNumber : undefined,
        description: safeString(json.description),
        contextNotes: typeof json.contextNotes === 'string' ? json.contextNotes : undefined,
        parties: Array.isArray(json.parties) ? json.parties as string[] : undefined,
        suggestedName: safeString(json.suggestedName, fileName),
        deepAnalysis
      };

      // Cache the successful result
      try {
        await cacheDocumentMetadata(fileName, content, metadata);
      } catch (cacheError) {
        console.warn('Failed to cache document metadata:', cacheError);
      }

      return metadata;
    } catch (error) {
      console.error(`Error extracting metadata for ${fileName}:`, error);
      // Return default metadata on error (don't cache errors)
      return {
        category: DocumentCategory.Other,
        description: 'Metadata extraction failed',
        suggestedName: fileName
      };
    }
  });
};

/**
 * Extract metadata for multiple documents in parallel
 */
export const extractAllDocumentsMetadata = async (
  files: { name: string; content: string; id: string }[],
  onProgress?: (status: string, current: number, total: number) => void
): Promise<Map<string, DocumentMetadata>> => {
  const results = new Map<string, DocumentMetadata>();

  // Process in parallel batches to avoid overwhelming the API
  const BATCH_SIZE = 3;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    onProgress?.(`Analyzing documents ${i + 1}-${Math.min(i + BATCH_SIZE, files.length)} of ${files.length}...`, i + 1, files.length);

    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const metadata = await extractDocumentMetadata(file.name, file.content);
        return { id: file.id, metadata };
      })
    );

    batchResults.forEach(({ id, metadata }) => {
      results.set(id, metadata);
    });
  }

  return results;
};

/**
 * Re-generate perspective after chronology edit
 */
export const regeneratePerspectiveFromEdit = async (
  caseTitle: string,
  description: string,
  existingPerspective: CasePerspective,
  onProgress?: (status: string) => void
): Promise<CasePerspective> => {
  const modelId = "gemini-2.5-flash";
  const perspectiveRole = existingPerspective.role;

  onProgress?.(`Re-analyzing ${perspectiveRole}'s case with updated chronology...`);

  const synthesisSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      keyFacts: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Updated key facts based on revised chronology"
      },
      legalTheory: {
        type: Type.STRING,
        description: "Updated legal theory considering the revised events"
      },
      strengths: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Updated strengths"
      },
      weaknesses: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Updated weaknesses"
      }
    },
    required: ["keyFacts", "legalTheory", "strengths", "weaknesses"]
  };

  const chronologyText = existingPerspective.chronology
    .map((e, i) => `${i + 1}. ${e.date || 'Unknown date'}: ${e.description} (Significance: ${e.significance})`)
    .join('\n');

  const evidencesText = existingPerspective.evidences
    .map(e => `- ${e.title}: ${e.description}`)
    .join('\n');

  const prompt = `
You are an expert Indian Legal Analyst. The user has EDITED the chronology for the ${perspectiveRole}'s case.
Re-analyze the case based on the UPDATED chronology.

Case Title: ${caseTitle}
Case Description: ${description}

UPDATED CHRONOLOGY (edited by user):
${chronologyText}

EXISTING EVIDENCES:
${evidencesText}

PREVIOUS KEY FACTS:
${existingPerspective.keyFacts.join('\n')}

PREVIOUS LEGAL THEORY:
${existingPerspective.legalTheory}

TASK: Based on the UPDATED chronology, revise:
1. Key facts - align with the new timeline
2. Legal theory - update to reflect any new narrative
3. Strengths - identify what's stronger now
4. Weaknesses - identify any new vulnerabilities

Focus on Indian Laws. Be thorough.
`;

  try {
    const response = await executeWithFallback(async (ai) => {
      return await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: synthesisSchema,
        }
      });
    });

    const json = safeJsonParse<Record<string, unknown>>(response.text, {}, isObject);

    return {
      ...existingPerspective,
      keyFacts: safeArray<string>(json.keyFacts, existingPerspective.keyFacts),
      legalTheory: safeString(json.legalTheory, existingPerspective.legalTheory),
      strengths: safeArray<string>(json.strengths, existingPerspective.strengths),
      weaknesses: safeArray<string>(json.weaknesses, existingPerspective.weaknesses),
      generatedAt: Date.now(),
      isEdited: true
    };
  } catch (error) {
    console.error(`Error regenerating ${perspectiveRole} perspective:`, error);
    throw error;
  }
};

/**
 * Analyze a single document from one party's perspective
 */
export const analyzeDocument = async (
  caseTitle: string,
  description: string,
  document: CaseFile,
  perspectiveRole: Role.Petitioner | Role.Respondent,
  onProgress?: (status: string) => void
): Promise<DocumentDraft> => {
  const modelId = "gemini-2.5-flash";

  onProgress?.(`Analyzing "${document.name}" for ${perspectiveRole}...`);

  const documentDraftSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description: "Summary of this document from the party's perspective"
      },
      extractedFacts: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Facts extracted from this document that support this party's case"
      },
      extractedEvents: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "Date of event if mentioned" },
            description: { type: Type.STRING, description: "What happened" },
            significance: { type: Type.STRING, description: "Legal significance for this party" }
          },
          required: ["description", "significance"]
        },
        description: "Timeline events mentioned in this document"
      },
      extractedEvidences: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Title/name of the evidence" },
            description: { type: Type.STRING, description: "Description of the evidence" },
            relevance: { type: Type.STRING, description: "Why this evidence matters for this party" },
            supportingQuote: { type: Type.STRING, description: "Direct quote from document if available" },
            type: { type: Type.STRING, description: "Type of evidence: documentary, testimonial, circumstantial, physical, or other" }
          },
          required: ["title", "description", "relevance", "type"]
        },
        description: "Evidence items found in this document"
      },
      legalImplications: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Legal implications and relevant law sections from this document"
      }
    },
    required: ["summary", "extractedFacts", "extractedEvents", "extractedEvidences", "legalImplications"]
  };

  // Build document context from metadata
  const metadata = document.metadata;
  const metadataContext = metadata ? `
DOCUMENT METADATA (provided by user):
- Category: ${metadata.category}
${metadata.date ? `- Document Date: ${metadata.date}` : ''}
${metadata.filedBy ? `- Filed By: ${metadata.filedBy}` : ''}
${metadata.courtName ? `- Court: ${metadata.courtName}` : ''}
${metadata.description ? `- User Description: ${metadata.description}` : ''}
${metadata.contextNotes ? `- IMPORTANT CONTEXT: ${metadata.contextNotes}` : ''}
` : '';

  const prompt = `
You are an expert Indian Legal Analyst. Analyze this SINGLE document AS THE ${perspectiveRole}.

Case Title: ${caseTitle}
Case Description: ${description}

DOCUMENT NAME: ${document.name}
${metadataContext}
DOCUMENT CONTENT:
${document.content.substring(0, 15000)}

CRITICAL INSTRUCTIONS FOR ACCURATE ANALYSIS:

1. DISTINGUISH BETWEEN DIFFERENT TYPES OF CONTENT IN LEGAL DOCUMENTS:
   - COURT'S OBSERVATIONS/RULINGS: Statements where the court itself makes findings, orders, or rulings
   - PARTY SUBMISSIONS: When the document records what a party (Petitioner, Respondent, accused, complainant) has argued or submitted - this is NOT the court's view
   - FACTS ON RECORD: Undisputed facts admitted by both parties or established through evidence

2. IN COURT PROCEEDINGS/ORDERS:
   - Phrases like "The petitioner submitted that...", "Respondent No.2 contended...", "It was argued by counsel..." are PARTY SUBMISSIONS, not court findings
   - Phrases like "The Court finds...", "It is held that...", "This Court is of the view..." are ACTUAL COURT RULINGS
   - Be very careful not to confuse recorded arguments with court's conclusions

3. FOR ${perspectiveRole}'S ANALYSIS:
   - Identify what actually supports or hurts the ${perspectiveRole}'s case
   - Note the source of each fact (is it a court finding, admitted fact, or just a party's claim?)
   - Distinguish between proven facts and mere allegations

TASK: Extract all relevant information from this document FROM THE ${perspectiveRole}'S PERSPECTIVE.

You must:
1. Summarize what this document contains and how it helps/hurts the ${perspectiveRole}
2. Extract specific facts - clearly noting if they are:
   - Court findings (strong evidentiary value)
   - Admitted facts (moderate value)
   - Party claims/submissions (weak - needs corroboration)
3. Identify timeline events with dates if mentioned
4. Identify evidence items (documentary, testimonial, circumstantial, physical evidence)
5. Note legal implications with specific Indian law sections (IPC, CrPC, Evidence Act, etc.)

Be thorough and ACCURATE - do not confuse party submissions with court rulings.
`;

  try {
    const response = await executeWithFallback(async (ai) => {
      return await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: documentDraftSchema,
        }
      });
    });

    const json = safeJsonParse<Record<string, unknown>>(response.text, {}, isObject);

    // Transform events to include IDs with validation
    const rawEvents = safeArray<Record<string, unknown>>(json.extractedEvents);
    const extractedEvents: TimelineEvent[] = rawEvents.map((event, index: number) => ({
      id: `event_${document.id}_${Date.now()}_${index}`,
      date: typeof event.date === 'string' ? event.date : undefined,
      description: safeString(event.description),
      source: document.name,
      significance: safeString(event.significance),
      order: index
    }));

    // Transform evidences to include IDs with validation
    const rawEvidences = safeArray<Record<string, unknown>>(json.extractedEvidences);
    const extractedEvidences: Evidence[] = rawEvidences.map((ev, index: number) => ({
      id: `evidence_${document.id}_${Date.now()}_${index}`,
      title: safeString(ev.title, `Evidence ${index + 1}`),
      description: safeString(ev.description),
      sourceDocument: document.name,
      relevance: safeString(ev.relevance),
      supportingQuote: typeof ev.supportingQuote === 'string' ? ev.supportingQuote : undefined,
      type: validateEvidenceType(ev.type)
    }));

    return {
      id: `draft_${document.id}_${perspectiveRole}_${Date.now()}`,
      documentId: document.id,
      documentName: document.name,
      role: perspectiveRole,
      summary: safeString(json.summary),
      extractedFacts: safeArray<string>(json.extractedFacts),
      extractedEvents,
      extractedEvidences,
      legalImplications: safeArray<string>(json.legalImplications),
      analyzedAt: Date.now()
    };
  } catch (error) {
    console.error(`Error analyzing document ${document.name}:`, error);
    throw error;
  }
};

/**
 * Analyze all documents one by one for a perspective
 */
export const analyzeAllDocuments = async (
  caseTitle: string,
  description: string,
  documents: CaseFile[],
  perspectiveRole: Role.Petitioner | Role.Respondent,
  onProgress?: (status: string, current: number, total: number) => void
): Promise<DocumentDraft[]> => {
  const drafts: DocumentDraft[] = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    onProgress?.(`Analyzing document ${i + 1}/${documents.length}: ${doc.name}`, i + 1, documents.length);

    const draft = await analyzeDocument(caseTitle, description, doc, perspectiveRole);
    drafts.push(draft);
  }

  return drafts;
};

/**
 * Generate final perspective by combining all document drafts
 */
export const generatePerspectiveFromDrafts = async (
  caseTitle: string,
  description: string,
  drafts: DocumentDraft[],
  perspectiveRole: Role.Petitioner | Role.Respondent,
  onProgress?: (status: string) => void
): Promise<CasePerspective> => {
  const modelId = "gemini-2.5-flash";

  onProgress?.(`Synthesizing ${perspectiveRole}'s case from ${drafts.length} documents...`);

  // Compile all extracted information from drafts
  const draftSummaries = drafts.map(d =>
    `Document: ${d.documentName}\nSummary: ${d.summary}\nFacts: ${d.extractedFacts.join('; ')}\nLegal Implications: ${d.legalImplications.join('; ')}`
  ).join('\n\n---\n\n');

  // Collect all events and evidences from drafts
  const allEvents = drafts.flatMap(d => d.extractedEvents);
  const allEvidences = drafts.flatMap(d => d.extractedEvidences);
  const allFacts = drafts.flatMap(d => d.extractedFacts);

  const synthesisSchema: Schema = {
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
        },
        description: "Unified timeline of events supporting this party's case"
      },
      keyFacts: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Most important facts that support this party's case (synthesized from all documents)"
      },
      evidences: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            sourceDocument: { type: Type.STRING },
            relevance: { type: Type.STRING },
            supportingQuote: { type: Type.STRING },
            type: { type: Type.STRING }
          },
          required: ["title", "description", "relevance", "type"]
        },
        description: "Key evidence items to present in court"
      },
      legalTheory: {
        type: Type.STRING,
        description: "The overall legal theory and position of this party"
      },
      strengths: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Strengths of this party's case"
      },
      weaknesses: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Potential weaknesses or challenges in this party's case"
      }
    },
    required: ["chronology", "keyFacts", "evidences", "legalTheory", "strengths", "weaknesses"]
  };

  const prompt = `
You are an expert Indian Legal Analyst. You have analyzed ${drafts.length} documents individually for the ${perspectiveRole}.
Now synthesize all findings into a comprehensive case perspective.

Case Title: ${caseTitle}
Case Description: ${description}

DOCUMENT-BY-DOCUMENT ANALYSIS:
${draftSummaries.substring(0, 20000)}

EXTRACTED FACTS FROM ALL DOCUMENTS:
${allFacts.slice(0, 30).join('\n')}

TASK: Create a UNIFIED, COMPREHENSIVE case analysis for the ${perspectiveRole}.

STATE-SPECIFIC LAW AWARENESS:
- When referencing land/property laws, consider state-specific acts (e.g., Maharashtra Land Revenue Code, Karnataka Land Reforms Act)
- For rent control matters, cite the applicable state rent control act
- For criminal matters, cite IPC/CrPC but also consider state-specific amendments
- For family matters, consider personal law applications (Hindu Marriage Act, Muslim Personal Law, etc.)
- Always prefer Supreme Court precedents, then applicable High Court precedents

You must:
1. Create a unified chronology (combine and deduplicate events, arrange in order)
2. Select the most important key facts (remove duplicates, prioritize strongest)
3. Compile the best evidence items with proper attribution
4. Develop a cohesive legal theory that ties everything together
5. Identify overall strengths based on all documents
6. Acknowledge weaknesses considering the full picture

Focus on Indian Laws (IPC, CrPC, Indian Evidence Act, specific Acts relevant to the case).
This is the FINAL perspective that will guide courtroom arguments.
`;

  try {
    const response = await executeWithFallback(async (ai) => {
      return await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: synthesisSchema,
        }
      });
    });

    const json = safeJsonParse<Record<string, unknown>>(response.text, {}, isObject);

    // Transform chronology with validation
    const rawChronology = safeArray<Record<string, unknown>>(json.chronology);
    const chronology: TimelineEvent[] = rawChronology.map((event, index: number) => ({
      id: `event_final_${Date.now()}_${index}`,
      date: typeof event.date === 'string' ? event.date : undefined,
      description: safeString(event.description),
      source: typeof event.source === 'string' ? event.source : undefined,
      significance: safeString(event.significance),
      order: index
    }));

    // Transform evidences with validation
    const rawEvidences = safeArray<Record<string, unknown>>(json.evidences);
    const evidences: Evidence[] = rawEvidences.map((ev, index: number) => ({
      id: `evidence_final_${Date.now()}_${index}`,
      title: safeString(ev.title, `Evidence ${index + 1}`),
      description: safeString(ev.description),
      sourceDocument: safeString(ev.sourceDocument, "Multiple documents"),
      relevance: safeString(ev.relevance),
      supportingQuote: typeof ev.supportingQuote === 'string' ? ev.supportingQuote : undefined,
      type: validateEvidenceType(ev.type)
    }));

    return {
      role: perspectiveRole,
      chronology,
      keyFacts: safeArray<string>(json.keyFacts),
      evidences,
      legalTheory: safeString(json.legalTheory),
      strengths: safeArray<string>(json.strengths),
      weaknesses: safeArray<string>(json.weaknesses),
      generatedAt: Date.now(),
      isEdited: false,
      documentDrafts: drafts,
      chatHistory: []
    };
  } catch (error) {
    console.error(`Error synthesizing ${perspectiveRole} perspective:`, error);
    throw error;
  }
};

/**
 * Chat with perspective agent to update/revise the perspective
 */
export const chatWithPerspectiveAgent = async (
  project: Project,
  perspective: CasePerspective,
  userMessage: string,
  attachedFiles?: CaseFile[],
  onProgress?: (status: string) => void
): Promise<{
  agentResponse: string;
  updatedPerspective: CasePerspective;
  updatesApplied: string[];
}> => {
  const modelId = "gemini-2.5-flash";

  onProgress?.(`${perspective.role} agent is reviewing your feedback...`);

  // Get all document contents for reference with metadata
  const documentContents = project.files.map(f => {
    const meta = f.metadata;
    const metaStr = meta ? `[Category: ${meta.category}${meta.filedBy ? `, Filed by: ${meta.filedBy}` : ''}${meta.contextNotes ? `, Context: ${meta.contextNotes}` : ''}]` : '';
    return `Document: ${f.name} ${metaStr}\n${f.content}`;
  }).join('\n\n---\n\n').substring(0, 25000);

  // Include newly attached files
  const attachedContent = attachedFiles && attachedFiles.length > 0
    ? `\n\nNEWLY ATTACHED FILES BY USER:\n${attachedFiles.map(f => {
        const meta = f.metadata;
        const metaStr = meta ? `[Category: ${meta.category}${meta.filedBy ? `, Filed by: ${meta.filedBy}` : ''}${meta.contextNotes ? `, Context: ${meta.contextNotes}` : ''}]` : '';
        return `File: ${f.name} ${metaStr}\n${f.content.substring(0, 5000)}`;
      }).join('\n\n---\n\n')}`
    : '';

  const chatSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      response: {
        type: Type.STRING,
        description: "Agent's response to the user explaining what was found/updated"
      },
      updatesApplied: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of updates made to the perspective"
      },
      newFacts: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "New facts to add (if any)"
      },
      newEvents: {
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
        },
        description: "New timeline events to add (if any)"
      },
      newEvidences: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            sourceDocument: { type: Type.STRING },
            relevance: { type: Type.STRING },
            supportingQuote: { type: Type.STRING },
            type: { type: Type.STRING }
          },
          required: ["title", "description", "relevance", "type"]
        },
        description: "New evidence items to add (if any)"
      },
      revisedLegalTheory: {
        type: Type.STRING,
        description: "Revised legal theory if needed (empty string if no change)"
      },
      newStrengths: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "New strengths to add (if any)"
      },
      newWeaknesses: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "New weaknesses to add (if any)"
      }
    },
    required: ["response", "updatesApplied"]
  };

  const prompt = `
You are an expert Indian Legal Analyst representing the ${perspective.role}.

CASE: ${project.caseTitle}
${project.description}

CURRENT ${perspective.role.toUpperCase()}'S PERSPECTIVE:
Legal Theory: ${perspective.legalTheory}
Key Facts: ${perspective.keyFacts.join('\n- ')}
Evidences: ${perspective.evidences.map(e => e.title).join(', ')}
Strengths: ${perspective.strengths.join('\n- ')}
Weaknesses: ${perspective.weaknesses.join('\n- ')}

CASE DOCUMENTS (for reference):
${documentContents}
${attachedContent}

USER'S MESSAGE:
${userMessage}

CRITICAL: When analyzing documents, distinguish between:
- COURT FINDINGS/RULINGS (strong evidence - what the court concluded)
- PARTY SUBMISSIONS (weak - just what a party argued, needs corroboration)
- ADMITTED FACTS (moderate - accepted by both parties)

TASK: Review the user's message and:
1. If they point out something you missed, CHECK THE DOCUMENTS and find it
2. If they attached new files, analyze them thoroughly
3. If they want to add/modify something, incorporate it
4. If they have questions, answer based on the documents
5. Explain what you found and what updates you're making

Be thorough - if the user says you missed something, search the documents carefully.
`;

  try {
    const response = await executeWithFallback(async (ai) => {
      return await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: chatSchema,
        }
      });
    });

    const json = safeJsonParse<Record<string, unknown>>(response.text, {}, isObject);

    // Build updated perspective
    const updatedPerspective: CasePerspective = {
      ...perspective,
      isEdited: true,
      generatedAt: Date.now()
    };

    // Add new facts with validation
    const newFacts = safeArray<string>(json.newFacts);
    if (newFacts.length > 0) {
      updatedPerspective.keyFacts = [...perspective.keyFacts, ...newFacts];
    }

    // Add new events with validation
    const rawNewEvents = safeArray<Record<string, unknown>>(json.newEvents);
    if (rawNewEvents.length > 0) {
      const newTimelineEvents: TimelineEvent[] = rawNewEvents.map((event, index: number) => ({
        id: `event_chat_${Date.now()}_${index}`,
        date: typeof event.date === 'string' ? event.date : undefined,
        description: safeString(event.description),
        source: safeString(event.source, "User feedback"),
        significance: safeString(event.significance),
        order: perspective.chronology.length + index
      }));
      updatedPerspective.chronology = [...perspective.chronology, ...newTimelineEvents];
    }

    // Add new evidences with validation
    const rawNewEvidences = safeArray<Record<string, unknown>>(json.newEvidences);
    if (rawNewEvidences.length > 0) {
      const newEvidenceItems: Evidence[] = rawNewEvidences.map((ev, index: number) => ({
        id: `evidence_chat_${Date.now()}_${index}`,
        title: safeString(ev.title, `Evidence ${index + 1}`),
        description: safeString(ev.description),
        sourceDocument: safeString(ev.sourceDocument, "User identified"),
        relevance: safeString(ev.relevance),
        supportingQuote: typeof ev.supportingQuote === 'string' ? ev.supportingQuote : undefined,
        type: validateEvidenceType(ev.type)
      }));
      updatedPerspective.evidences = [...perspective.evidences, ...newEvidenceItems];
    }

    // Update legal theory if provided
    const revisedLegalTheory = safeString(json.revisedLegalTheory);
    if (revisedLegalTheory.length > 0) {
      updatedPerspective.legalTheory = revisedLegalTheory;
    }

    // Add new strengths with validation
    const newStrengths = safeArray<string>(json.newStrengths);
    if (newStrengths.length > 0) {
      updatedPerspective.strengths = [...perspective.strengths, ...newStrengths];
    }

    // Add new weaknesses with validation
    const newWeaknesses = safeArray<string>(json.newWeaknesses);
    if (newWeaknesses.length > 0) {
      updatedPerspective.weaknesses = [...perspective.weaknesses, ...newWeaknesses];
    }

    // Add chat message to history
    const userChatMsg: PerspectiveChatMessage = {
      id: `chat_user_${Date.now()}`,
      role: 'user',
      text: userMessage,
      timestamp: Date.now()
    };

    const agentResponse = safeString(json.response, "I've reviewed your feedback.");
    const agentChatMsg: PerspectiveChatMessage = {
      id: `chat_agent_${Date.now()}`,
      role: 'agent',
      text: agentResponse,
      timestamp: Date.now(),
      updatesApplied: safeArray<string>(json.updatesApplied)
    };

    updatedPerspective.chatHistory = [...perspective.chatHistory, userChatMsg, agentChatMsg];

    return {
      agentResponse,
      updatedPerspective,
      updatesApplied: safeArray<string>(json.updatesApplied)
    };
  } catch (error) {
    console.error("Error in chat with perspective agent:", error);
    throw error;
  }
};

/**
 * Legacy: Generate a case perspective for one side (kept for backward compatibility)
 * For new document-by-document analysis, use analyzeAllDocuments + generatePerspectiveFromDrafts
 */
export const generatePerspective = async (
  caseTitle: string,
  description: string,
  fileContents: string[],
  perspectiveRole: Role.Petitioner | Role.Respondent
): Promise<CasePerspective> => {
  const modelId = "gemini-2.5-flash";
  const combinedEvidence = fileContents.join("\n\n---\n\n").substring(0, 25000);

  const perspectiveSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      chronology: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "Date of event if known (e.g., '15 March 2024' or 'Unknown')" },
            description: { type: Type.STRING, description: "What happened" },
            source: { type: Type.STRING, description: "Document or evidence source" },
            significance: { type: Type.STRING, description: "Legal significance of this event" }
          },
          required: ["description", "significance"]
        },
        description: "Timeline of events from this party's perspective"
      },
      keyFacts: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Key facts that support this party's case"
      },
      evidences: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            sourceDocument: { type: Type.STRING },
            relevance: { type: Type.STRING },
            supportingQuote: { type: Type.STRING },
            type: { type: Type.STRING }
          },
          required: ["title", "description", "relevance", "type"]
        },
        description: "Key evidence items to present in court"
      },
      legalTheory: {
        type: Type.STRING,
        description: "The overall legal theory and position of this party"
      },
      strengths: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Strengths of this party's case"
      },
      weaknesses: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Potential weaknesses or challenges in this party's case"
      }
    },
    required: ["chronology", "keyFacts", "evidences", "legalTheory", "strengths", "weaknesses"]
  };

  const prompt = `
You are an expert Indian Legal Analyst. Analyze the following case AS THE ${perspectiveRole}.

Case Title: ${caseTitle}
Case Description: ${description}

Documents/Evidence:
${combinedEvidence}

TASK: Create a comprehensive case analysis FROM THE ${perspectiveRole}'S PERSPECTIVE.

You must:
1. Create a chronology of events that supports the ${perspectiveRole}'s position
2. Identify key facts that strengthen the ${perspectiveRole}'s case
3. Identify and compile evidence items (documentary, testimonial, circumstantial, physical)
4. Develop a legal theory explaining why the ${perspectiveRole} should prevail
5. Identify strengths that can be emphasized
6. Acknowledge weaknesses that need to be addressed

Focus on Indian Laws (IPC, CrPC, Indian Evidence Act, specific Acts relevant to the case).
Be thorough but concise. This analysis will guide courtroom arguments.
`;

  try {
    const response = await executeWithFallback(async (ai) => {
      return await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: perspectiveSchema,
        }
      });
    });

    const json = safeJsonParse<Record<string, unknown>>(response.text, {}, isObject);

    // Transform chronology to include IDs and order with validation
    const rawChronology = safeArray<Record<string, unknown>>(json.chronology);
    const chronology: TimelineEvent[] = rawChronology.map((event, index: number) => ({
      id: `event_${Date.now()}_${index}`,
      date: typeof event.date === 'string' ? event.date : undefined,
      description: safeString(event.description),
      source: typeof event.source === 'string' ? event.source : undefined,
      significance: safeString(event.significance),
      order: index
    }));

    // Transform evidences with validation
    const rawEvidences = safeArray<Record<string, unknown>>(json.evidences);
    const evidences: Evidence[] = rawEvidences.map((ev, index: number) => ({
      id: `evidence_${Date.now()}_${index}`,
      title: safeString(ev.title, `Evidence ${index + 1}`),
      description: safeString(ev.description),
      sourceDocument: safeString(ev.sourceDocument, "Case documents"),
      relevance: safeString(ev.relevance),
      supportingQuote: typeof ev.supportingQuote === 'string' ? ev.supportingQuote : undefined,
      type: validateEvidenceType(ev.type)
    }));

    return {
      role: perspectiveRole,
      chronology,
      keyFacts: safeArray<string>(json.keyFacts),
      evidences,
      legalTheory: safeString(json.legalTheory),
      strengths: safeArray<string>(json.strengths),
      weaknesses: safeArray<string>(json.weaknesses),
      generatedAt: Date.now(),
      isEdited: false,
      documentDrafts: [],
      chatHistory: []
    };
  } catch (error) {
    console.error(`Error generating ${perspectiveRole} perspective:`, error);
    throw error;
  }
};

/**
 * Generate perspectives for both Petitioner and Respondent in parallel
 */
export const generateBothPerspectives = async (
  caseTitle: string,
  description: string,
  fileContents: string[]
): Promise<{ petitioner: CasePerspective; respondent: CasePerspective }> => {
  const [petitioner, respondent] = await Promise.all([
    generatePerspective(caseTitle, description, fileContents, Role.Petitioner),
    generatePerspective(caseTitle, description, fileContents, Role.Respondent)
  ]);

  return { petitioner, respondent };
};

/**
 * Analyze recent development documents in context of the case
 */
export const analyzeRecentDevelopments = async (
  project: Project,
  developmentDocs: HearingDocument[],
  userIntent: string
): Promise<{
  summary: string;
  relevantLegalPoints: string[];
  suggestedArguments: string[];
}> => {
  const modelId = "gemini-2.5-flash";

  const userPerspective = project.userSide === Role.Petitioner
    ? project.petitionerPerspective
    : project.respondentPerspective;

  const developmentContent = developmentDocs.map(d => d.content).join("\n\n---\n\n").substring(0, 15000);

  const analysisSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description: "Summary of the recent developments"
      },
      relevantLegalPoints: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Legal points relevant to these developments"
      },
      suggestedArguments: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Suggested arguments based on user's intent and developments"
      }
    },
    required: ["summary", "relevantLegalPoints", "suggestedArguments"]
  };

  const prompt = `
You are an expert Indian Legal Analyst assisting the ${project.userSide}.

CASE CONTEXT:
Title: ${project.caseTitle}
Description: ${project.description}

${project.userSide}'S CURRENT POSITION:
Legal Theory: ${userPerspective?.legalTheory || 'Not available'}
Key Facts: ${userPerspective?.keyFacts?.join(', ') || 'Not available'}

USER'S INTENT FOR THIS HEARING:
${userIntent}

RECENT DEVELOPMENT DOCUMENTS:
${developmentContent}

TASK: Analyze these recent developments and suggest how the ${project.userSide} can use them.
Provide:
1. A summary of what these developments mean
2. Relevant legal points (cite specific Indian laws/sections)
3. Suggested arguments aligned with the user's intent
`;

  try {
    const response = await executeWithFallback(async (ai) => {
      return await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: analysisSchema,
        }
      });
    });

    const json = safeJsonParse<Record<string, unknown>>(response.text, {}, isObject);
    return {
      summary: safeString(json.summary, "Unable to analyze developments."),
      relevantLegalPoints: safeArray<string>(json.relevantLegalPoints),
      suggestedArguments: safeArray<string>(json.suggestedArguments)
    };
  } catch (error) {
    console.error("Error analyzing recent developments:", error);
    return {
      summary: "Error analyzing developments. Please check API key.",
      relevantLegalPoints: [],
      suggestedArguments: []
    };
  }
};

/**
 * Legacy function - kept for backward compatibility
 */
export const analyzeLegalContext = async (
  title: string,
  description: string,
  fileContents: string[]
): Promise<string> => {
  const modelId = "gemini-2.5-flash";
  const combinedEvidence = fileContents.join("\n\n---\n\n");

  const prompt = `
    You are an expert Indian Legal Assistant. Analyze the following case details and evidence documents.

    Case Title: ${title}
    Description: ${description}

    Evidence/Documents Content:
    ${combinedEvidence.substring(0, 20000)}

    Task:
    1. Identify key legal issues.
    2. List relevant Indian Laws, Acts (e.g., IPC, CrPC, Indian Evidence Act, Contract Act), and specific sections applicable to this case.
    3. Summarize the facts based on the provided documents.

    Output format: A concise legal brief (max 400 words) to be used as context for a courtroom simulation.
  `;

  try {
    const response = await executeWithFallback(async (ai) => {
      return await ai.models.generateContent({
        model: modelId,
        contents: prompt,
      });
    });
    return response.text || "Unable to analyze legal context.";
  } catch (error) {
    console.error("Error analyzing legal context:", error);
    return "Error generating legal context. Please ensure API Key is valid.";
  }
};

/**
 * Generates the next turn in the courtroom simulation.
 * Updated to use dual perspectives and session strategy.
 */
export const generateTurn = async (
  project: Project,
  session: Session,
  nextSpeaker: Role,
  history: SimulationMessage[]
): Promise<{ text: string; references: string[]; isUserSideAI: boolean }> => {
  const modelId = "gemini-2.5-flash";
  const historyText = history.map(h => `${h.role}: ${h.text}`).join("\n");

  // Get perspectives
  const petitionerContext = project.petitionerPerspective
    ? `Legal Theory: ${project.petitionerPerspective.legalTheory}\nKey Facts: ${project.petitionerPerspective.keyFacts.join('; ')}\nStrengths: ${project.petitionerPerspective.strengths.join('; ')}`
    : project.legalContext || 'No analysis available';

  const respondentContext = project.respondentPerspective
    ? `Legal Theory: ${project.respondentPerspective.legalTheory}\nKey Facts: ${project.respondentPerspective.keyFacts.join('; ')}\nStrengths: ${project.respondentPerspective.strengths.join('; ')}`
    : project.legalContext || 'No analysis available';

  // Get recent developments if available
  const recentDevelopments = session.recentDevelopments?.length > 0
    ? `RECENT DEVELOPMENTS:\n${session.recentDevelopments.map(d => d.content).join('\n---\n').substring(0, 5000)}`
    : '';

  // Check if generating for user's side
  const isUserSide = nextSpeaker === project.userSide;
  const userStrategy = session.userStrategy?.intent || session.reason || '';
  const userKeyPoints = session.userStrategy?.keyPoints?.join('; ') || '';

  // Get evidences for more structured arguments
  const petitionerEvidences = project.petitionerPerspective?.evidences || [];
  const respondentEvidences = project.respondentPerspective?.evidences || [];
  const relevantEvidences = nextSpeaker === Role.Petitioner
    ? petitionerEvidences.slice(0, 5).map(e => `• ${e.title}: ${e.description}`).join('\n')
    : nextSpeaker === Role.Respondent
    ? respondentEvidences.slice(0, 5).map(e => `• ${e.title}: ${e.description}`).join('\n')
    : '';

  // Get chronology for context
  const petitionerChronology = project.petitionerPerspective?.chronology || [];
  const respondentChronology = project.respondentPerspective?.chronology || [];

  // Extract key document metadata for better context
  const documentContext = project.files.slice(0, 5).map(f => {
    const meta = f.metadata;
    if (!meta) return `• ${f.name}`;
    return `• ${meta.suggestedName || f.name} (${meta.category}): ${meta.description || 'No description'}`;
  }).join('\n');

  // Build argument structure based on turn number
  const turnNumber = session.currentTurnCount + 1;
  const isEarlyTurn = turnNumber <= 2;
  const isMidTurn = turnNumber > 2 && turnNumber < session.maxTurns - 1;
  const isLateTurn = turnNumber >= session.maxTurns - 1;

  // Build jurisdiction context for state-specific law awareness
  const jurisdictionContext = buildJurisdictionPromptSection(project, session);
  // Build terminology context for correct legal language
  const terminologyContext = buildTerminologyPromptSection(project, session);

  const systemInstruction = `
You are simulating a ${nextSpeaker} in an Indian Courtroom. You must present STRUCTURED, PROFESSIONAL arguments.

CASE: ${project.caseTitle}
${project.description}
${jurisdictionContext}
${terminologyContext}

PETITIONER'S POSITION:
${petitionerContext}

RESPONDENT'S POSITION:
${respondentContext}

${recentDevelopments}

AVAILABLE DOCUMENTS:
${documentContext}

${relevantEvidences ? `
KEY EVIDENCE FOR ${nextSpeaker}:
${relevantEvidences}
` : ''}

HEARING TYPE: ${session.hearingType || session.reason || 'Court Hearing'}
${session.hearingDescription ? `HEARING DESCRIPTION: ${session.hearingDescription}` : ''}

${isUserSide ? `
USER'S STRATEGY (You are arguing for the user's side - ${project.userSide}):
Intent: ${userStrategy}
${userKeyPoints ? `Key Points to Emphasize: ${userKeyPoints}` : ''}
Follow this strategy while making your arguments.
` : ''}

=== CRITICAL INSTRUCTIONS FOR HIGH-QUALITY ARGUMENTS ===

1. STRUCTURE YOUR ARGUMENT (Use this flow):
${isEarlyTurn ? `
   - This is an OPENING turn. Present your main contentions clearly.
   - State your primary legal position upfront
   - Identify 2-3 key issues you will address
   - Reference specific documents/evidence that support your position
` : isMidTurn ? `
   - This is a MIDDLE turn. Build on previous arguments.
   - DIRECTLY RESPOND to the opposing counsel's previous arguments
   - Point out flaws in their reasoning with specific counter-evidence
   - Advance NEW legal points, don't merely repeat
   - Reference specific facts from documents
` : `
   - This is a CLOSING turn. Summarize and strengthen your position.
   - Address the strongest arguments made by opposing counsel
   - Tie together your evidence into a coherent narrative
   - Make your final request to the court clear
`}

2. AVOID REPETITION:
   - DO NOT repeat arguments already made in previous turns
   - DO NOT make the same points as the opposing party with different words
   - Each turn must ADVANCE the case with NEW insights
   - Review the transcript carefully before responding

3. BE SPECIFIC AND EVIDENCE-BASED:
   - Cite SPECIFIC facts from the case documents
   - Reference SPECIFIC dates, names, and events
   - Quote relevant portions of evidence when helpful
   - Connect legal principles to actual facts of THIS case

4. ROLE-SPECIFIC INSTRUCTIONS:
${nextSpeaker === Role.Petitioner ? `
   - You are PETITIONER. Establish violations clearly.
   - Build a narrative of how rights/laws were violated
   - Show causation between defendant's actions and harm
   - Press for specific relief with legal basis
` : nextSpeaker === Role.Respondent ? `
   - You are RESPONDENT. Deconstruct petitioner's case methodically.
   - Challenge the factual basis - point out contradictions, gaps
   - Argue legal defenses with authority
   - Attack the weakest parts of petitioner's argument
   - Raise procedural objections if applicable
` : `
   - You are the HON'BLE JUDGE.
   - If Turn ${turnNumber} of ${session.maxTurns} (final): Summarize both sides fairly, then pronounce VERDICT with reasons.
   - Otherwise: Ask pointed questions to clarify ambiguities, control proceedings, or request specific evidence.
`}

5. PROFESSIONAL COURT CONDUCT:
   - Address "My Lord" or "Your Lordship" (High Court/Supreme Court)
   - Be assertive but respectful
   - Structure argument with clear paragraphs
   - End with a specific submission/prayer

6. INDIAN COURT HIERARCHY & PRECEDENT RULES:
   - Supreme Court of India: Highest authority. Its decisions bind ALL lower courts.
   - High Courts: Bind District/Sessions Courts within their territorial jurisdiction.
   - District/Sessions Courts: Trial courts, bound by High Court and Supreme Court.
   - Tribunals/Quasi-judicial bodies: Specialized courts (NCLT, NCLAT, NGT, etc.)

   PRECEDENT BINDING RULES (CRITICAL):
   - Supreme Court decisions are LAW OF THE LAND (Article 141)
   - Cite Supreme Court precedents over High Court where available
   - High Court decisions of one state are PERSUASIVE (not binding) in other states
   - Later Supreme Court decisions override earlier conflicting ones
   - Constitutional Bench decisions (5+ judges) override Regular Bench decisions
   - When citing cases, mention: Court, Year, Case Name (e.g., "Vishakha v. State of Rajasthan, AIR 1997 SC 3011")
   - NEVER cite a lower court decision against a higher court ruling on the same point

${recentDevelopments ? 'FOCUS: Arguments should primarily address the recent developments while maintaining overall case context.' : ''}

Keep argument 100-180 words. Quality over quantity.
`;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      argument: {
        type: Type.STRING,
        description: "The spoken argument or verdict.",
      },
      citations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of specific laws or cases cited (e.g. 'Section 302 IPC').",
      },
    },
    required: ["argument", "citations"],
  };

  const prompt = `
Current Transcript:
${historyText || 'No previous arguments.'}

It is now ${nextSpeaker}'s turn.
Current Turn Number: ${session.currentTurnCount + 1}
Total Allowed Turns: ${session.maxTurns}

Generate the response.
`;

  try {
    const response = await executeWithFallback(async (ai) => {
      return await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });
    });

    const json = safeJsonParse<Record<string, unknown>>(response.text, {}, isObject);
    return {
      text: safeString(json.argument, "I rest my case."),
      references: safeArray<string>(json.citations),
      isUserSideAI: isUserSide
    };

  } catch (error) {
    console.error("Error generating turn:", error);
    let errorMessage = "System Error: Please check your API Key settings.";
    if (error instanceof Error && error.message.includes("temporarily unavailable")) {
      errorMessage = "All API keys are temporarily unavailable. Please wait a moment and try again.";
    }
    return {
      text: errorMessage,
      references: [],
      isUserSideAI: isUserSide
    };
  }
};

/**
 * Extract and validate precedent citations from case documents
 */
export const extractPrecedentCitations = async (
  caseTitle: string,
  description: string,
  documents: CaseFile[],
  perspectiveRole: Role.Petitioner | Role.Respondent,
  onProgress?: (status: string) => void
): Promise<PrecedentCitation[]> => {
  const modelId = "gemini-2.5-flash";

  onProgress?.(`Extracting precedent citations for ${perspectiveRole}...`);

  const documentContent = documents.map(d => d.content).join('\n\n---\n\n').substring(0, 20000);

  const citationSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      citations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            citation: { type: Type.STRING, description: "Full citation string (e.g., 'AIR 2020 SC 1234', '(2019) 5 SCC 480')" },
            caseName: { type: Type.STRING, description: "Case name (e.g., 'Vishakha v. State of Rajasthan')" },
            court: { type: Type.STRING, description: "Court name (e.g., 'Supreme Court', 'Delhi High Court')" },
            year: { type: Type.STRING, description: "Year of judgment" },
            relevantPrinciple: { type: Type.STRING, description: "The legal principle established in this case" },
            howItApplies: { type: Type.STRING, description: "How this precedent applies to the current case for ${perspectiveRole}" },
            isRatioDecidendi: { type: Type.BOOLEAN, description: "True if this is ratio decidendi (binding), false if obiter dicta" },
            bindingOn: { type: Type.STRING, description: "Who is bound: 'all_courts', 'high_courts', 'district_courts', or 'persuasive_only'" }
          },
          required: ["citation", "caseName", "court", "year", "relevantPrinciple", "howItApplies"]
        },
        description: "List of precedent citations found in documents"
      }
    },
    required: ["citations"]
  };

  const prompt = `
You are an expert Indian Legal Researcher. Extract all precedent citations from these case documents that support the ${perspectiveRole}'s case.

Case Title: ${caseTitle}
Case Description: ${description}

DOCUMENTS:
${documentContent}

TASK: Extract all case law citations with detailed analysis.

CITATION FORMAT PATTERNS TO LOOK FOR:
- AIR citations: AIR YYYY Court PageNo (e.g., "AIR 2020 SC 1234")
- SCC citations: (YYYY) Volume SCC PageNo (e.g., "(2019) 5 SCC 480")
- SCR citations: [YYYY] Volume SCR PageNo
- SCALE citations: (YYYY) Volume SCALE PageNo
- SCC Online: YYYY SCC OnLine Court Number
- MANU citations: MANU/Court/YYYY/Number
- Criminal Law Journal: YYYY CriLJ PageNo

FOR EACH CITATION:
1. Provide the exact citation string
2. Full case name (Petitioner v. Respondent)
3. Which court decided it
4. Year of judgment
5. The legal principle (ratio decidendi) established
6. How it specifically helps the ${perspectiveRole}
7. Whether it's ratio decidendi (binding) or obiter dicta (persuasive)
8. Which courts are bound by it:
   - Supreme Court = 'all_courts'
   - High Court = 'high_courts' (within state) or 'persuasive_only' (other states)
   - District/Lower Court = 'persuasive_only'

Be thorough - extract ALL citations that could support the ${perspectiveRole}.
`;

  try {
    const response = await executeWithFallback(async (ai) => {
      return await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: citationSchema,
        }
      });
    });

    const json = safeJsonParse<Record<string, unknown>>(response.text, {}, isObject);
    const rawCitations = safeArray<Record<string, unknown>>(json.citations);

    // Transform and validate citations
    const citations: PrecedentCitation[] = rawCitations.map((c, index) => {
      const citationStr = safeString(c.citation);
      const validation = validateCitation(citationStr);

      return {
        id: `citation_${perspectiveRole}_${Date.now()}_${index}`,
        citation: citationStr,
        caseName: safeString(c.caseName),
        court: safeString(c.court),
        year: safeString(c.year),
        citationFormat: validation.format || 'unknown',
        relevantPrinciple: safeString(c.relevantPrinciple),
        howItApplies: safeString(c.howItApplies),
        isRatioDecidendi: c.isRatioDecidendi === true,
        bindingOn: validateBindingOn(safeString(c.bindingOn)),
        isValidated: validation.valid
      };
    });

    return citations;
  } catch (error) {
    console.error('Error extracting precedent citations:', error);
    return [];
  }
};

// Helper to validate bindingOn field
const validateBindingOn = (value: string): 'all_courts' | 'high_courts' | 'district_courts' | 'persuasive_only' => {
  const validValues = ['all_courts', 'high_courts', 'district_courts', 'persuasive_only'] as const;
  if (validValues.includes(value as typeof validValues[number])) {
    return value as typeof validValues[number];
  }
  return 'persuasive_only';
};

/**
 * Identify disputed facts between Petitioner and Respondent perspectives
 */
export const identifyDisputedFacts = async (
  caseTitle: string,
  description: string,
  petitionerPerspective: CasePerspective,
  respondentPerspective: CasePerspective,
  onProgress?: (status: string) => void
): Promise<DisputedFact[]> => {
  const modelId = "gemini-2.5-flash";

  onProgress?.('Identifying disputed facts between perspectives...');

  const disputedFactsSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      disputedFacts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            fact: { type: Type.STRING, description: "The fact in dispute" },
            petitionerVersion: { type: Type.STRING, description: "How petitioner presents this fact" },
            respondentVersion: { type: Type.STRING, description: "How respondent presents this fact" },
            disputeType: { type: Type.STRING, description: "'contradiction', 'omission', or 'interpretation'" },
            importanceLevel: { type: Type.STRING, description: "'critical', 'significant', or 'minor'" }
          },
          required: ["fact", "petitionerVersion", "respondentVersion", "disputeType", "importanceLevel"]
        },
        description: "List of facts where parties disagree"
      }
    },
    required: ["disputedFacts"]
  };

  const prompt = `
You are an expert Indian Legal Analyst. Compare the two case perspectives and identify ALL DISPUTED FACTS.

Case Title: ${caseTitle}
Case Description: ${description}

PETITIONER'S PERSPECTIVE:
Legal Theory: ${petitionerPerspective.legalTheory}
Key Facts: ${petitionerPerspective.keyFacts.join('\n- ')}
Strengths: ${petitionerPerspective.strengths.join('\n- ')}

RESPONDENT'S PERSPECTIVE:
Legal Theory: ${respondentPerspective.legalTheory}
Key Facts: ${respondentPerspective.keyFacts.join('\n- ')}
Strengths: ${respondentPerspective.strengths.join('\n- ')}

TASK: Identify all facts where the parties DISAGREE or have different versions.

DISPUTE TYPES:
1. CONTRADICTION: Parties state opposite things about the same event/fact
2. OMISSION: One party mentions a fact that the other completely ignores
3. INTERPRETATION: Both acknowledge the fact but interpret its significance differently

IMPORTANCE LEVELS:
1. CRITICAL: This dispute could determine the case outcome
2. SIGNIFICANT: Important but not outcome-determinative alone
3. MINOR: Peripheral dispute with limited impact

For each disputed fact, provide:
- The core fact in dispute
- Petitioner's version/claim
- Respondent's version/claim
- Type of dispute
- How important this is to the case
`;

  try {
    const response = await executeWithFallback(async (ai) => {
      return await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: disputedFactsSchema,
        }
      });
    });

    const json = safeJsonParse<Record<string, unknown>>(response.text, {}, isObject);
    const rawDisputes = safeArray<Record<string, unknown>>(json.disputedFacts);

    const disputes: DisputedFact[] = rawDisputes.map((d, index) => ({
      id: `dispute_${Date.now()}_${index}`,
      fact: safeString(d.fact),
      petitionerVersion: safeString(d.petitionerVersion),
      respondentVersion: safeString(d.respondentVersion),
      disputeType: validateDisputeType(safeString(d.disputeType)),
      importanceLevel: validateImportanceLevel(safeString(d.importanceLevel))
    }));

    return disputes;
  } catch (error) {
    console.error('Error identifying disputed facts:', error);
    return [];
  }
};

// Helper to validate dispute type
const validateDisputeType = (value: string): 'contradiction' | 'omission' | 'interpretation' => {
  const validTypes = ['contradiction', 'omission', 'interpretation'] as const;
  if (validTypes.includes(value.toLowerCase() as typeof validTypes[number])) {
    return value.toLowerCase() as typeof validTypes[number];
  }
  return 'interpretation';
};

// Helper to validate importance level
const validateImportanceLevel = (value: string): 'critical' | 'significant' | 'minor' => {
  const validLevels = ['critical', 'significant', 'minor'] as const;
  if (validLevels.includes(value.toLowerCase() as typeof validLevels[number])) {
    return value.toLowerCase() as typeof validLevels[number];
  }
  return 'significant';
};
