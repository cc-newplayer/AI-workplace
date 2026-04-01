// @ts-check
import { defineConfig } from 'astro/config';

// Replace with your actual GitHub Pages URL:
// https://<your-username>.github.io/<repo-name>
const SITE = process.env.SITE_URL || 'https://your-username.github.io';
const BASE = process.env.BASE_PATH || '/blog';

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
});
