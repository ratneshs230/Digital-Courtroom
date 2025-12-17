/**
 * IndexedDB Storage Service for NyayaSutra
 * Provides async storage operations with localStorage fallback
 */

import { Project, Session, Archive, ArchiveDocument } from '../types';

// Database configuration
const DB_NAME = 'nyayasutra_db';
const DB_VERSION = 1;

// Store names
export const STORES = {
  PROJECTS: 'projects',
  SESSIONS: 'sessions',
  DOCUMENT_CACHE: 'documentCache',
  API_RESPONSE_CACHE: 'apiResponseCache',
  METADATA: 'metadata'
} as const;

// Legacy localStorage keys for migration
const LEGACY_KEYS = {
  PROJECTS: 'nyayasutra_data',
  API_KEY: 'gemini_api_key'
};

// Cache entry interface
export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  contentHash?: string;
}

// Storage metadata
interface StorageMetadata {
  id: string;
  migratedFromLocalStorage: boolean;
  migrationDate?: number;
  lastCleanup?: number;
  dbVersion: number;
}

// Database instance
let db: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;
let useLocalStorageFallback = false;

/**
 * Initialize the IndexedDB database
 */
export const initDatabase = async (): Promise<IDBDatabase> => {
  // Return existing promise if already initializing
  if (dbInitPromise) {
    return dbInitPromise;
  }

  // Return existing db if already initialized
  if (db) {
    return db;
  }

  dbInitPromise = new Promise((resolve, reject) => {
    // Check if IndexedDB is available
    if (!window.indexedDB) {
      console.warn('IndexedDB not available, falling back to localStorage');
      useLocalStorageFallback = true;
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      useLocalStorageFallback = true;
      reject((event.target as IDBOpenDBRequest).error);
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;

      // Handle connection errors
      db.onerror = (event) => {
        console.error('Database error:', (event.target as IDBDatabase).name);
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create projects store
      if (!database.objectStoreNames.contains(STORES.PROJECTS)) {
        const projectStore = database.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
        projectStore.createIndex('createdAt', 'createdAt', { unique: false });
        projectStore.createIndex('name', 'name', { unique: false });
      }

      // Create sessions store
      if (!database.objectStoreNames.contains(STORES.SESSIONS)) {
        const sessionStore = database.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
        sessionStore.createIndex('projectId', 'projectId', { unique: false });
        sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
        sessionStore.createIndex('status', 'status', { unique: false });
      }

      // Create document cache store (for extracted metadata)
      if (!database.objectStoreNames.contains(STORES.DOCUMENT_CACHE)) {
        const docCacheStore = database.createObjectStore(STORES.DOCUMENT_CACHE, { keyPath: 'key' });
        docCacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        docCacheStore.createIndex('contentHash', 'contentHash', { unique: false });
      }

      // Create API response cache store
      if (!database.objectStoreNames.contains(STORES.API_RESPONSE_CACHE)) {
        const apiCacheStore = database.createObjectStore(STORES.API_RESPONSE_CACHE, { keyPath: 'key' });
        apiCacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        apiCacheStore.createIndex('contentHash', 'contentHash', { unique: false });
      }

      // Create metadata store
      if (!database.objectStoreNames.contains(STORES.METADATA)) {
        database.createObjectStore(STORES.METADATA, { keyPath: 'id' });
      }
    };
  });

  try {
    return await dbInitPromise;
  } catch (error) {
    dbInitPromise = null;
    throw error;
  }
};

/**
 * Get the database instance, initializing if needed
 */
const getDB = async (): Promise<IDBDatabase> => {
  if (useLocalStorageFallback) {
    throw new Error('Using localStorage fallback');
  }
  if (!db) {
    return await initDatabase();
  }
  return db;
};

/**
 * Generic function to perform a transaction
 */
const performTransaction = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// ============================================
// PROJECT OPERATIONS
// ============================================

/**
 * Get all projects
 */
export const getAllProjects = async (): Promise<Project[]> => {
  if (useLocalStorageFallback) {
    const data = localStorage.getItem(LEGACY_KEYS.PROJECTS);
    return data ? JSON.parse(data) : [];
  }

  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.PROJECTS, 'readonly');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by createdAt descending
        const projects = request.result.sort((a, b) => b.createdAt - a.createdAt);
        resolve(projects);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    // Fallback to localStorage
    const data = localStorage.getItem(LEGACY_KEYS.PROJECTS);
    return data ? JSON.parse(data) : [];
  }
};

