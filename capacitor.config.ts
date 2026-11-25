import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Поменяйте appId на свой домен до первой публикации в сторах — потом его не сменить.
  appId: 'com.kaelmor.game',
  appName: 'Каэлмор',
  webDir: 'dist',
  backgroundColor: '#110e16',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#e0b052',
    },
  },
};

export default config;
