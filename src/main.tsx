import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { initTheme } from './utils/theme';
import App from './App.tsx';
import './index.css';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
