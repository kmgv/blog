import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import tailwindcss from "@tailwindcss/vite";
import { metaClassTransformer } from "./src/lib/rehype-code-meta.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://nbit.blog",
  integrations: [sitemap(), mdx(), pagefind()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: "css-variables",
      transformers: [metaClassTransformer()],
    },
  },
});
