import { defineConfig } from 'astro/config';

// https://astro.build/config
import vercel from "@astrojs/vercel";

// https://astro.build/config
import preact from "@astrojs/preact";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [preact()],

  vite: {
    plugins: [tailwindcss()]
  }
});
