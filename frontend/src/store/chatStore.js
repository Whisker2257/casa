// /Users/nashe/casa/frontend/src/store/chatStore.js
import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  messages: [],
  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, { role: msg.role, content: msg.content }],
    })),
  appendToLastAssistant: (chunk) =>
    set((state) => {
      const m = [...state.messages];
      if (!m.length || m[m.length - 1].role !== 'assistant') {
        m.push({ role: 'assistant', content: chunk });
      } else {
        m[m.length - 1].content += chunk;
      }
      return { messages: m };
    }),
  clearMessages: () => set({ messages: [] }),
}));
