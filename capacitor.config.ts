import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.onkar.speakingpartner',
  appName: 'Speaking Partner',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
