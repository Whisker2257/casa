// /Users/nashe/casa/frontend/src/components/StatusBar.jsx
import React from 'react';

export default function StatusBar({ backendStatus, mode, autosave }) {
  return (
    <div className="h-8 bg-surface border-t border-border flex items-center px-4 text-xs text-text-secondary">
      <span>Backend: {backendStatus}</span>
      <span className="mx-4">Mode: {mode}</span>
      <span className="ml-auto">Autosave: {autosave}</span>
    </div>
  );
}
