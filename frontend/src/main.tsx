import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initializeAnalytics } from './analytics';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root がありません');
}
initializeAnalytics();
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
