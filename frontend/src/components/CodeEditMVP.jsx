// /Users/nashe/casa/frontend/src/components/CodeEditMVP.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import DiffViewer from './DiffViewer';

export default function CodeEditMVP({ projectId, token }) {
  const [path, setPath] = useState('');
  const [search, setSearch] = useState('');
  const [replace, setReplace] = useState('');
  const [patches, setPatches] = useState([]);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [undoStack, setUndoStack] = useState([]);

  // Shared logic to run a patch from parameters
  const handlePatchCommand = async ({ path: p, search: s, replace: r }) => {
    setError('');
    setRunning(true);
    setPath(p);
    setSearch(s);
    setReplace(r);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/projects/${projectId}/patches`,
        { edits: [{ path: p, search: s, replace: r }] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!data.patches?.length) {
        setError('No matches found');
        setPatches([]);
      } else {
        setPatches(data.patches);
        setIdx(0);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setPatches([]);
    } finally {
      setRunning(false);
    }
  };

  // Listen for Chat → patch commands
  useEffect(() => {
    const handler = e => handlePatchCommand(e.detail);
    window.addEventListener('run-patch', handler);
    return () => window.removeEventListener('run-patch', handler);
  }, [projectId, token]);

  // Manual trigger
  const runPatch = async () => {
    setError('');
    if (!path.trim() || !search) {
      setError('File path and search text are required');
      return;
    }
    setRunning(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/projects/${projectId}/patches`,
        { edits: [{ path, search, replace }] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!data.patches?.length) {
        setError('No matches found');
        setPatches([]);
      } else {
        setPatches(data.patches);
        setIdx(0);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setPatches([]);
    } finally {
      setRunning(false);
    }
  };

  // Apply a patch
  const applyPatchToServer = async (patch, contentKey = 'after') => {
    await axios.post(
      `${API_URL}/api/projects/${projectId}/patches/apply`,
      { path: patch.path, content: patch[contentKey] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  };

  const accept = async () => {
    setError('');
    const patch = patches[idx];
    try {
      await applyPatchToServer(patch, 'after');
      setUndoStack(stack => [...stack, patch]);
      window.dispatchEvent(new CustomEvent('file-changed', { detail: patch.path }));
      if (idx < patches.length - 1) {
        setIdx(i => i + 1);
      } else {
        setPatches([]);
      }
    } catch (err) {
      setError(`Failed to apply patch: ${err.response?.data?.error || err.message}`);
    }
  };

  const reject = () => {
    if (idx < patches.length - 1) {
      setIdx(i => i + 1);
    } else {
      setPatches([]);
    }
  };

  const acceptAll = async () => {
    setError('');
    for (let i = idx; i < patches.length; i++) {
      const patch = patches[i];
      try {
        await applyPatchToServer(patch, 'after');
        setUndoStack(stack => [...stack, patch]);
        window.dispatchEvent(new CustomEvent('file-changed', { detail: patch.path }));
      } catch (err) {
        setError(`Failed at patch ${i+1}: ${err.response?.data?.error || err.message}`);
        break;
      }
    }
    setPatches([]);
  };

  const rejectAll = () => {
    setPatches([]);
  };

  const undo = async () => {
    if (!undoStack.length) return;
    const last = undoStack[undoStack.length - 1];
    try {
      await applyPatchToServer(last, 'before');
      window.dispatchEvent(new CustomEvent('file-changed', { detail: last.path }));
      setUndoStack(stack => stack.slice(0, -1));
    } catch (err) {
      setError(`Undo failed: ${err.response?.data?.error || err.message}`);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        patches.length && acceptAll();
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        patches.length && rejectAll();
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoStack.length && undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [patches, undoStack]);

  return (
    <div className="p-4 bg-surface border border-border rounded space-y-4">
      <h2 className="text-lg font-semibold">Code Edit MVP</h2>

      <div className="grid grid-cols-4 gap-4">
        <input
          className="input input-bordered"
          placeholder="File path (e.g. Code/test.txt)"
          value={path}
          onChange={e => setPath(e.target.value)}
        />
        <input
          className="input input-bordered"
          placeholder="Search text"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <input
          className="input input-bordered"
          placeholder="Replace text (optional)"
          value={replace}
          onChange={e => setReplace(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={runPatch}
          disabled={running}
        >
          {running ? 'Running…' : 'Run Edit'}
        </button>
      </div>

      {error && <p className="text-error">{error}</p>}

      <div className="flex space-x-2">
        <button onClick={acceptAll} className="btn btn-outline" disabled={!patches.length} title="Ctrl+Shift+A">
          Accept All
        </button>
        <button onClick={rejectAll} className="btn btn-outline" disabled={!patches.length} title="Ctrl+Shift+R">
          Reject All
        </button>
        <button onClick={undo} className="btn btn-outline" disabled={!undoStack.length} title="Ctrl+Shift+Z">
          Undo Last
        </button>
      </div>

      {patches.length > 0 && (
        <>
          <p className="mb-2">
            Patch {idx + 1} of {patches.length} for <strong>{patches[idx].path}</strong>
          </p>
          <DiffViewer
            before={patches[idx].before}
            after={patches[idx].after}
            onAccept={accept}
            onReject={reject}
          />
        </>
      )}
    </div>
  );
}
