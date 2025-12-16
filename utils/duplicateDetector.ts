/**
 * Duplicate Document Detection Utility for NyayaSutra
 * Provides hash-based and similarity-based duplicate detection
 */

import { CaseFile } from '../types';
import { generateContentHash } from '../services/cacheService';

// Similarity threshold for considering documents as duplicates
const SIMILARITY_THRESHOLD = 0.9; // 90% similar = likely duplicate
const HIGH_SIMILARITY_THRESHOLD = 0.7; // 70% similar = possibly related

export type DuplicateMatchType = 'exact' | 'near_duplicate' | 'similar';

export interface DuplicateMatch {
  documentId: string;
  documentName: string;
  similarityScore: number;
  matchType: DuplicateMatchType;
  matchDetails?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  isHighSimilarity: boolean;
  exactMatch?: DuplicateMatch;
  similarDocuments: DuplicateMatch[];
}

// Cache of document hashes for quick exact-match detection
const documentHashCache = new Map<string, string>();

/**
 * Generate n-grams from text for similarity comparison
 */
const generateNgrams = (text: string, n: number = 3): Set<string> => {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const ngrams = new Set<string>();

  if (normalized.length < n) {
    ngrams.add(normalized);
    return ngrams;
  }

  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.add(normalized.substring(i, i + n));
  }

  return ngrams;
};

/**
 * Calculate Jaccard similarity between two sets of n-grams
 */
const calculateJaccardSimilarity = (set1: Set<string>, set2: Set<string>): number => {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) {
      intersection++;
    }
  }

  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
};

/**
 * Calculate text similarity using n-gram Jaccard similarity
 */
export const calculateTextSimilarity = (text1: string, text2: string): number => {
  // Quick length-based pre-filter
  const lengthRatio = Math.min(text1.length, text2.length) / Math.max(text1.length, text2.length);
  if (lengthRatio < 0.3) {
    // If lengths are very different, similarity is likely low
    return lengthRatio * 0.5;
  }

  // Generate n-grams for both texts
  const ngrams1 = generateNgrams(text1, 5); // Use 5-grams for better accuracy
  const ngrams2 = generateNgrams(text2, 5);

  return calculateJaccardSimilarity(ngrams1, ngrams2);
};

/**
 * Get or compute content hash for a document
 */
export const getDocumentHash = async (content: string): Promise<string> => {
  // Check cache first
  const cacheKey = content.substring(0, 100); // Use first 100 chars as cache key
  const cached = documentHashCache.get(cacheKey);
  if (cached) return cached;

  // Compute hash
  const hash = await generateContentHash(content);

  // Cache for future use (limit cache size)
  if (documentHashCache.size > 1000) {
    // Clear oldest entries
    const keysToDelete = Array.from(documentHashCache.keys()).slice(0, 500);
    keysToDelete.forEach(k => documentHashCache.delete(k));
  }
  documentHashCache.set(cacheKey, hash);

  return hash;
};

/**
 * Check if a new document is a duplicate of any existing documents
 */
export const checkForDuplicates = async (
  newContent: string,
  newFileName: string,
  existingDocuments: CaseFile[]
): Promise<DuplicateCheckResult> => {
  const result: DuplicateCheckResult = {
    isDuplicate: false,
    isHighSimilarity: false,
    similarDocuments: []
  };

  if (existingDocuments.length === 0) {
    return result;
  }

  // Compute hash for new document
  const newHash = await getDocumentHash(newContent);

  // Check each existing document
  for (const doc of existingDocuments) {
    // Skip if no content
    if (!doc.content) continue;

    // Check for exact match via hash
    const existingHash = await getDocumentHash(doc.content);
    if (newHash === existingHash) {
      result.isDuplicate = true;
      result.exactMatch = {
        documentId: doc.id,
        documentName: doc.name,
        similarityScore: 1.0,
        matchType: 'exact',
        matchDetails: 'Exact content match (identical hash)'
      };
      // Still continue to find other similar documents
    }

    // Calculate text similarity
    const similarity = calculateTextSimilarity(newContent, doc.content);

    if (similarity >= SIMILARITY_THRESHOLD && !result.exactMatch) {
      // Near-duplicate (very high similarity but not exact)
      result.isDuplicate = true;
      result.similarDocuments.push({
        documentId: doc.id,
        documentName: doc.name,
        similarityScore: similarity,
        matchType: 'near_duplicate',
        matchDetails: `${Math.round(similarity * 100)}% text similarity`
      });
    } else if (similarity >= HIGH_SIMILARITY_THRESHOLD) {
      // Similar document (might be related)
      result.isHighSimilarity = true;
      result.similarDocuments.push({
        documentId: doc.id,
        documentName: doc.name,
        similarityScore: similarity,
        matchType: 'similar',
        matchDetails: `${Math.round(similarity * 100)}% text similarity`
      });
    }
  }

  // Sort by similarity score (highest first)
  result.similarDocuments.sort((a, b) => b.similarityScore - a.similarityScore);

  return result;
};

/**
 * Check multiple new documents for duplicates (batch operation)
 */
export const checkBatchForDuplicates = async (
  newDocuments: Array<{ content: string; fileName: string }>,
  existingDocuments: CaseFile[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<Map<string, DuplicateCheckResult>> => {
  const results = new Map<string, DuplicateCheckResult>();

  // Also check for duplicates among new documents themselves
  const processedNewDocs: CaseFile[] = [];

  for (let i = 0; i < newDocuments.length; i++) {
    const { content, fileName } = newDocuments[i];
    onProgress?.(i + 1, newDocuments.length, fileName);

    // Check against existing docs and already processed new docs
    const allExisting = [...existingDocuments, ...processedNewDocs];
    const result = await checkForDuplicates(content, fileName, allExisting);

    results.set(fileName, result);

    // Add to processed list for checking subsequent documents
    processedNewDocs.push({
      id: `temp_${i}`,
      name: fileName,
      type: 'text/plain',
      content
    });
  }

  return results;
};

/**
 * Get a human-readable summary of duplicate check results
 */
export const getDuplicateSummary = (result: DuplicateCheckResult): string => {
  if (result.exactMatch) {
    return `Exact duplicate of "${result.exactMatch.documentName}"`;
  }

  if (result.isDuplicate && result.similarDocuments.length > 0) {
    const topMatch = result.similarDocuments[0];
    return `Near duplicate of "${topMatch.documentName}" (${topMatch.matchDetails})`;
  }

  if (result.isHighSimilarity && result.similarDocuments.length > 0) {
    const topMatch = result.similarDocuments[0];
    return `Similar to "${topMatch.documentName}" (${topMatch.matchDetails})`;
  }

  return 'No duplicates found';
};

/**
 * Suggest action based on duplicate check results
 */
export type DuplicateAction = 'skip' | 'rename' | 'add_anyway' | 'review';

export const suggestAction = (result: DuplicateCheckResult): DuplicateAction => {
  if (result.exactMatch) {
    return 'skip'; // Definitely skip exact duplicates
  }

  if (result.isDuplicate) {
    return 'review'; // User should review near-duplicates
  }

  if (result.isHighSimilarity) {
    return 'add_anyway'; // Similar but not duplicate, add with notice
  }

  return 'add_anyway'; // No issues, add normally
};

/**
 * Clear the document hash cache (useful after project deletion)
 */
export const clearHashCache = (): void => {
  documentHashCache.clear();
};
