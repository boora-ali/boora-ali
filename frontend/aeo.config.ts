import { defineConfig } from "aeo.js";

export default defineConfig({
  title: "Bora Ali",
  url: "https://booraali.com.br",
  description:
    "Diário pessoal de lugares — registre lugares, visitas e pratos que valem lembrar",

  generators: {
    robotsTxt: false, // já existe um robots.txt customizado em public/
    llmsTxt: true,
    llmsFullTxt: true,
    rawMarkdown: false,
    sitemap: true,
    aiIndex: true,
    schema: true,
  },

  schema: {
    enabled: true,
    organization: { name: "boora-ali", url: "https://booraali.com.br" },
    defaultType: "WebApplication",
  },

  og: {
    enabled: false,
  },

  widget: {
    enabled: false,
  },
});
