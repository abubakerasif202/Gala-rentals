import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {FluentProvider} from '@fluentui/react-components';
import App from './App.tsx';
import './index.css';
import {galaLightTheme} from './theme/galaTheme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={galaLightTheme} style={{ minHeight: '100%' }}>
      <App />
    </FluentProvider>
  </StrictMode>,
);
