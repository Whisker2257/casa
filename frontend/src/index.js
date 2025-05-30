// /Users/nashe/casa/frontend/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';            // Tailwind base
import './styles/global.css';    // ← dark-theme & button styles
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
