import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ConfigProvider } from './config';
import { ResourceDatabaseProvider } from './lib/resourceDatabase';
import './styles/theme.css';
import './styles/primitives.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider>
      <ResourceDatabaseProvider>
        <App />
      </ResourceDatabaseProvider>
    </ConfigProvider>
  </React.StrictMode>
);
