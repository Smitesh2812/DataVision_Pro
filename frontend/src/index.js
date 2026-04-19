import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Google Fonts loaded here so they apply globally
const link = document.createElement('link');
link.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600&display=swap';
link.rel = 'stylesheet';
document.head.appendChild(link);

// Global reset styles injected at runtime
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body {
    background: #05060b;
    color: #eef0fa;
    font-family: 'Outfit', sans-serif;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
  input, select, button, textarea { font-family: inherit; }
  a { color: inherit; text-decoration: none; }
`;
document.head.appendChild(style);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
