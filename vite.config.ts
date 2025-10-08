import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

const config = defineConfig({
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    TanStackRouterVite(),
    tailwindcss(),
    viteReact(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'MyGGV',
        short_name: 'MyGGV',
        description: 'My GGV App',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'AppImages/android/android-launchericon-192-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'AppImages/android/android-launchericon-512-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'AppImages/android/android-launchericon-144-144.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: 'AppImages/android/android-launchericon-96-96.png',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            src: 'AppImages/android/android-launchericon-72-72.png',
            sizes: '72x72',
            type: 'image/png',
          },
          {
            src: 'AppImages/android/android-launchericon-48-48.png',
            sizes: '48x48',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})

export default config
