import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Creative Writer",
  description: "An Obsidian plugin for creative writing: Zen Mode, typewriter scrolling, focus fade, paragraph rhythm, offline style checks, a writing desk, and a story map.",
  base: "/creative-writer/",
  lang: "en-GB",
  lastUpdated: true,
  cleanUrls: true,
  srcExclude: ["QA-Rhythm-Sample.md"],
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/creative-writer/favicon.svg" }]],
  themeConfig: {
    logo: "/favicon.svg",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/commands" },
      { text: "Development", link: "/development/architecture" },
      { text: "GitHub", link: "https://github.com/amancioandre/creative-writer" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Start",
          items: [
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Where it runs", link: "/guide/where-it-runs" },
          ],
        },
        {
          text: "In the editor",
          items: [
            { text: "Zen Mode & focus", link: "/guide/editor" },
            { text: "Paragraph rhythm", link: "/guide/rhythm" },
            { text: "Style checks", link: "/guide/style-checks" },
            { text: "Readability", link: "/guide/readability" },
          ],
        },
        {
          text: "About the work",
          items: [
            { text: "Writing desk & goals", link: "/guide/writing-desk" },
            { text: "Projects", link: "/guide/projects" },
            { text: "Structuring a project", link: "/guide/story-projects" },
          ],
        },
        {
          text: "The story",
          items: [
            { text: "Story map", link: "/guide/story-map" },
            { text: "Story timeline", link: "/guide/story-timeline" },
            { text: "Story threads", link: "/guide/story-threads" },
            { text: "Manuscript", link: "/guide/manuscript" },
          ],
        },
        {
          text: "Models",
          items: [
            { text: "Model assistant", link: "/guide/model-assistant" },
            { text: "Myth & archetype", link: "/guide/myth" },
            { text: "Reading a project", link: "/guide/model-reading" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "Commands", link: "/reference/commands" },
            { text: "Settings", link: "/reference/settings" },
            { text: "Front matter", link: "/reference/front-matter" },
            { text: "Files & sync", link: "/reference/data-and-sync" },
            { text: "Harper companion", link: "/reference/harper" },
            { text: "FAQ & troubleshooting", link: "/reference/faq" },
          ],
        },
      ],
      "/development/": [
        {
          text: "Development",
          items: [
            { text: "Architecture", link: "/development/architecture" },
            { text: "Testing & evaluation", link: "/development/testing" },
            { text: "Publishing", link: "/development/publishing" },
            { text: "Roadmap", link: "/development/roadmap" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/amancioandre/creative-writer" }],
    search: { provider: "local" },
    editLink: { pattern: "https://github.com/amancioandre/creative-writer/edit/main/docs/:path", text: "Edit this page" },
    footer: { message: "MIT licensed. Concreteness norms CC-BY (Brysbaert et al.).", copyright: "© André Amnc" },
    outline: [2, 3],
  },
});
