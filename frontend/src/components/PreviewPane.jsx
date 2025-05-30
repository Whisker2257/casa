// /Users/nashe/casa/frontend/src/components/PreviewPane.jsx
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import Editor         from '@monaco-editor/react';
import ReactMarkdown  from 'react-markdown';
import axios          from 'axios';
import { API_URL }    from '../config';
import PDFQAModal     from './PDFQAModal';

export default function PreviewPane({ projectId, path, token }) {
  return <Content key={path} projectId={projectId} path={path} token={token} />;
}

function Content({ projectId, path, token }) {
  const ext = path.split('.').pop().toLowerCase();

  // State for PDF-ask modal
  const [showAskModal, setShowAskModal] = useState(false);

  // text/code state
  const [content, setContent]     = useState('');
  const [textError, setTextError] = useState('');
  // run state
  const [running, setRunning]     = useState(false);
  const [runOutput, setRunOutput] = useState(null);

  // chat store
  const addMessage            = useChatStore(s => s.addMessage);
  const appendToLastAssistant = useChatStore(s => s.appendToLastAssistant);

  // reset on new file
  useEffect(() => {
    setContent('');
    setTextError('');
    setRunOutput(null);
    setRunning(false);
    setShowAskModal(false);
  }, [path]);

  // fetch content for text/code/markdown
  useEffect(() => {
    if (['md','js','ts','py','json','txt'].includes(ext)) {
      axios.get(`${API_URL}/api/projects/${projectId}/file`, {
        headers:      { Authorization: `Bearer ${token}` },
        params:        { path },
        responseType:  'text',
      })
      .then(r => setContent(r.data))
      .catch(() => setTextError('Failed to load file'));
    }
  }, [ext, path, projectId, token]);

  // secure URL for embeds
  const securedUrl =
    `${API_URL}/api/projects/${projectId}/file` +
    `?path=${encodeURIComponent(path)}` +
    `&token=${encodeURIComponent(token)}`;

  // Run handler (python, unchanged) …
  const runCode = async () => {
    // existing run code …
  };

  return (
    <div className="mt-6 border border-border rounded p-4 overflow-auto bg-surface">
      {/* PDF */}
      {ext === 'pdf' && (
        <>
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setShowAskModal(true)}
              className="btn btn-outline btn-sm"
            >
              Ask PDF
            </button>
          </div>
          <iframe
            src={securedUrl}
            title={path}
            width="100%"
            height="800px"
            className="border"
          />
        </>
      )}

      {/* Markdown */}
      {ext === 'md' && (
        textError
          ? <p className="text-error">{textError}</p>
          : <ReactMarkdown>{content}</ReactMarkdown>
      )}

      {/* Code/Text */}
      {['js','ts','py','json','txt'].includes(ext) && (
        <>
          {/* unchanged code/text preview + run button */}
        </>
      )}

      {/* Images */}
      {['png','jpg','jpeg','gif','bmp','svg'].includes(ext) && (
        <img
          src={securedUrl}
          alt={path.split('/').pop()}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      )}

      {/* Fallback */}
      {![
        'pdf','md','js','ts','py','json','txt',
        'png','jpg','jpeg','gif','bmp','svg'
      ].includes(ext) && (
        <p className="text-text-secondary">
          No preview available for .{ext}
        </p>
      )}

      {/* Ask PDF Modal */}
      {showAskModal && (
        <PDFQAModal
          projectId={projectId}
          path={path}
          token={token}
          onClose={() => setShowAskModal(false)}
        />
      )}
    </div>
  );
}
