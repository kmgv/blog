import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import tailwindcss from "@tailwindcss/vite";
import umami from "@yeskunall/astro-umami";

// https://astro.build/config
export default defineConfig({
  site: "https://nbit.it",
  integrations: [
    sitemap(),
    mdx(),
    pagefind(),
    umami({ id: "72bce35c-6e17-40ce-9e80-d6224b77445e", endpointUrl: "https://trk2.nbit.blog" })],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: "css-variables",
    },
  },
});