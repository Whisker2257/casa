// /Users/nashe/casa/frontend/src/components/SearchPanel.jsx
import React, { useState } from 'react';
import axios              from 'axios';
import { API_URL }        from '../config';

/**
 * Semantic Search modal (Brick 7.8)
 *
 * Props
 * ─────────────────────────────────────────────────────────────
 * projectId  – Mongo ObjectId
 * token      – JWT
 * onClose()  – close modal
 * onOpenFile(relativePath, chunkIdx) – handler to open file in Editor
 */
export default function SearchPanel({ projectId, token, onClose, onOpenFile }) {
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [results, setResults] = useState([]);

  /* ───── Run search ───── */
  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError('');
    try {
      const { data } = await axios.post(
        `${API_URL}/api/projects/${projectId}/search`,
        { query, topK: 10 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResults(data.results || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-surface p-6 rounded-lg w-2/3 max-h-[90vh] flex flex-col">
        {/* ── Header ── */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Semantic Search</h2>
          <button onClick={onClose} className="text-2xl leading-none">×</button>
        </div>

        {/* ── Input ── */}
        <div className="flex gap-2 mb-4">
          <input
            className="input input-bordered flex-1"
            placeholder="Search your project…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
          />
          <button className="btn btn-primary" onClick={runSearch} disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {error && <p className="text-error mb-2">{error}</p>}

        {/* ── Results ── */}
        <div className="overflow-y-auto flex-1 space-y-4 pr-2">
          {results.length === 0 && !loading && !error && (
            <p className="text-text-secondary">No results yet.</p>
          )}

          {results.map((r, i) => {
            const chunkIdx = Number((r.id || '').split('#')[1] || 0);
            return (
              <div
                key={i}
                className="border border-border rounded p-3 cursor-pointer hover:bg-white/5"
                onClick={() => {
                  onOpenFile(r.file, chunkIdx);   // open in editor
                  onClose();                      // close modal
                }}
              >
                <div className="flex justify-between gap-4 mb-1">
                  <span className="font-mono text-sm">{r.file}</span>
                  <span className="text-xs text-text-secondary">
                    {r.score.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">
                  {r.snippet}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
