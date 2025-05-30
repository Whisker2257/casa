// frontend/src/components/MainPanel.jsx
/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useNavigate }   from 'react-router-dom';
import axios             from 'axios';
import PreviewPane       from './PreviewPane';
import StatusBar         from './StatusBar';
import CodeEditMVP       from './CodeEditMVP';
import ChunksViewer      from './ChunksViewer';
import CompareModal      from './CompareModal';      // ← NEW
import { API_URL }       from '../config';

/**
 * Central workspace panel (file list, preview, patch UI, etc.).
 *
 * Props
 * ─────────────────────────────────────────────────────────────
 * projName        – string                     project display name
 * status          – string                     backend status ("OK"/"Offline")
 * selectedNode    – string                     current folder ('' means root)
 * files           – array<{ path, isDir }>     files in selectedNode
 * previewFile     – string|null                relative path of previewed file
 * setPreviewFile  – fn                         set preview file
 * onContextMenu   – fn(event,type,node)        Explorer/Main context menu hook
 * onOpenSearch    – fn                         open SearchPanel modal
 * projectId       – string                     Mongo ObjectId
 * token           – string                     JWT auth token
 */
export default function MainPanel({
  projName,
  status,
  selectedNode,
  files,
  previewFile,
  setPreviewFile,
  onContextMenu,
  onOpenSearch,
  projectId,
  token,
}) {
  const navigate = useNavigate();

  /* ───── Cognified-file tracking ───── */
  const [cognifiedPaths,     setCognifiedPaths]   = useState({});
  const [showCognifyModal,   setShowCognifyModal] = useState(false);
  const [cognifyPath,        setCognifyPath]      = useState(null);
  const [cognifyProgress,    setCognifyProgress]  = useState([]);
  const [cognifyDone,        setCognifyDone]      = useState(false);
  const [cognifyError,       setCognifyError]     = useState('');

  /* ───── NEW: PDF-selection for comparison ───── */
  const [selectedPdfs,     setSelectedPdfs]   = useState([]);   // array<string>
  const [showCompareModal, setShowCompareModal] = useState(false);

  /* ───── Fetch pre-existing cognified files on mount ───── */
  useEffect(() => {
    if (!projectId || !token) return;
    axios
      .get(`${API_URL}/api/projects/${projectId}/cognified`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const map = {};
        (res.data.paths || []).forEach((p) => (map[p] = true));
        setCognifiedPaths(map);
      })
      .catch(() => {});
  }, [projectId, token]);

  /* ───── Cognify handler ───── */
  const handleCognify = async (path) => {
    setCognifyError('');
    setCognifyProgress([]);
    setCognifyDone(false);
    setCognifyPath(path);
    setShowCognifyModal(true);

    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/cognify`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify({ path }),
      });

      if (!res.ok) {
        setCognifyError(await res.text());
      } else {
        const reader  = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          if (value) setCognifyProgress((p) => [...p, decoder.decode(value)]);
          done = doneReading;
        }
        setCognifyDone(true);
        setCognifiedPaths((p) => ({ ...p, [path]: true }));
      }
    } catch (err) {
      setCognifyError(err.message);
    }
  };

  /* ───── Toggle PDF selection ───── */
  const togglePdf = (relPath) =>
    setSelectedPdfs((arr) =>
      arr.includes(relPath) ? arr.filter((p) => p !== relPath) : [...arr, relPath]
    );

  /* ───── Chunks viewer modal state ───── */
  const [viewChunksPath, setViewChunksPath] = useState(null);

  return (
    <section className="flex-1 flex flex-col">
      {/* ─────────── Header ─────────── */}
      <header className="h-12 bg-surface border-b border-border flex items-center px-4 gap-4">
        <span className="font-medium truncate">{projName}</span>

        {/* Search button */}
        <button onClick={onOpenSearch} className="btn btn-outline btn-sm">
          🔍 Search
        </button>

        {/* Compare button appears when ≥2 PDFs selected */}
        {selectedPdfs.length >= 2 && (
          <button
            onClick={() => setShowCompareModal(true)}
            className="btn btn-primary btn-sm"
          >
            Compare Selected ({selectedPdfs.length})
          </button>
        )}

        <span className="ml-auto text-xs text-text-secondary">{status}</span>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn btn-outline btn-sm"
        >
          Dashboard
        </button>
      </header>

      {/* ─────────── Main body ─────────── */}
      <main className="flex-1 p-6 overflow-auto space-y-8">
        {selectedNode ? (
          <>
            <h3 className="text-xl font-semibold mb-4 capitalize">
              {selectedNode || '(root)'}
            </h3>

            {cognifyError && <p className="text-error mb-2">{cognifyError}</p>}

            {/* File list */}
            <ul className="list-disc pl-6 space-y-1 text-text-secondary">
              {files.map((f) => {
                const rel       = f.path.replace(`${projectId}/`, '');
                const name      = rel.replace(`${selectedNode}/`, '');
                const isIndexed = !!cognifiedPaths[rel];
                const isPdf     = rel.toLowerCase().endsWith('.pdf');

                return (
                  <li
                    key={f.path}
                    className="flex justify-between items-center gap-2"
                    onContextMenu={(e) =>
                      onContextMenu(e, 'file', { name, path: rel })
                    }
                  >
                    <div
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                      onClick={() => setPreviewFile(rel)}
                    >
                      {isPdf && (
                        <input
                          type="checkbox"
                          checked={selectedPdfs.includes(rel)}
                          onChange={(e) => {
                            e.stopPropagation();
                            togglePdf(rel);
                          }}
                        />
                      )}
                      <span className="hover:underline truncate">{name}</span>
                    </div>

                    {isIndexed ? (
                      <button
                        onClick={() => setViewChunksPath(rel)}
                        className="btn btn-xs btn-outline"
                      >
                        View Chunks
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCognify(rel)}
                        disabled={showCognifyModal}
                        className="btn btn-xs btn-outline"
                      >
                        Cognify
                      </button>
                    )}
                  </li>
                );
              })}
              {!files.length && <li className="italic">No files here</li>}
            </ul>

            {/* Preview pane */}
            {previewFile && (
              <PreviewPane
                projectId={projectId}
                path={previewFile}
                token={token}
              />
            )}

            {/* Code-patch UI */}
            <CodeEditMVP projectId={projectId} token={token} />
          </>
        ) : (
          <div className="h-full grid place-content-center text-text-secondary">
            <p>Select a folder to view &amp; preview its files.</p>
          </div>
        )}
      </main>

      {/* ─────────── Status bar ─────────── */}
      <StatusBar backendStatus={status} mode="Ask" autosave="On" />

      {/* ─────────── Cognify progress modal ─────────── */}
      {showCognifyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-lg w-1/2 max-h-3/4 overflow-auto">
            <h2 className="text-xl font-semibold mb-4">
              Cognifying&nbsp;<code>{cognifyPath}</code>
            </h2>
            <pre className="whitespace-pre-wrap text-sm mb-4">
              {cognifyProgress.join('')}
            </pre>
            <div className="flex justify-end">
              {cognifyDone ? (
                <button
                  onClick={() => {
                    setShowCognifyModal(false);
                    setCognifyProgress([]);
                  }}
                  className="btn btn-primary"
                >
                  OK
                </button>
              ) : (
                <button className="btn btn-disabled">Working…</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────── Chunks viewer modal ─────────── */}
      {viewChunksPath && (
        <ChunksViewer
          projectId={projectId}
          path={viewChunksPath}
          token={token}
          onClose={() => setViewChunksPath(null)}
        />
      )}

      {/* ─────────── Compare modal (NEW) ─────────── */}
      {showCompareModal && (
        <CompareModal
          projectId={projectId}
          paths={selectedPdfs}
          token={token}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </section>
  );
}
