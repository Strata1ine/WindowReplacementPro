import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://windowreplacement.pro',
  output: 'static',
  integrations: [sitemap({
    filter: (page) => !['/guides/', '/locations/'].includes(new URL(page).pathname)
  })],
  trailingSlash: 'always',
  build: {
    format: 'directory'
  }
});
