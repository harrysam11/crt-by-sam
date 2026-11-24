import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL || process.env.VITE_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.crtbysam.terminal',
  appName: 'CRT Terminal',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    ...(serverUrl ? { url: serverUrl } : {}),
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'localhost',
      '127.0.0.1',
      '10.0.2.2',
      '*.binance.com',
      '*.faireconomy.media',
      '*.yahoo.com'
    ]
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    scheme: 'CRT Terminal'
  }
};

export default config;
