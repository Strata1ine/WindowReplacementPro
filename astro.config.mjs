import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://windowreplacement.pro',
  output: 'static',
  publicDir: './public-site',
  integrations: [sitemap({
    filter: (page) => new URL(page).pathname !== '/locations/'
  })],
  trailingSlash: 'always',
  build: {
    format: 'directory'
  }
});
