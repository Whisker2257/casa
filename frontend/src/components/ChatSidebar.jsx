// /Users/nashe/casa/frontend/src/components/ChatSidebar.jsx
import React, { useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { API_URL }      from '../config';

export default function ChatSidebar({ projectId, filePaths, activeFolder, activeFile, token }) {
  const messages              = useChatStore((s) => s.messages);
  const addMessage            = useChatStore((s) => s.addMessage);
  const appendToLastAssistant = useChatStore((s) => s.appendToLastAssistant);
  const clearMessages         = useChatStore((s) => s.clearMessages);

  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    // 1) Detect patch command: "replace {search} with {replace} in {path}"
    const cmd = text.match(/^replace\s+(.+?)\s+with\s+(.+?)\s+in\s+(.+)$/i);
    if (cmd) {
      const [, searchText, replaceText, filePath] = cmd;
      // record user message
      addMessage({ role: 'user', content: text });
      // confirm to user
      addMessage({
        role: 'assistant',
        content: `Running patch: replace "${searchText}" with "${replaceText}" in ${filePath}.`
      });
      // dispatch custom event for CodeEditMVP
      window.dispatchEvent(new CustomEvent('run-patch', {
        detail: {
          path: searchText ? filePath.trim() : filePath.trim(),
          search: searchText.trim(),
          replace: replaceText.trim()
        }
      }));
      // clear input
      setInput('');
      return;
    }

    // 2) Regular chat flow
    setInput('');
    addMessage({ role: 'user', content: text });

    const DEFAULT_ROOT_FOLDERS = ['Papers', 'Datasets', 'Code', 'Figures', 'Notes', 'Output Documents'];
    const systemParts = [
      `Default root folders: ${DEFAULT_ROOT_FOLDERS.join(', ')}`,
      `Directories: ${filePaths.join(', ')}`,
      activeFolder ? `Current folder: ${activeFolder}` : `Current folder: (root)`,
      activeFile ? `Active file: ${activeFile}` : `No file currently open`
    ];
    const systemPrompt = systemParts.join('\n');

    const history = useChatStore.getState().messages;
    const context = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: text }
    ];

    addMessage({ role: 'assistant', content: '' });
    setStreaming(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, messages: context })
      });

      if (!res.ok) {
        const errTxt = await res.text();
        appendToLastAssistant(`Error: ${errTxt}`);
      } else {
        const reader  = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          if (value) appendToLastAssistant(decoder.decode(value));
          done = doneReading;
        }
      }
    } catch (err) {
      appendToLastAssistant(`Error: ${err.message}`);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <aside className="w-80 bg-surface border-l border-border flex flex-col text-xs">
      <div className="px-4 py-2 border-b border-border flex justify-between items-center">
        <h2 className="font-semibold">Chat</h2>
        <button onClick={clearMessages} className="text-xs text-error">Clear</button>
      </div>

      <div className="flex-1 p-2 overflow-auto space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`
                inline-block px-3 py-1 rounded whitespace-pre-wrap break-words max-w-[80%]
                ${m.role === 'user' ? 'bg-primary text-white' : 'bg-surface text-text-primary'}
              `}>
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendMessage();
            }
          }}
          className="input input-bordered w-full text-xs"
          placeholder={streaming ? 'Streaming…' : 'Type a message…'}
          disabled={streaming}
        />
      </div>
    </aside>
);
}