/**
 * Get a single project by ID
 */
export const getProject = async (id: string): Promise<Project | undefined> => {
  if (useLocalStorageFallback) {
    const projects = await getAllProjects();
    return projects.find(p => p.id === id);
  }

  try {
    return await performTransaction<Project | undefined>(
      STORES.PROJECTS,
      'readonly',
      (store) => store.get(id)
    );
  } catch (error) {
    const projects = await getAllProjects();
    return projects.find(p => p.id === id);
  }
};

/**
 * Save a project (create or update)
 */
export const saveProject = async (project: Project): Promise<void> => {
  if (useLocalStorageFallback) {
    const projects = await getAllProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.unshift(project);
    }
    localStorage.setItem(LEGACY_KEYS.PROJECTS, JSON.stringify(projects));
    return;
  }

  try {
    await performTransaction(
      STORES.PROJECTS,
      'readwrite',
      (store) => store.put(project)
    );
  } catch (error) {
    // Fallback to localStorage
    const projects = await getAllProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.unshift(project);
    }
    localStorage.setItem(LEGACY_KEYS.PROJECTS, JSON.stringify(projects));
  }
};

/**
 * Delete a project
 */
export const deleteProject = async (id: string): Promise<void> => {
  if (useLocalStorageFallback) {
    const projects = await getAllProjects();
    const filtered = projects.filter(p => p.id !== id);
    localStorage.setItem(LEGACY_KEYS.PROJECTS, JSON.stringify(filtered));
    // Also delete associated sessions
    localStorage.removeItem(`sessions_${id}`);
    return;
  }

  try {
    // Delete project
    await performTransaction(
      STORES.PROJECTS,
      'readwrite',
      (store) => store.delete(id)
    );

    // Delete associated sessions
    const sessions = await getSessionsByProject(id);
    for (const session of sessions) {
      await deleteSession(session.id);
    }
  } catch (error) {
    // Fallback
    const projects = await getAllProjects();
    const filtered = projects.filter(p => p.id !== id);
    localStorage.setItem(LEGACY_KEYS.PROJECTS, JSON.stringify(filtered));
    localStorage.removeItem(`sessions_${id}`);
  }
};

/**
 * Save multiple projects at once
 */
export const saveAllProjects = async (projects: Project[]): Promise<void> => {
  if (useLocalStorageFallback) {
    localStorage.setItem(LEGACY_KEYS.PROJECTS, JSON.stringify(projects));
    return;
  }

  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.PROJECTS, 'readwrite');
      const store = transaction.objectStore(STORES.PROJECTS);

      // Clear existing and add new
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        projects.forEach(project => store.put(project));
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    localStorage.setItem(LEGACY_KEYS.PROJECTS, JSON.stringify(projects));
  }
};

// ============================================
// SESSION OPERATIONS
// ============================================

/**
 * Get all sessions for a project
 */
export const getSessionsByProject = async (projectId: string): Promise<Session[]> => {
  if (useLocalStorageFallback) {
    const data = localStorage.getItem(`sessions_${projectId}`);
    return data ? JSON.parse(data) : [];
  }

  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.SESSIONS, 'readonly');
      const store = transaction.objectStore(STORES.SESSIONS);
      const index = store.index('projectId');
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        // Sort by createdAt descending
        const sessions = request.result.sort((a, b) => b.createdAt - a.createdAt);
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    const data = localStorage.getItem(`sessions_${projectId}`);
    return data ? JSON.parse(data) : [];
  }
};

/**
 * Get a single session by ID
 */
