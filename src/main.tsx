import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { validateEnvironment } from './lib/envValidation.ts';

// Hard-fail on missing required environment variables before mounting
try {
  validateEnvironment();
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  document.body.innerHTML = `
    <div style="font-family:monospace;padding:2rem;background:#0a0f1e;color:#f87171;min-height:100vh;white-space:pre-wrap;">
      <strong style="color:#fbbf24;font-size:1.1rem;">⚠ PeakEstimator — Configuration Error</strong>

${message}
    </div>
  `;
  throw err;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
