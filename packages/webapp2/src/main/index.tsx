import React from 'react';
import * as Sentry from '@sentry/react';
import { RoutedApplication } from './application';
import { setTheme } from './utils/theme-switcher';
import { LocalStorageRepository } from './services/local-storage/local-storage-repository';
import { createRoot } from 'react-dom/client';
import { NO_HTTP_URL, SENTRY_DSN } from './constant';

import './styles.css';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NO_HTTP_URL,
    tracesSampleRate: 0.5,
  });

  Sentry.setTag('package', 'webapp2');
}
const themePreference = LocalStorageRepository.getUserThemePreference();

if (themePreference === 'dark') {
  // Set user theme preference to dark if it was set
  setTheme('dark');
} else {
  // Always set system theme preference to light if no user preference is set
  LocalStorageRepository.setSystemThemePreference('light');
  setTheme('light');
}

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<RoutedApplication />);