export const getSession = async (id: string): Promise<Session | undefined> => {
  if (useLocalStorageFallback) {
    // For fallback, we need to search through all project sessions
    const projectsData = localStorage.getItem(LEGACY_KEYS.PROJECTS);
    if (!projectsData) return undefined;

    const projects: Project[] = JSON.parse(projectsData);
    for (const project of projects) {
      const sessionsData = localStorage.getItem(`sessions_${project.id}`);
      if (sessionsData) {
        const sessions: Session[] = JSON.parse(sessionsData);
        const found = sessions.find(s => s.id === id);
        if (found) return found;
      }
    }
    return undefined;
  }

  try {
    return await performTransaction<Session | undefined>(
      STORES.SESSIONS,
      'readonly',
      (store) => store.get(id)
    );
  } catch (error) {
    return undefined;
  }
};

/**
 * Save a session (create or update)
 */
export const saveSession = async (session: Session): Promise<void> => {
  if (useLocalStorageFallback) {
    const sessions = await getSessionsByProject(session.projectId);
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(`sessions_${session.projectId}`, JSON.stringify(sessions));
    return;
  }

  try {
    await performTransaction(
      STORES.SESSIONS,
      'readwrite',
      (store) => store.put(session)
    );
  } catch (error) {
    // Fallback
    const sessions = await getSessionsByProject(session.projectId);
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(`sessions_${session.projectId}`, JSON.stringify(sessions));
  }
};

/**
 * Delete a session
 */
export const deleteSession = async (id: string): Promise<void> => {
  if (useLocalStorageFallback) {
    // Need to find which project this belongs to
    const session = await getSession(id);
    if (session) {
      const sessions = await getSessionsByProject(session.projectId);
      const filtered = sessions.filter(s => s.id !== id);
      localStorage.setItem(`sessions_${session.projectId}`, JSON.stringify(filtered));
    }
    return;
  }

  try {
    await performTransaction(
      STORES.SESSIONS,
      'readwrite',
      (store) => store.delete(id)
    );
  } catch (error) {
    // Fallback handled above
  }
};

/**
 * Save all sessions for a project
 */
export const saveProjectSessions = async (projectId: string, sessions: Session[]): Promise<void> => {
  if (useLocalStorageFallback) {
    localStorage.setItem(`sessions_${projectId}`, JSON.stringify(sessions));
    return;
  }

  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.SESSIONS, 'readwrite');
      const store = transaction.objectStore(STORES.SESSIONS);

      // Delete existing sessions for this project
      const index = store.index('projectId');
      const deleteRequest = index.openCursor(projectId);

      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Add new sessions
          sessions.forEach(session => store.put(session));
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    localStorage.setItem(`sessions_${projectId}`, JSON.stringify(sessions));
  }
};

// ============================================
// CACHE OPERATIONS
// ============================================

/**
 * Get a cached value
 */
export const getCacheEntry = async <T>(
  storeName: typeof STORES.DOCUMENT_CACHE | typeof STORES.API_RESPONSE_CACHE,
  key: string
): Promise<T | undefined> => {
  if (useLocalStorageFallback) {
    const data = localStorage.getItem(`cache_${storeName}_${key}`);
    if (!data) return undefined;

    const entry: CacheEntry<T> = JSON.parse(data);
    if (entry.expiresAt < Date.now()) {
      localStorage.removeItem(`cache_${storeName}_${key}`);
      return undefined;
    }
    return entry.value;
  }

  try {
    const entry = await performTransaction<CacheEntry<T> | undefined>(
      storeName,
      'readonly',
      (store) => store.get(key)
    );

    if (!entry) return undefined;

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      await deleteCacheEntry(storeName, key);
      return undefined;
    }

    return entry.value;
  } catch (error) {
    return undefined;
  }
};

/**
 * Set a cached value
 */
export const setCacheEntry = async <T>(
  storeName: typeof STORES.DOCUMENT_CACHE | typeof STORES.API_RESPONSE_CACHE,
  key: string,
  value: T,
  ttlMs: number = 24 * 60 * 60 * 1000, // 24 hours default
  contentHash?: string
): Promise<void> => {
  const entry: CacheEntry<T> = {
    key,
    value,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    contentHash
  };

  if (useLocalStorageFallback) {
    try {
      localStorage.setItem(`cache_${storeName}_${key}`, JSON.stringify(entry));
    } catch (error) {
      // localStorage might be full, clear old cache entries
      console.warn('localStorage full, clearing cache entries');
      clearExpiredCache();
    }
    return;
  }

  try {
    await performTransaction(
      storeName,
      'readwrite',
      (store) => store.put(entry)
    );
  } catch (error) {
    // Try localStorage fallback
    try {
      localStorage.setItem(`cache_${storeName}_${key}`, JSON.stringify(entry));
    } catch {
      console.warn('Failed to cache entry');
    }
  }
};

