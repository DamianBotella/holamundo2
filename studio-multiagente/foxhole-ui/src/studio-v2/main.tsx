import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Studio } from './Studio';
import '../index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root no encontrado en studio-v2.html');
createRoot(root).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
);
