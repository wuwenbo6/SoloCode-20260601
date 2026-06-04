import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { GamepadProvider } from './contexts/GamepadContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GamepadProvider>
          <App />
        </GamepadProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);