/**
 * Delete a cached value
 */
export const deleteCacheEntry = async (
  storeName: typeof STORES.DOCUMENT_CACHE | typeof STORES.API_RESPONSE_CACHE,
  key: string
): Promise<void> => {
  if (useLocalStorageFallback) {
    localStorage.removeItem(`cache_${storeName}_${key}`);
    return;
  }

  try {
    await performTransaction(
      storeName,
      'readwrite',
      (store) => store.delete(key)
    );
  } catch (error) {
    localStorage.removeItem(`cache_${storeName}_${key}`);
  }
};

/**
 * Clear all expired cache entries
 */
export const clearExpiredCache = async (): Promise<number> => {
  let clearedCount = 0;
  const now = Date.now();

  if (useLocalStorageFallback) {
    // Clear expired localStorage cache entries
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cache_')) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const entry: CacheEntry<unknown> = JSON.parse(data);
            if (entry.expiresAt < now) {
              keysToRemove.push(key);
            }
          }
        } catch {
          keysToRemove.push(key!);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return keysToRemove.length;
  }

  try {
    const database = await getDB();

    // Clear from both cache stores
    for (const storeName of [STORES.DOCUMENT_CACHE, STORES.API_RESPONSE_CACHE]) {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const index = store.index('expiresAt');
        const range = IDBKeyRange.upperBound(now);
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            clearedCount++;
            cursor.continue();
          }
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }
  } catch (error) {
    console.error('Failed to clear expired cache:', error);
  }

  return clearedCount;
};

/**
 * Get cache entry by content hash
 */
export const getCacheByHash = async <T>(
  storeName: typeof STORES.DOCUMENT_CACHE | typeof STORES.API_RESPONSE_CACHE,
  contentHash: string
): Promise<T | undefined> => {
  if (useLocalStorageFallback) {
    // Search through all cache entries (less efficient)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`cache_${storeName}_`)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const entry: CacheEntry<T> = JSON.parse(data);
            if (entry.contentHash === contentHash && entry.expiresAt > Date.now()) {
              return entry.value;
            }
          }
        } catch {
          continue;
        }
      }
    }
    return undefined;
  }

  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('contentHash');
      const request = index.get(contentHash);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;
        if (entry && entry.expiresAt > Date.now()) {
          resolve(entry.value);
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return undefined;
  }
};

// ============================================
// MIGRATION & UTILITIES
// ============================================

/**
 * Migrate data from localStorage to IndexedDB
 */
