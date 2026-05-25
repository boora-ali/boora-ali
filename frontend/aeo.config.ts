import { defineConfig } from "aeo.js";

export default defineConfig({
  title: "Boora Ali",
  url: "https://booraali.com.br",
  description:
    "Diário pessoal de lugares — registre lugares, visitas e experiências que valem lembrar",

  pages: [
    {
      pathname: "/",
      title: "Boora Ali — Diário pessoal de lugares",
      description:
        "Salve lugares, registre visitas e guarde o que vale lembrar em um diário pessoal de lugares.",
    },
    {
      pathname: "/register",
      title: "Boora Ali — Crie sua conta",
      description: "Comece a registrar seus lugares favoritos gratuitamente. Crie sua conta no Boora Ali.",
    },
    {
      pathname: "/politica-de-privacidade",
      title: "Política de Privacidade — Boora Ali",
      description: "Saiba como o Boora Ali coleta, usa e protege seus dados pessoais.",
    },
    {
      pathname: "/termos-de-uso",
      title: "Termos de Uso — Boora Ali",
      description: "Leia os termos e condições de uso do Boora Ali.",
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
