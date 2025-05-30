// /Users/nashe/casa/frontend/src/components/DiffViewer.jsx
import React from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

export default function DiffViewer({ before, after, onAccept, onReject }) {
  return (
    <div className="bg-surface border border-border rounded p-4">
      <ReactDiffViewer
        oldValue={before}
        newValue={after}
        splitView={true}
        hideLineNumbers={false}
        showDiffOnly={false}
        compareMethod={DiffMethod.WORDS}
      />
      <div className="flex justify-end space-x-2 mt-4">
        <button onClick={onReject} className="btn btn-outline">
          Reject
        </button>
        <button onClick={onAccept} className="btn btn-primary">
          Accept
        </button>
      </div>
    </div>
  );
}
