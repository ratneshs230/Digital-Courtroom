import { GoogleGenAI, Schema, Type } from "@google/genai";
import { Project, Session, Role, SimulationMessage } from "../types";

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
  // Check both API_KEY and GEMINI_API_KEY for compatibility
  const envKeys = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (envKeys) {
    const parsed = envKeys.split(",").map(k => k.trim()).filter(k => k.length > 0);
    keys.push(...parsed);
  }

  // Remove duplicates
  return [...new Set(keys)];
};

// Get available keys (excluding recently failed ones)
const getAvailableKeys = (): string[] => {
  const allKeys = getAllApiKeys();
  const now = Date.now();

  return allKeys.filter(key => {
    const failedAt = failedKeys.get(key);
    if (!failedAt) return true;
    // Allow retry if cooldown has passed
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

      // Mark key as failed for rate limits, auth errors, etc.
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

      // Continue to next key
    }
  }

  // All keys failed
  throw lastError || new Error("All API keys failed.");
};

/**
 * Simulates the "Vector Database" ingestion.
 * Analyzes case files to find relevant Indian laws, acts, and rules.
 */
export const analyzeLegalContext = async (
  title: string,
  description: string,
  fileContents: string[]
): Promise<string> => {
  const modelId = "gemini-2.5-flash"; // Efficient for text analysis
  
  const combinedEvidence = fileContents.join("\n\n---\n\n");
  
  const prompt = `
    You are an expert Indian Legal Assistant. Analyze the following case details and evidence documents.
    
    Case Title: ${title}
    Description: ${description}
    
    Evidence/Documents Content:
    ${combinedEvidence.substring(0, 20000)} // Truncate for safety in demo
    
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
    if (error instanceof Error) {
      if (error.message.includes("API Key") || error.message.includes("missing")) {
        return "Error: Missing API Key. Please provide it in the sidebar.";
      }
      if (error.message.includes("temporarily unavailable")) {
        return "Error: All API keys are temporarily unavailable. Please wait a moment and try again.";
      }
    }
    return "Error generating legal context. Please ensure API Key is valid.";
  }
};

/**
 * Generates the next turn in the courtroom simulation.
 */
export const generateTurn = async (
  project: Project,
  session: Session,
  nextSpeaker: Role,
  history: SimulationMessage[]
): Promise<{ text: string; references: string[] }> => {
  // Use a smarter model for argumentation
  const modelId = "gemini-2.5-flash"; 

  const historyText = history.map(h => `${h.role}: ${h.text}`).join("\n");
  
  const systemInstruction = `
    You are simulating a ${nextSpeaker} in an Indian Courtroom.
    
    CASE CONTEXT (Vector DB Retrieval):
    ${project.legalContext}
    
    USER SIDE: ${project.userSide}
    SESSION REASON: ${session.reason}
    
    INSTRUCTIONS:
    - If you are ${Role.Petitioner}: Argue for the motion/complaint. Cite relevant Indian laws. Be aggressive but respectful.
    - If you are ${Role.Respondent}: Defend against the allegations. Point out lack of evidence or legal standing.
    - If you are ${Role.Judge}: If this is the final turn (Turn ${session.currentTurnCount} of ${session.maxTurns}), summarize arguments and pronounce a Verdict. If not final, ask a clarifying question or maintain order.
    
    Keep the argument concise (under 150 words) but legally sound. 
    Maintain the decorum of an Indian Court (High Court/Supreme Court level).
    Refer to "My Lord" or "Your Honor" when addressing the Judge.
  `;

  // Schema for structured output to separate text from legal citations
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
    ${historyText}
    
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

    const json = JSON.parse(response.text || "{}");
    return {
      text: json.argument || "I rest my case.",
      references: json.citations || []
    };

  } catch (error) {
    console.error("Error generating turn:", error);
    let errorMessage = "System Error: Please check your API Key settings in the dashboard sidebar.";
    if (error instanceof Error && error.message.includes("temporarily unavailable")) {
      errorMessage = "All API keys are temporarily unavailable. Please wait a moment and try again.";
    }
    return {
      text: errorMessage,
      references: []
    };
  }
};