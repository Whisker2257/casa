//Users/nashe/casa_project/casa/frontend/src/components/PDFQAModal.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

export default function PDFQAModal({ projectId, path, token, onClose }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading]   = useState(false);
  const [answer, setAnswer]     = useState('');
  const [error, setError]       = useState('');

  const runQA = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');
    setError('');

    try {
      const res = await fetch(
        `${API_URL}/api/projects/${projectId}/pdf/qa`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            Authorization:   `Bearer ${token}`,
          },
          body: JSON.stringify({ path, question, topK: 5 }),
        }
      );

      if (!res.ok) {
        const errTxt = await res.text();
        setError(errTxt);
      } else {
        const reader  = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          if (value) {
            setAnswer((prev) => prev + decoder.decode(value));
          }
          done = doneReading;
        }
      }
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface p-6 rounded-lg w-1/2 max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Ask PDF: <code>{path}</code></h2>
          <button onClick={onClose} className="text-2xl leading-none">×</button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runQA();
              }
            }}
            className="input input-bordered w-full"
            placeholder="Type your question…"
            disabled={loading}
          />
          <button
            onClick={runQA}
            disabled={loading}
            className="btn btn-primary mt-2"
          >
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </div>

        {error && <p className="text-error">{error}</p>}

        {answer && (
          <pre className="whitespace-pre-wrap bg-background border border-border p-2 text-sm rounded">
            {answer}
          </pre>
        )}
      </div>
    </div>
  );
}
