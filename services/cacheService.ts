/**
 * API Response Caching Service for NyayaSutra
 * Provides content-hash based caching for Gemini API responses
 */

import { STORES, getCacheEntry, setCacheEntry, getCacheByHash, clearExpiredCache } from './storageService';
import { DocumentMetadata, CasePerspective } from '../types';

// Cache TTL defaults (in milliseconds)
export const CACHE_TTL = {
  DOCUMENT_METADATA: 7 * 24 * 60 * 60 * 1000, // 7 days - document metadata rarely changes
  PERSPECTIVE: 24 * 60 * 60 * 1000, // 24 hours - perspectives may need refresh
  DOCUMENT_ANALYSIS: 7 * 24 * 60 * 60 * 1000, // 7 days - analysis is stable
  DEFAULT: 24 * 60 * 60 * 1000 // 24 hours
};

// Cache key prefixes
const CACHE_KEYS = {
  DOCUMENT_METADATA: 'doc_meta_',
  DOCUMENT_ANALYSIS: 'doc_analysis_',
  PERSPECTIVE: 'perspective_',
  TURN: 'turn_'
};

/**
 * Generate SHA-256 hash of content for cache key
 */
export const generateContentHash = async (content: string): Promise<string> => {
  // Use Web Crypto API for SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    // Fallback for older browsers: simple hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
};

/**
 * Generate a cache key from multiple inputs
 */
export const generateCacheKey = async (
  prefix: string,
  ...parts: string[]
): Promise<string> => {
  const combined = parts.join('|');
  const hash = await generateContentHash(combined);
  return `${prefix}${hash.substring(0, 16)}`; // Use first 16 chars of hash
};

// ============================================
// DOCUMENT METADATA CACHING
// ============================================

export interface CachedDocumentMetadata {
  metadata: DocumentMetadata;
  fileName: string;
  contentHash: string;
  cachedAt: number;
}

/**
 * Get cached document metadata by content hash
 */
export const getCachedDocumentMetadata = async (
  contentHash: string
): Promise<CachedDocumentMetadata | undefined> => {
  try {
    // First try to find by content hash (most reliable)
    const cached = await getCacheByHash<CachedDocumentMetadata>(
      STORES.DOCUMENT_CACHE,
      contentHash
    );

    if (cached) {
      console.log(`Cache hit for document metadata (hash: ${contentHash.substring(0, 8)}...)`);
      return cached;
    }

    return undefined;
  } catch (error) {
    console.warn('Failed to get cached document metadata:', error);
    return undefined;
  }
};

/**
 * Cache document metadata
 */
export const cacheDocumentMetadata = async (
  fileName: string,
  content: string,
  metadata: DocumentMetadata
): Promise<void> => {
  try {
    const contentHash = await generateContentHash(content);
    const cacheKey = await generateCacheKey(CACHE_KEYS.DOCUMENT_METADATA, contentHash);

    const cachedData: CachedDocumentMetadata = {
      metadata,
      fileName,
      contentHash,
      cachedAt: Date.now()
    };

    await setCacheEntry(
      STORES.DOCUMENT_CACHE,
      cacheKey,
      cachedData,
      CACHE_TTL.DOCUMENT_METADATA,
      contentHash
    );

    console.log(`Cached document metadata for: ${fileName} (hash: ${contentHash.substring(0, 8)}...)`);
  } catch (error) {
    console.warn('Failed to cache document metadata:', error);
  }
};

/**
 * Check if document content has cached metadata
 */
export const hasDocumentMetadataCache = async (content: string): Promise<boolean> => {
  try {
    const contentHash = await generateContentHash(content);
    const cached = await getCachedDocumentMetadata(contentHash);
    return cached !== undefined;
  } catch (error) {
    return false;
  }
};

/**
 * Get document metadata from cache or return undefined if not cached
 */
export const getDocumentMetadataFromCache = async (
  content: string
): Promise<DocumentMetadata | undefined> => {
  try {
    const contentHash = await generateContentHash(content);
    const cached = await getCachedDocumentMetadata(contentHash);
    return cached?.metadata;
  } catch (error) {
    return undefined;
  }
};

// ============================================
// DOCUMENT ANALYSIS CACHING
// ============================================

export interface CachedDocumentAnalysis {
  analysis: {
    summary: string;
    extractedFacts: string[];
    legalImplications: string[];
  };
  documentId: string;
  role: string;
  contentHash: string;
  cachedAt: number;
}

/**
 * Get cached document analysis
 */
export const getCachedDocumentAnalysis = async (
  documentId: string,
  role: string,
  contentHash: string
): Promise<CachedDocumentAnalysis | undefined> => {
  try {
    const cacheKey = await generateCacheKey(
      CACHE_KEYS.DOCUMENT_ANALYSIS,
      documentId,
      role,
      contentHash
    );

    const cached = await getCacheEntry<CachedDocumentAnalysis>(
      STORES.API_RESPONSE_CACHE,
      cacheKey
    );

    if (cached) {
      console.log(`Cache hit for document analysis: ${documentId} (${role})`);
      return cached;
    }

    return undefined;
  } catch (error) {
    console.warn('Failed to get cached document analysis:', error);
    return undefined;
  }
};

/**
 * Cache document analysis
 */