export const migrateFromLocalStorage = async (): Promise<boolean> => {
  if (useLocalStorageFallback) {
    return false;
  }

  try {
    // Check if already migrated
    const metadata = await performTransaction<StorageMetadata | undefined>(
      STORES.METADATA,
      'readonly',
      (store) => store.get('main')
    );

    if (metadata?.migratedFromLocalStorage) {
      console.log('Already migrated from localStorage');
      return true;
    }

    // Migrate projects
    const projectsData = localStorage.getItem(LEGACY_KEYS.PROJECTS);
    if (projectsData) {
      const projects: Project[] = JSON.parse(projectsData);
      console.log(`Migrating ${projects.length} projects from localStorage`);

      for (const project of projects) {
        await saveProject(project);

        // Migrate sessions for this project
        const sessionsData = localStorage.getItem(`sessions_${project.id}`);
        if (sessionsData) {
          const sessions: Session[] = JSON.parse(sessionsData);
          console.log(`Migrating ${sessions.length} sessions for project ${project.id}`);

          for (const session of sessions) {
            await saveSession(session);
          }
        }
      }
    }

    // Mark as migrated
    const newMetadata: StorageMetadata = {
      id: 'main',
      migratedFromLocalStorage: true,
      migrationDate: Date.now(),
      dbVersion: DB_VERSION
    };

    await performTransaction(
      STORES.METADATA,
      'readwrite',
      (store) => store.put(newMetadata)
    );

    console.log('Migration from localStorage completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
};

/**
 * Clear localStorage after successful migration (call manually if needed)
 */
export const clearLocalStorageAfterMigration = (): void => {
  localStorage.removeItem(LEGACY_KEYS.PROJECTS);

  // Clear session data
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('sessions_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  console.log('localStorage data cleared after migration');
};

/**
 * Get storage statistics
 */
export const getStorageStats = async (): Promise<{
  projectCount: number;
  sessionCount: number;
  cacheEntryCount: number;
  estimatedSize: string;
  usingFallback: boolean;
}> => {
  let projectCount = 0;
  let sessionCount = 0;
  let cacheEntryCount = 0;

  if (useLocalStorageFallback) {
    const projects = await getAllProjects();
    projectCount = projects.length;

    for (const project of projects) {
      const sessions = await getSessionsByProject(project.id);
      sessionCount += sessions.length;
    }

    // Estimate size from localStorage
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        totalSize += (key.length + (value?.length || 0)) * 2; // UTF-16
        if (key.startsWith('cache_')) cacheEntryCount++;
      }
    }

    return {
      projectCount,
      sessionCount,
      cacheEntryCount,
      estimatedSize: formatBytes(totalSize),
      usingFallback: true
    };
  }

  try {
    const database = await getDB();

    // Count projects
    const projectCountResult = await new Promise<number>((resolve, reject) => {
      const tx = database.transaction(STORES.PROJECTS, 'readonly');
      const request = tx.objectStore(STORES.PROJECTS).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    projectCount = projectCountResult;

    // Count sessions
    const sessionCountResult = await new Promise<number>((resolve, reject) => {
      const tx = database.transaction(STORES.SESSIONS, 'readonly');
      const request = tx.objectStore(STORES.SESSIONS).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    sessionCount = sessionCountResult;

    // Count cache entries
    for (const storeName of [STORES.DOCUMENT_CACHE, STORES.API_RESPONSE_CACHE]) {
      const count = await new Promise<number>((resolve, reject) => {
        const tx = database.transaction(storeName, 'readonly');
        const request = tx.objectStore(storeName).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      cacheEntryCount += count;
    }

    // Estimate storage size using Storage API if available
    let estimatedSize = 'Unknown';
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) {
        estimatedSize = formatBytes(estimate.usage);
      }
    }

    return {
      projectCount,
      sessionCount,
      cacheEntryCount,
      estimatedSize,
      usingFallback: false
    };
  } catch (error) {
    return {
      projectCount: 0,
      sessionCount: 0,
      cacheEntryCount: 0,
      estimatedSize: 'Unknown',
      usingFallback: useLocalStorageFallback
    };
  }
};

/**
 * Format bytes to human readable string
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Check if storage is available and healthy
 */
export const isStorageHealthy = async (): Promise<boolean> => {
  try {
    if (useLocalStorageFallback) {
      // Test localStorage
      const testKey = '_storage_test_';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    }

    // Test IndexedDB
    await getDB();
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Initialize storage and run migration if needed
 */
export const initStorage = async (): Promise<void> => {
  try {
    await initDatabase();
    await migrateFromLocalStorage();
    await clearExpiredCache();
    console.log('Storage initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize IndexedDB, using localStorage fallback:', error);
    useLocalStorageFallback = true;
  }
};

// Export for checking fallback status
export const isUsingFallback = (): boolean => useLocalStorageFallback;

// ============================================
// ARCHIVE OPERATIONS (localStorage-based for simplicity)
// ============================================

const ARCHIVES_KEY = 'nyayasutra_archives';

/**
 * Get all archives
 */
export const getAllArchives = async (): Promise<Archive[]> => {
  const data = localStorage.getItem(ARCHIVES_KEY);
  if (!data) return [];
  try {
    const archives: Archive[] = JSON.parse(data);
    return archives.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
};

/**
 * Get a single archive by ID
 */
export const getArchive = async (id: string): Promise<Archive | undefined> => {
  const archives = await getAllArchives();
  return archives.find(a => a.id === id);
};

/**
 * Get multiple archives by IDs
 */
export const getArchivesByIds = async (ids: string[]): Promise<Archive[]> => {
  const archives = await getAllArchives();
  return archives.filter(a => ids.includes(a.id));
};

/**
 * Save an archive (create or update)
 */
export const saveArchive = async (archive: Archive): Promise<void> => {
  const archives = await getAllArchives();
  const index = archives.findIndex(a => a.id === archive.id);

  // Update document count
  archive.documentCount = archive.documents.length;
  archive.updatedAt = Date.now();

  if (index >= 0) {
    archives[index] = archive;
  } else {
    archives.unshift(archive);
  }

  localStorage.setItem(ARCHIVES_KEY, JSON.stringify(archives));
};

/**
 * Delete an archive
 */
export const deleteArchive = async (id: string): Promise<void> => {
  const archives = await getAllArchives();
  const filtered = archives.filter(a => a.id !== id);
  localStorage.setItem(ARCHIVES_KEY, JSON.stringify(filtered));
};

/**
 * Add a document to an archive
 */
export const addDocumentToArchive = async (
  archiveId: string,
  document: ArchiveDocument
): Promise<void> => {
  const archive = await getArchive(archiveId);
  if (!archive) {
    throw new Error('Archive not found');
  }

  archive.documents.push(document);
  await saveArchive(archive);
};

/**
 * Remove a document from an archive
 */
export const removeDocumentFromArchive = async (
  archiveId: string,
  documentId: string
): Promise<void> => {
  const archive = await getArchive(archiveId);
  if (!archive) {
    throw new Error('Archive not found');
  }

  archive.documents = archive.documents.filter(d => d.id !== documentId);
  await saveArchive(archive);
};

/**
 * Update a document in an archive
 */
export const updateArchiveDocument = async (
  archiveId: string,
  document: ArchiveDocument
): Promise<void> => {
  const archive = await getArchive(archiveId);
  if (!archive) {
    throw new Error('Archive not found');
  }

  const index = archive.documents.findIndex(d => d.id === document.id);
  if (index >= 0) {
    archive.documents[index] = document;
    await saveArchive(archive);
  }
};

/**
 * Search documents across all archives or specific archives
 */
export const searchArchiveDocuments = async (
  query: string,
  archiveIds?: string[]
): Promise<{ archive: Archive; document: ArchiveDocument }[]> => {
  let archives = await getAllArchives();

  if (archiveIds && archiveIds.length > 0) {
    archives = archives.filter(a => archiveIds.includes(a.id));
  }

  const results: { archive: Archive; document: ArchiveDocument }[] = [];
  const lowerQuery = query.toLowerCase();

  for (const archive of archives) {
    for (const doc of archive.documents) {
      const searchableText = [
        doc.name,
        doc.citation,
        doc.parties,
        doc.summary,
        doc.content,
        ...(doc.keyPrinciples || []),
        ...(doc.sectionsReferenced || [])
      ].filter(Boolean).join(' ').toLowerCase();

      if (searchableText.includes(lowerQuery)) {
        results.push({ archive, document: doc });
      }
    }
  }

  return results;
};

/**
 * Get archive documents for AI context (returns formatted content)
 */
export const getArchiveDocumentsForContext = async (
  archiveIds: string[]
): Promise<string> => {
  if (!archiveIds || archiveIds.length === 0) return '';

  const archives = await getArchivesByIds(archiveIds);
  if (archives.length === 0) return '';

  const contextParts: string[] = [];

  for (const archive of archives) {
    contextParts.push(`\n=== Archive: ${archive.name} ===\n`);

    for (const doc of archive.documents) {
      contextParts.push(`
--- ${doc.name} ---
${doc.citation ? `Citation: ${doc.citation}` : ''}
${doc.court ? `Court: ${doc.court}` : ''}
${doc.year ? `Year: ${doc.year}` : ''}
${doc.parties ? `Parties: ${doc.parties}` : ''}
${doc.keyPrinciples && doc.keyPrinciples.length > 0 ? `Key Principles:\n${doc.keyPrinciples.map(p => `  - ${p}`).join('\n')}` : ''}
${doc.summary ? `Summary: ${doc.summary}` : ''}

Full Text:
${doc.content}
`);
    }
  }

  return contextParts.join('\n');
};
