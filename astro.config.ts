import { defineConfig, envField, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { SITE } from "./src/config";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  i18n: {
    defaultLocale: "zh-cn",
    locales: ["zh-cn", "en"],
    fallback: {
      en: "zh-cn",
    },
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
      fallbackType: "redirect",
    },
  },
  integrations: [
    sitemap({
      filter: page => SITE.showArchives || !page.endsWith("/archives"),
    }),
  ],
  markdown: {
    remarkPlugins: [
      remarkMath,
      remarkToc,
      [remarkCollapse, { test: "Table of contents" }],
    ],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    // eslint-disable-next-line
    // @ts-ignore
    // This will be fixed in Astro 6 with Vite 7 support
    // See: https://github.com/withastro/astro/issues/14030
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  env: {
    schema: {
      PUBLIC_SITE_URL: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: "LXGW WenKai Mono",
      cssVariable: "--font-lxgw-wenkai-mono",
      options: {
        variants: [
          {
            weight: 300,
            style: "normal",
            src: ["./public/fonts/LXGWWenKaiMono-Light.ttf"],
          },
          {
            weight: 400,
            style: "normal",
            src: ["./public/fonts/LXGWWenKaiMono-Regular.ttf"],
          },
          {
            weight: 500,
            style: "normal",
            src: ["./public/fonts/LXGWWenKaiMono-Medium.ttf"],
          },
        ],
      },
      fallbacks: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      display: "optional",
      subsets: ["latin"],
    },
  ],
});
