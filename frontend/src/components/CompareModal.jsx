// frontend/src/components/CompareModal.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

/**
 * CompareModal
 * Props:
 *   projectId  – Mongo ObjectId
 *   paths      – string[]   (relative PDF paths)
 *   token      – JWT string
 *   onClose()  – close handler
 */
export default function CompareModal({ projectId, paths, token, onClose }) {
  const [focus, setFocus]     = useState('');
  const [running, setRunning] = useState(false);
  const [output, setOutput]   = useState('');
  const [error,  setError]    = useState('');
  const [statusMsg, setStatusMsg] = useState('');   // feedback after insert

  const authHdr = { Authorization: `Bearer ${token}` };

  /* ───── Comparison call ───── */
  const runCompare = async () => {
    if (paths.length < 2) return;
    setRunning(true); setOutput(''); setError(''); setStatusMsg('');
    try {
      const res = await fetch(
        `${API_URL}/api/projects/${projectId}/compare`,
        {
          method : 'POST',
          headers: { 'Content-Type': 'application/json', ...authHdr },
          body: JSON.stringify({ paths, focus: focus || 'overall comparison' }),
        }
      );

      if (!res.ok) {
        setError(await res.text());
      } else {
        const reader  = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          if (value) setOutput((prev) => prev + decoder.decode(value));
          done = doneReading;
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  // auto-run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { runCompare(); }, []);

  /* ───── Insert helper ───── */
  const insertIntoNote = async () => {
    if (!output.trim()) return;
    const notePath = prompt('Enter note path (e.g. notes/my_note.md):');
    if (!notePath) return;

    setStatusMsg('Inserting…');
    try {
      // get existing content (if any)
      let existing = '';
      try {
        const res = await axios.get(
          `${API_URL}/api/projects/${projectId}/file`,
          { headers: authHdr, params: { path: notePath }, responseType: 'text' }
        );
        existing = res.data;
      } catch { /* new file */ }

      const newContent = existing + (existing ? '\n\n' : '') + output;
      await axios.post(
        `${API_URL}/api/projects/${projectId}/patches/apply`,
        { path: notePath, content: newContent },
        { headers: authHdr }
      );
      setStatusMsg(`Inserted into ${notePath}`);
      window.dispatchEvent(new CustomEvent('file-changed', { detail: notePath }));
    } catch (err) {
      setStatusMsg(`Insert failed: ${err.response?.data?.error || err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface p-6 rounded-lg w-3/4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Compare Papers</h2>
          <button onClick={onClose} className="text-2xl leading-none">×</button>
        </div>

        {/* Focus & run */}
        <div className="flex gap-2 mb-4">
          <input
            className="input input-bordered flex-1"
            placeholder="Focus / Question (optional)"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            disabled={running}
          />
          <button className="btn btn-primary" onClick={runCompare} disabled={running}>
            {running ? 'Running…' : 'Run Compare'}
          </button>
        </div>

        {error && <p className="text-error whitespace-pre-wrap mb-2">{error}</p>}

        {/* Output */}
        <pre className="flex-1 overflow-auto whitespace-pre-wrap border border-border rounded p-3 text-sm">
          {output || (running ? 'Working…' : 'No output yet.')}
        </pre>

        {/* Insert button */}
        {!running && output && (
          <div className="flex justify-end mt-4">
            <button onClick={insertIntoNote} className="btn btn-primary">
              Insert into Note
            </button>
          </div>
        )}

        {statusMsg && (
          <p className="mt-2 text-xs text-text-secondary whitespace-pre-wrap">{statusMsg}</p>
        )}
      </div>
    </div>
  );
}
