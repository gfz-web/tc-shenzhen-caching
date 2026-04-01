import { pwa } from './app/config/pwa'
import { appDescription } from './app/constants/index'

export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@vite-pwa/nuxt',
    '@nuxt/eslint',
  ],

  devtools: {
    enabled: true,
  },

  app: {
    head: {
      viewport: 'width=device-width,initial-scale=1',
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/svg+xml', href: '/nuxt.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],

      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: appDescription },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: 'white' },
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#222222' },
      ],
      script: [
        {
          type: 'text/javascript',
          src: 'https://webapi.amap.com/maps?v=2.0&key=87c84b874953cfe095bceaf58148f1b1&plugin=AMap.Scale,AMap.ToolBar,AMap.InfoWindow',
        },

      ],
    },
  },

  css: [
    'driver.js/dist/driver.css',
  ],

  colorMode: {
    classSuffix: '',
  },

  // 运行时配置
  runtimeConfig: {
    // 服务端配置（本地用 .env：NUXT_SUPABASE_URL / NUXT_SUPABASE_ANON_KEY）
    supabaseUrl: '',
    supabaseAnonKey: '',

    // 公共配置（.env：NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_ANON_KEY）
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',

      // 文件上传配置
      uploadEndpoint: 'https://fc-mp-729b36f8-00b6-4256-a4f1-18f567945edd.next.bspapp.com/upload',
    },
  },

  future: {
    compatibilityVersion: 4,
  },

  experimental: {
    // when using generate, payload js assets included in sw precache manifest
    // but missing on offline, disabling extraction it until fixed
    payloadExtraction: false,
    renderJsonPayloads: true,
    typedPages: true,
  },

  compatibilityDate: '2024-08-14',

  // Vite配置
  vite: {
    define: {
      global: 'globalThis',
    },
  },

  eslint: {
    config: {
      standalone: false,
      nuxt: {
        sortConfigKeys: true,
      },
    },
  },

  pwa,
})
