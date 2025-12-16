import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface ApiKeyInfo {
  key: string;
  status: 'active' | 'failed' | 'unknown';
  lastUsed?: number;
  failedAt?: number;
}

interface ApiKeyManagerProps {
  onKeysChange: (keys: string) => void;
  initialKeys: string;
}

const API_KEY_STORAGE = 'gemini_api_key';
const KEY_STATUS_STORAGE = 'gemini_api_key_status';

// Mask API key for display
const maskKey = (key: string): string => {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
};

// Validate key format (basic check)
const isValidKeyFormat = (key: string): boolean => {
  return key.length >= 20 && /^[A-Za-z0-9_-]+$/.test(key);
};

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onKeysChange, initialKeys }) => {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [newKey, setNewKey] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  // Load keys from storage on mount
  useEffect(() => {
    const loadKeys = () => {
      const savedKeys = initialKeys || localStorage.getItem(API_KEY_STORAGE) || '';
      const savedStatus = localStorage.getItem(KEY_STATUS_STORAGE);

      let statusMap: Record<string, { status: string; failedAt?: number }> = {};
      if (savedStatus) {
        try {
          statusMap = JSON.parse(savedStatus);
        } catch (e) {
          console.error('Failed to parse key status:', e);
        }
      }

      const keyList = savedKeys
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const keyInfos: ApiKeyInfo[] = keyList.map(key => ({
        key,
        status: (statusMap[key]?.status as 'active' | 'failed' | 'unknown') || 'unknown',
        failedAt: statusMap[key]?.failedAt
      }));

      setKeys(keyInfos);
    };

    loadKeys();

    // Listen for key status updates from geminiService
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === KEY_STATUS_STORAGE) {
        loadKeys();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [initialKeys]);

  // Save keys to storage and notify parent
  const saveKeys = (newKeys: ApiKeyInfo[]) => {
    const keyString = newKeys.map(k => k.key).join(',');
    localStorage.setItem(API_KEY_STORAGE, keyString);

    // Save status
    const statusMap: Record<string, { status: string; failedAt?: number }> = {};
    newKeys.forEach(k => {
      statusMap[k.key] = { status: k.status, failedAt: k.failedAt };
    });
    localStorage.setItem(KEY_STATUS_STORAGE, JSON.stringify(statusMap));

    setKeys(newKeys);
    onKeysChange(keyString);
  };

  const handleAddKey = () => {
    const trimmedKey = newKey.trim();

    if (!trimmedKey) {
      setError('Please enter an API key');
      return;
    }

    if (!isValidKeyFormat(trimmedKey)) {
      setError('Invalid API key format');
      return;
    }

    if (keys.some(k => k.key === trimmedKey)) {
      setError('This key is already added');
      return;
    }

    const newKeys = [...keys, { key: trimmedKey, status: 'unknown' as const }];
    saveKeys(newKeys);
    setNewKey('');
    setError(null);
    setShowNewKey(false);
  };

  const handleRemoveKey = (keyToRemove: string) => {
    const newKeys = keys.filter(k => k.key !== keyToRemove);
    saveKeys(newKeys);
  };

  const handleResetKeyStatus = (keyToReset: string) => {
    const newKeys = keys.map(k =>
      k.key === keyToReset
        ? { ...k, status: 'unknown' as const, failedAt: undefined }
        : k
    );
    saveKeys(newKeys);
  };

  const handleResetAllKeys = () => {
    const newKeys = keys.map(k => ({ ...k, status: 'unknown' as const, failedAt: undefined }));
    saveKeys(newKeys);
  };

  const handleBulkImport = () => {
    const lines = bulkInput
      .split(/[\n,]/) // Split by newline or comma
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      setError('No valid keys found');
      return;
    }

    const validKeys: string[] = [];
    const invalidKeys: string[] = [];
    const duplicateKeys: string[] = [];

    for (const line of lines) {
      if (!isValidKeyFormat(line)) {
        invalidKeys.push(line.slice(0, 10) + '...');
      } else if (keys.some(k => k.key === line) || validKeys.includes(line)) {
        duplicateKeys.push(line.slice(0, 10) + '...');
      } else {
        validKeys.push(line);
      }
    }

    if (validKeys.length === 0) {
      if (invalidKeys.length > 0) {
        setError(`Invalid key format: ${invalidKeys.join(', ')}`);
      } else if (duplicateKeys.length > 0) {
        setError('All keys are duplicates');
      }
      return;
    }

    const newKeyInfos: ApiKeyInfo[] = validKeys.map(key => ({
      key,
      status: 'unknown' as const
    }));

    const updatedKeys = [...keys, ...newKeyInfos];
    saveKeys(updatedKeys);
    setBulkInput('');
    setBulkMode(false);
    setError(null);

    // Show success message
    const messages: string[] = [];
    messages.push(`Added ${validKeys.length} key${validKeys.length > 1 ? 's' : ''}`);
    if (invalidKeys.length > 0) messages.push(`${invalidKeys.length} invalid`);
    if (duplicateKeys.length > 0) messages.push(`${duplicateKeys.length} duplicate`);
    console.log('Bulk import:', messages.join(', '));
  };

  const handleClearAllKeys = () => {
    if (confirm('Remove all API keys?')) {
      saveKeys([]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={12} className="text-green-400" />;
      case 'failed': return <AlertCircle size={12} className="text-red-400" />;
      default: return <div className="w-3 h-3 rounded-full bg-gray-500" />;
    }
  };

  const activeCount = keys.filter(k => k.status !== 'failed').length;
  const failedCount = keys.filter(k => k.status === 'failed').length;

  return (
    <div className="space-y-2">
      {/* Header with summary */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <label className="text-[10px] uppercase text-legal-500 font-semibold tracking-wider flex items-center gap-1">
          <Key size={10} /> API Keys ({keys.length})
        </label>
        <div className="flex items-center gap-2 text-[10px]">
          {keys.length > 0 && (
            <>
              <span className="text-green-400">{activeCount} active</span>
              {failedCount > 0 && <span className="text-red-400">{failedCount} failed</span>}
            </>
          )}
          <span className="text-legal-500">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Collapsed view - simple input */}
      {!isExpanded && (
        <div className="relative">
          <input
            type={showNewKey ? 'text' : 'password'}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
            placeholder={keys.length === 0 ? "Paste API Key..." : "Add another key..."}
            className="w-full bg-legal-900 border border-legal-800 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all placeholder-gray-700 pr-16"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowNewKey(!showNewKey)}
              className="p-1 text-gray-500 hover:text-gray-300"
            >
              {showNewKey ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <button
              type="button"
              onClick={handleAddKey}
              disabled={!newKey.trim()}
              className="p-1 text-saffron hover:text-saffron/80 disabled:text-gray-600"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Expanded view - full management */}
      {isExpanded && (
        <div className="space-y-2 bg-legal-900/50 rounded-lg p-2">
          {/* Mode toggle */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button
                onClick={() => setBulkMode(false)}
                className={`text-[10px] px-2 py-1 rounded ${!bulkMode ? 'bg-saffron text-white' : 'bg-legal-800 text-gray-400 hover:text-gray-300'}`}
              >
                Single
              </button>
              <button
                onClick={() => setBulkMode(true)}
                className={`text-[10px] px-2 py-1 rounded ${bulkMode ? 'bg-saffron text-white' : 'bg-legal-800 text-gray-400 hover:text-gray-300'}`}
              >
                Bulk Import
              </button>
            </div>
            {keys.length > 0 && (
              <button
                onClick={handleClearAllKeys}
                className="text-[10px] text-red-500 hover:text-red-400"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Key list */}
          {keys.length > 0 && !bulkMode && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {keys.map((keyInfo, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between bg-legal-900 rounded px-2 py-1.5 text-xs ${
                    keyInfo.status === 'failed' ? 'border border-red-900/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(keyInfo.status)}
                    <span className={`font-mono ${getStatusColor(keyInfo.status)}`}>
                      {maskKey(keyInfo.key)}
                    </span>
                    {keyInfo.status === 'failed' && keyInfo.failedAt && (
                      <span className="text-[10px] text-red-400/70">
                        (failed {Math.round((Date.now() - keyInfo.failedAt) / 1000)}s ago)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {keyInfo.status === 'failed' && (
                      <button
                        onClick={() => handleResetKeyStatus(keyInfo.key)}
                        className="p-1 text-yellow-500 hover:text-yellow-400"
                        title="Reset key status"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveKey(keyInfo.key)}
                      className="p-1 text-red-500 hover:text-red-400"
                      title="Remove key"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bulk import mode */}
          {bulkMode ? (
            <div className="space-y-2">
              <textarea
                value={bulkInput}
                onChange={(e) => { setBulkInput(e.target.value); setError(null); }}
                placeholder="Paste multiple API keys (one per line)..."
                className="w-full bg-legal-800 border border-legal-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all placeholder-gray-600 font-mono resize-none h-24"
              />
              <button
                onClick={handleBulkImport}
                disabled={!bulkInput.trim()}
                className="w-full bg-saffron hover:bg-saffron/90 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs py-1.5 rounded transition-colors"
              >
                Import Keys
              </button>
            </div>
          ) : (
            /* Add new key input - single mode */
            <div className="relative">
              <input
                type={showNewKey ? 'text' : 'password'}
                value={newKey}
                onChange={(e) => { setNewKey(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
                placeholder="Paste new API key..."
                className="w-full bg-legal-800 border border-legal-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all placeholder-gray-600 pr-16"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowNewKey(!showNewKey)}
                  className="p-1 text-gray-500 hover:text-gray-300"
                >
                  {showNewKey ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button
                type="button"
                onClick={handleAddKey}
                disabled={!newKey.trim()}
                className="p-1 text-saffron hover:text-saffron/80 disabled:text-gray-600"
              >
                <Plus size={14} />
              </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-[10px] text-red-400 flex items-center gap-1">
              <AlertCircle size={10} /> {error}
            </p>
          )}

          {/* Actions */}
          {keys.length > 0 && failedCount > 0 && (
            <button
              onClick={handleResetAllKeys}
              className="w-full text-[10px] text-yellow-500 hover:text-yellow-400 flex items-center justify-center gap-1 py-1"
            >
              <RefreshCw size={10} /> Reset all failed keys
            </button>
          )}

          {/* Help text */}
          <p className="text-[9px] text-legal-600 leading-relaxed">
            Add multiple API keys for automatic failover. Keys rotate when rate limits are hit.
            Get keys from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-saffron hover:underline">Google AI Studio</a>.
          </p>
        </div>
      )}
    </div>
  );
};

export default ApiKeyManager;
