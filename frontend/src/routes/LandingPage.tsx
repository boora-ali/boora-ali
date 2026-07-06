import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "../components/ui/DarkModeToggle";
import { FeedbackButton } from "../components/feedback/FeedbackButton";

const trustPoints = [
  "Privado por padrão",
  "Sem feed obrigatório",
  "Feito para revisitar, não só descobrir",
];

const faq = [
  {
    question: "Isso é um mapa genérico?",
    answer:
      "Não. O foco é registrar os lugares que importam para você e deixar fácil voltar neles.",
  },
  {
    question: "Posso compartilhar um lugar específico?",
    answer:
      "Sim. Você pode gerar um link de share para um lugar sem expor toda a sua conta.",
  },
  {
    question: "O que fica público?",
    answer:
      "A landing é pública. O conteúdo do app continua controlado por autenticação e permissões.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

function SectionRail({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-row items-center gap-3 lg:w-[11rem] lg:flex-col lg:items-start lg:gap-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-[0.28em] text-primary">{number}</span>
        <span className="hidden h-px w-10 bg-border lg:block" />
      </div>
      <span className="text-xs uppercase tracking-[0.28em] text-muted">{label}</span>
    </div>
  );
}


function NotebookHeroGraphic() {
  return (
    <div className="relative mx-auto max-w-[31rem] rounded-[2rem] border border-border bg-surface p-4 shadow-[0_28px_70px_-34px_rgba(18,24,38,0.22)]">
      <img
        src="/landing-assets/hero-notebook.png"
        alt="Diário aberto com mapa, anotações e foto de um lugar salvo no Boora Ali"
        className="block h-auto w-full rounded-[1.5rem] border border-border"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

function PlaceNoteGraphic() {
  return (
    <div className="relative rounded-[2rem] border border-border bg-surface p-4 shadow-[0_22px_52px_-30px_rgba(18,24,38,0.2)]">
      <img
        src="/landing-assets/place-note.png"
        alt="Cartão de lugar com título, categoria, endereço, notas, foto e tags"
        className="block h-auto w-full rounded-[1.5rem] border border-border"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

function MapGraphic() {
  return (
    <div className="relative rounded-[2rem] border border-border bg-surface p-4 shadow-[0_22px_52px_-30px_rgba(18,24,38,0.2)]">
      <img
        src="/landing-assets/map-explore.png"
        alt="Mapa com rota marcada e cartão de lugar salvo"
        className="block h-auto w-full rounded-[1.5rem] border border-border"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

function PrivacyGraphic() {
  return (
    <div className="relative rounded-[2rem] border border-border bg-surface p-4 shadow-[0_22px_52px_-30px_rgba(18,24,38,0.2)]">
      <img
        src="/landing-assets/privacy-share.png"
        alt="Cartões de privacidade e compartilhamento de um lugar"
        className="block h-auto w-full rounded-[1.5rem] border border-border"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <Helmet>
        <title>Boora Ali — Diário pessoal de lugares</title>
        <meta
          name="description"
          content="Salve lugares, registre visitas e guarde o que vale lembrar em um diário pessoal de lugares."
        />
        <meta
          name="keywords"
          content="diário de lugares, lugares para visitar, salvar lugares, registrar visitas, mapa pessoal"
        />
        <link rel="canonical" href="https://booraali.com.br/" />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://booraali.com.br/" />
        <meta property="og:title" content="Boora Ali — Diário pessoal de lugares" />
        <meta
          property="og:description"
          content="Salve lugares, registre visitas e guarde o que vale lembrar em um diário pessoal de lugares."
        />
        <meta property="og:image" content="https://booraali.com.br/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Boora Ali" />
        <meta property="og:locale" content="pt_BR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Boora Ali — Diário pessoal de lugares" />
        <meta
          name="twitter:description"
          content="Salve lugares, registre visitas e guarde o que vale lembrar em um diário pessoal de lugares."
        />
        <meta name="twitter:image" content="https://booraali.com.br/og-image.png" />
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>

      <div className="relative isolate overflow-hidden bg-background text-text">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src="/bora-ali-mark.svg" alt="" className="h-10 w-10" />
            <div className="leading-tight">
              <p className="font-fraunces text-lg font-bold text-text">Boora Ali</p>
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-muted">Diário de lugares</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#como-funciona" className="text-sm text-muted transition hover:text-text">
              Como funciona
            </a>
            <a href="#exploracao" className="text-sm text-muted transition hover:text-text">
              Exploração
            </a>
            <a href="#privacidade" className="text-sm text-muted transition hover:text-text">
              Privacidade
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <DarkModeToggle />
            </div>
            <Button asChild variant="secondary" className="hidden sm:inline-flex">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/register">
                Começar agora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-7xl px-4 pt-4 sm:px-6 lg:hidden">
          <DarkModeToggle />
        </div>

        <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:pb-28 lg:pt-14">
          <section className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-7">
              <div className="space-y-4">
                <h1 className="max-w-2xl font-fraunces text-5xl font-bold leading-[0.92] tracking-tight text-[color:var(--color-text)] sm:text-6xl lg:text-7xl">
                  Guarde lugares, visitas e experiências que valem lembrar.
                </h1>
                <p className="max-w-xl text-base leading-8 text-muted sm:text-lg">
                  O Boora Ali é seu diário pessoal de lugares. Salve endereços, registre visitas,
                  mantenha notas, fotos e contexto de cada parada, e volte ao que fez sentido com mais rapidez.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/register">
                    Começar grátis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/login">Já tenho conta</Link>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-sm text-muted">
                {trustPoints.map((point) => (
                  <span key={point} className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {point}
                  </span>
                ))}
              </div>
            </div>

            <NotebookHeroGraphic />
          </section>

          <section id="como-funciona" className="mt-20 scroll-mt-28 border-t border-border pt-10">
            <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
              <SectionRail number="01" label="Guardar" />
              <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                <div className="space-y-5">
                  <h2 className="max-w-xl font-fraunces text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">
                    Guarde do seu jeito.
                  </h2>
                  <p className="max-w-xl text-base leading-7 text-muted sm:text-lg">
                    Salve um lugar com o essencial e o que faz sentido para você. Notas, fotos, tags
                    e observações ajudam você a lembrar depois.
                  </p>
                  <div className="space-y-3 text-sm text-muted">
                    {[
                      "Nome, categoria, endereço e notas",
                      "Fotos e links úteis",
                      "Tags personalizadas",
                      "Marque como favorito",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <PlaceNoteGraphic />
              </div>
            </div>
          </section>

          <section id="exploracao" className="mt-20 border-t border-border pt-10">
            <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
              <SectionRail number="02" label="Explorar" />
              <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                <MapGraphic />
                <div className="space-y-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Compass className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                      Exploração
                    </p>
                  </div>
                  <h2 className="max-w-xl font-fraunces text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">
                    Encontre na hora certa.
                  </h2>
                  <p className="max-w-xl text-base leading-7 text-muted sm:text-lg">
                    Use o mapa e a busca para voltar a um lugar ou descobrir o próximo destino com
                    rapidez.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Busca inteligente", "Encontre por nome, categoria ou palavra da nota."],
                      ["Mapa com contexto", "Veja seus lugares salvos e planeje seus caminhos."],
                      ["Revise com facilidade", "Notas e fotos ajudam você a lembrar do que fez sentido."],
                      ["Decida o próximo passo", "Do que já marcou, para o que ainda quer conhecer."],
                    ].map(([title, desc]) => (
                      <div key={title} className="space-y-1 border-t border-border pt-3">
                        <p className="text-sm font-medium text-[color:var(--color-text)]">{title}</p>
                        <p className="text-sm leading-6 text-muted">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="privacidade" className="mt-20 border-t border-border pt-10">
            <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
              <SectionRail number="03" label="Privacidade" />
              <div className="grid gap-8 lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
                <div className="space-y-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Privacidade
                  </p>
                  <h2 className="max-w-xl font-fraunces text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">
                    Seu diário, sob seu controle.
                  </h2>
                  <p className="max-w-xl text-base leading-7 text-muted sm:text-lg">
                    Privado por padrão. Você decide o que entra, o que fica visível e com quem
                    compartilhar.
                  </p>
                  <div className="space-y-3 text-sm text-muted">
                    {[
                      "Conteúdo pessoal protegido por conta",
                      "Compartilhamento por link para um lugar específico",
                      "Interface clara para decidir o que entra e o que fica guardado",
                      "Acesso seguro e permissões sob seu controle",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <PrivacyGraphic />
              </div>
            </div>
          </section>

          <section className="mt-20 border-t border-border pt-10">
            <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
              <SectionRail number="04" label="Perguntas" />
              <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-[0_18px_50px_rgba(26,18,8,0.05)] sm:p-8">
                <div className="max-w-2xl">
                  <h2 className="font-fraunces text-3xl font-bold tracking-tight text-[color:var(--color-text)]">
                    O básico que vale deixar claro antes de entrar.
                  </h2>
                </div>
                <div className="mt-8 grid gap-4 md:grid-cols-3 md:divide-x md:divide-border">
                  {faq.map((item) => (
                    <div key={item.question} className="space-y-3 md:px-4 first:pl-0 last:pr-0">
                      <p className="text-base font-semibold text-[color:var(--color-text)]">{item.question}</p>
                      <p className="text-sm leading-7 text-muted">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-border/70 bg-background/80">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-fraunces text-xl font-bold text-[color:var(--color-text)]">Boora Ali</p>
              <p className="text-sm text-muted">
                O diário pessoal dos lugares que você quer conhecer, visitou e quer lembrar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
              <FeedbackButton />
              <Link to="/login" className="transition hover:text-text">
                Entrar
              </Link>
              <Link to="/register" className="transition hover:text-text">
                Criar conta
              </Link>
              <Link to="/termos-de-uso" className="transition hover:text-text">
                Termos
              </Link>
              <Link to="/politica-de-privacidade" className="transition hover:text-text">
                Privacidade
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
