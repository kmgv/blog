import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import tailwindcss from "@tailwindcss/vite";
import { metaClassTransformer } from "./src/lib/rehype-code-meta.mjs";
import jopSoftwarecookieconsent from "@jop-software/astro-cookieconsent";

// https://astro.build/config
export default defineConfig({
  site: "https://nbit.blog",
  integrations: [
    sitemap(),
    mdx(),
    pagefind(),
    jopSoftwarecookieconsent({
      categories: {
        necessary: {
          enabled: true,
          readOnly: true,
        },
        analytics: {},
      },
      language: {
        default: "en",
        translations: {
          en: {
            consentModal: {
              title: "We use cookies",
              description:
                "We use cookies to enhance your browsing experience and analyze site traffic.",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
              showPreferencesBtn: "Manage preferences",
            },
            preferencesModal: {
              title: "Cookie preferences",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
              savePreferencesBtn: "Save preferences",
              sections: [
                {
                  title: "Necessary cookies",
                  description:
                    "These cookies are essential for the website to function properly.",
                  linkedCategory: "necessary",
                },
                {
                  title: "Analytics cookies",
                  description:
                    "These cookies help us understand how visitors interact with the website.",
                  linkedCategory: "analytics",
                },
              ],
            },
          },
        },
      },
    }),
  ],
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