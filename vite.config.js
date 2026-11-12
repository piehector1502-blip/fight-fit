import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the build works both on localhost and on
  // GitHub Pages (served from https://<user>.github.io/<repo>/).
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate', // new versions replace the old one automatically
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'FightFit',
        short_name: 'FightFit',
        description: 'Training, round timer and diet tracker',
        lang: 'it',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#111318',
        theme_color: '#111318',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Pre-cache every built file so the app opens with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,mp3,wav}'],
      },
    }),
  ],
});
