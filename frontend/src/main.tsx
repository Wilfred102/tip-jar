import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import Landing from './pages/Landing';
import { Toaster } from 'sonner';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Toaster richColors position="top-right" expand={false} duration={3500} />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
