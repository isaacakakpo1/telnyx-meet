// Nuxt 3 replaces the previous Next.js shell. The legacy Next.js/React
// sources remain in the tree only until their dedicated migration packages
// port them; they are excluded from Nuxt's page/component discovery here.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/styles/globals.css'],

  app: {
    head: {
      htmlAttrs: {
        lang: 'en-US',
      },
      title: 'Video Room',
      meta: [
        {
          name: 'description',
          content: 'Telnyx Meet application to make conferences',
        },
        {
          name: 'theme-color',
          content: '#7D4CDB',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/favicon.ico' },
        { rel: 'manifest', href: '/manifest.json' },
      ],
    },
  },

  runtimeConfig: {
    // Server-only Telnyx credentials. These keys are private by default and
    // are never serialized into the client payload.
    telnxApiKey: process.env.TELNYX_API_KEY || '',
    telnxApiHost: process.env.TELNYX_API_HOST || 'https://api.telnyx.com/v2',
    telnxCallControlApiHost:
      process.env.TELNYX_CALL_CONTROL_API_HOST ||
      'https://api.telnyx.com/v2',
    bugsnagApiKey: process.env.BUGSNAG_API_KEY || '',
    public: {
      bugsnagApiKey:
        process.env.NUXT_PUBLIC_BUGSNAG_API_KEY ||
        process.env.NEXT_PUBLIC_BUGSNAG_API_KEY ||
        '',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  // Only Vue SFCs are Nuxt components/pages in the new shell. The .ts/.tsx
  // files left behind by the Next.js application are handled by later
  // migration packages and must not be treated as Nuxt routes.
  components: {
    dirs: [{ path: '~/components', extensions: ['vue'] }],
  },
  ignore: [
    'pages/**/*.ts',
    'pages/**/*.tsx',
    'components/**/*.ts',
    'components/**/*.tsx',
    'next-env.d.ts',
  ],
});
