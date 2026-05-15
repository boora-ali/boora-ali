import { defineConfig } from "aeo.js";

export default defineConfig({
  title: "Bora Ali",
  url: "https://booraali.com.br",
  description:
    "Diário pessoal de lugares — registre lugares, visitas e pratos que valem lembrar",

  pages: [
    {
      pathname: "/",
      title: "Bora Ali — Entre na sua conta",
      description: "Acesse seu diário de lugares e experiências. Salve e reviva memórias dos lugares que você visitou.",
    },
    {
      pathname: "/register",
      title: "Bora Ali — Crie sua conta",
      description: "Comece a registrar seus lugares favoritos gratuitamente. Crie sua conta no Bora Ali.",
    },
    {
      pathname: "/politica-de-privacidade",
      title: "Política de Privacidade — Bora Ali",
      description: "Saiba como o Bora Ali coleta, usa e protege seus dados pessoais.",
    },
    {
      pathname: "/termos-de-uso",
      title: "Termos de Uso — Bora Ali",
      description: "Leia os termos e condições de uso do Bora Ali.",
    },
  ],

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