export const cacheDocumentAnalysis = async (
  documentId: string,
  role: string,
  content: string,
  analysis: {
    summary: string;
    extractedFacts: string[];
    legalImplications: string[];
  }
): Promise<void> => {
  try {
    const contentHash = await generateContentHash(content);
    const cacheKey = await generateCacheKey(
      CACHE_KEYS.DOCUMENT_ANALYSIS,
      documentId,
      role,
      contentHash
    );

    const cachedData: CachedDocumentAnalysis = {
      analysis,
      documentId,
      role,
      contentHash,
      cachedAt: Date.now()
    };

    await setCacheEntry(
      STORES.API_RESPONSE_CACHE,
      cacheKey,
      cachedData,
      CACHE_TTL.DOCUMENT_ANALYSIS,
      contentHash
    );

    console.log(`Cached document analysis for: ${documentId} (${role})`);
  } catch (error) {
    console.warn('Failed to cache document analysis:', error);
  }
};

// ============================================
// PERSPECTIVE CACHING
// ============================================

export interface CachedPerspective {
  perspective: CasePerspective;
  caseTitle: string;
  role: string;
  filesHash: string;
  cachedAt: number;
}

/**
 * Generate a hash for a set of file contents
 */
export const generateFilesHash = async (fileContents: string[]): Promise<string> => {
  // Sort and combine to ensure consistent hash regardless of order
  const combined = fileContents.sort().join('\n---FILE_SEPARATOR---\n');
  return await generateContentHash(combined);
};

/**
 * Get cached perspective
 */
export const getCachedPerspective = async (
  caseTitle: string,
  role: string,
  fileContents: string[]
): Promise<CasePerspective | undefined> => {
  try {
    const filesHash = await generateFilesHash(fileContents);
    const cacheKey = await generateCacheKey(
      CACHE_KEYS.PERSPECTIVE,
      caseTitle,
      role,
      filesHash
    );

    const cached = await getCacheEntry<CachedPerspective>(
      STORES.API_RESPONSE_CACHE,
      cacheKey
    );

    if (cached) {
      console.log(`Cache hit for perspective: ${role} (case: ${caseTitle.substring(0, 20)}...)`);
      return cached.perspective;
    }

    return undefined;
  } catch (error) {
    console.warn('Failed to get cached perspective:', error);
    return undefined;
  }
};

/**
 * Cache perspective
 */
export const cachePerspective = async (
  caseTitle: string,
  role: string,
  fileContents: string[],
  perspective: CasePerspective
): Promise<void> => {
  try {
    const filesHash = await generateFilesHash(fileContents);
    const cacheKey = await generateCacheKey(
      CACHE_KEYS.PERSPECTIVE,
      caseTitle,
      role,
      filesHash
    );

    const cachedData: CachedPerspective = {
      perspective,
      caseTitle,
      role,
      filesHash,
      cachedAt: Date.now()
    };

    await setCacheEntry(
      STORES.API_RESPONSE_CACHE,
      cacheKey,
      cachedData,
      CACHE_TTL.PERSPECTIVE,
      filesHash
    );

    console.log(`Cached perspective: ${role} (case: ${caseTitle.substring(0, 20)}...)`);
  } catch (error) {
    console.warn('Failed to cache perspective:', error);
  }
};

// ============================================
// CACHE UTILITIES
// ============================================

/**
 * Clear all caches (useful for debugging or reset)
 */
export const clearAllCaches = async (): Promise<void> => {
  try {
    // Use a very old expiration time to clear everything
    const clearedCount = await clearExpiredCache();
    console.log(`Cleared ${clearedCount} expired cache entries`);

    // For a full clear, we'd need to iterate all entries
    // This is handled by the storage service
  } catch (error) {
    console.error('Failed to clear caches:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<{
  documentMetadataCount: number;
  documentAnalysisCount: number;
  perspectiveCount: number;
  totalEntries: number;
}> => {
  // This would require iterating through cache entries
  // For now, return basic stats
  return {
    documentMetadataCount: 0,
    documentAnalysisCount: 0,
    perspectiveCount: 0,
    totalEntries: 0
  };
};

/**
 * Invalidate cache for a specific document (when content changes)
 */
export const invalidateDocumentCache = async (content: string): Promise<void> => {
  try {
    const contentHash = await generateContentHash(content);
    // The cache entries will be overwritten when new content is analyzed
    console.log(`Invalidated cache for content hash: ${contentHash.substring(0, 8)}...`);
  } catch (error) {
    console.warn('Failed to invalidate document cache:', error);
  }
};

/**
 * Warm up cache by pre-computing hashes for existing documents
 */
export const warmUpCache = async (
  documents: Array<{ content: string; name: string }>
): Promise<Map<string, string>> => {
  const hashMap = new Map<string, string>();

  for (const doc of documents) {
    try {
      const hash = await generateContentHash(doc.content);
      hashMap.set(doc.name, hash);
    } catch (error) {
      console.warn(`Failed to compute hash for ${doc.name}:`, error);
    }
  }

  return hashMap;
};

/**
 * Check if a cache entry is stale (exists but old)
 */
export const isCacheStale = async (
  content: string,
  maxAgeMs: number = CACHE_TTL.DEFAULT
): Promise<boolean> => {
  try {
    const contentHash = await generateContentHash(content);
    const cached = await getCachedDocumentMetadata(contentHash);

    if (!cached) return true; // No cache = stale

    const age = Date.now() - cached.cachedAt;
    return age > maxAgeMs;
  } catch (error) {
    return true; // On error, assume stale
  }
};
