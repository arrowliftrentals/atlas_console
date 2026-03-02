import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Strict Mode disabled due to WebGL context limits with Three.js
// Strict Mode intentionally double-mounts components in dev, which creates
// multiple WebGL contexts and causes "Context Lost" errors
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
