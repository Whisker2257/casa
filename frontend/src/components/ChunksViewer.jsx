// /Users/nashe/casa/frontend/src/components/ChunksViewer.jsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

/**
 * Modal that fetches (cached) chunks for a file,
 * displays a scrollable list, and lets you expand/collapse each chunk.
 */
export default function ChunksViewer({ projectId, path, token, onClose }) {
  const [chunks, setChunks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setLoading(true);
    setError('');
    axios
      .get(`${API_URL}/api/projects/${projectId}/chunk`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { path, chunkSize: 500, overlap: 50 },
      })
      .then((res) => {
        setChunks(res.data.chunks || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message);
        setLoading(false);
      });
  }, [projectId, path, token]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface p-6 rounded-lg w-3/4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Chunks for <code>{path}</code>
          </h2>
          <button onClick={onClose} className="text-2xl leading-none">&times;</button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 space-y-4 pr-2">
          {loading && <p className="text-text-secondary">Loading chunks…</p>}

          {!loading && error && (
            <p className="text-error">{error}</p>
          )}

          {!loading && !error && chunks.length === 0 && (
            <p className="text-text-secondary">No chunks found.</p>
          )}

          {!loading && chunks.map((chunk) => (
            <div key={chunk.id} className="border border-border rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-sm">{chunk.id}</span>
                <button
                  onClick={() =>
                    setExpanded((e) => ({ ...e, [chunk.id]: !e[chunk.id] }))
                  }
                  className="text-xs btn btn-outline"
                >
                  {expanded[chunk.id] ? 'Collapse' : 'Expand'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm">
                {expanded[chunk.id]
                  ? chunk.text
                  : chunk.text.length > 100
                    ? `${chunk.text.slice(0, 100)}…`
                    : chunk.text}
              </pre>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
