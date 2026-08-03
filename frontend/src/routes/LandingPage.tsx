import { Helmet } from "react-helmet-async";
import { Link } from "react-router";
import { NeoBrutalistHero } from "../components/landing/NeoBrutalistHero";
import { DarkModeToggle } from "../components/ui/DarkModeToggle";
import "./LandingPage.css";

const landingTitle = "Diário de lugares para salvar visitas, notas e fotos | Boora Ali";
const landingDescription =
  "Crie seu diário de lugares: salve endereços, registre visitas, notas e fotos. Organize o que quer conhecer e relembre o que já visitou.";

const faq = [
  {
    question: "Como salvar lugares que quero visitar?",
    answer: "Crie um lugar com nome, categoria, endereço e as anotações que ajudam você a escolher quando voltar.",
  },
  {
    question: "Posso registrar uma visita com notas e fotos?",
    answer: "Sim. Registre a visita e guarde notas, fotos e o contexto que vale lembrar sobre aquele lugar.",
  },
  {
    question: "Meu diário de lugares é privado?",
    answer: "Sim. Seus lugares ficam protegidos por conta e você decide o que quer compartilhar.",
  },
  {
    question: "Como compartilhar um lugar específico?",
    answer: "Gere um link de compartilhamento para um lugar sem expor toda a sua conta ou seu diário.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

function SectionNumber({ number, label }: { number: string; label: string }) {
  return (
    <div className="landing-section-number" aria-hidden="true">
      <span>{number}</span>
      <span>{label}</span>
    </div>
  );
}

function LandingImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="landing-image-frame">
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <Helmet>
        <title>{landingTitle}</title>
        <meta name="description" content={landingDescription} />
        <link rel="canonical" href="https://booraali.com.br/" />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://booraali.com.br/" />
        <meta property="og:title" content={landingTitle} />
        <meta property="og:description" content={landingDescription} />
        <meta property="og:image" content="https://booraali.com.br/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Boora Ali" />
        <meta property="og:locale" content="pt_BR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={landingTitle} />
        <meta name="twitter:description" content={landingDescription} />
        <meta name="twitter:image" content="https://booraali.com.br/og-image.png" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <div className="landing-page">
        <header className="landing-nav">
          <Link to="/" className="landing-brand">
            <img src="/bora-ali-mark.svg" alt="" />
            <span>BOORA ALI</span>
          </Link>
          <nav aria-label="Navegação principal">
            <a href="#como-funciona">COMO FUNCIONA</a>
            <a href="#exploracao">EXPLORAR</a>
            <a href="#privacidade">PRIVACIDADE</a>
          </nav>
          <div className="landing-nav-actions">
            <div className="landing-theme-toggle">
              <DarkModeToggle />
            </div>
            <Link to="/login">ENTRAR</Link>
            <Link to="/register" className="landing-nav-cta">CRIAR MEU DIÁRIO</Link>
          </div>
        </header>

        <NeoBrutalistHero />

        <main>
          <section id="como-funciona" className="landing-section landing-section--ink">
            <SectionNumber number="01" label="GUARDAR" />
            <div className="landing-section-content">
              <div className="landing-copy-block">
                <h2>Guarde do seu jeito.</h2>
                <p>Salve um lugar com o essencial e o que faz sentido para você. Notas, fotos, tags e observações ajudam você a lembrar depois.</p>
                <ul>
                  <li>Nome, categoria, endereço e notas</li>
                  <li>Fotos e links úteis</li>
                  <li>Tags personalizadas</li>
                  <li>Marque como favorito</li>
                </ul>
              </div>
              <LandingImage
                src="/landing-assets/place-note.png"
                alt="Cartão de lugar com título, categoria, endereço, notas, foto e tags"
              />
            </div>
          </section>

          <section id="exploracao" className="landing-section landing-section--action">
            <SectionNumber number="02" label="EXPLORAR" />
            <div className="landing-section-content landing-section-content--reverse">
              <LandingImage src="/landing-assets/map-explore.png" alt="Mapa com rota marcada e cartão de lugar salvo" />
              <div className="landing-copy-block">
                <h2>Encontre na hora certa.</h2>
                <p>Use o mapa e a busca para voltar a um lugar ou descobrir o próximo destino com rapidez.</p>
                <dl className="landing-fact-grid">
                  <div><dt>BUSCA INTELIGENTE</dt><dd>Encontre por nome, categoria ou palavra da nota.</dd></div>
                  <div><dt>MAPA COM CONTEXTO</dt><dd>Veja seus lugares salvos e planeje seus caminhos.</dd></div>
                  <div><dt>REVISE COM FACILIDADE</dt><dd>Notas e fotos ajudam você a lembrar do que fez sentido.</dd></div>
                  <div><dt>DECIDA O PRÓXIMO PASSO</dt><dd>Do que já marcou, para o que ainda quer conhecer.</dd></div>
                </dl>
              </div>
            </div>
          </section>

          <section id="privacidade" className="landing-section landing-section--paper">
            <SectionNumber number="03" label="PRIVACIDADE" />
            <div className="landing-section-content">
              <div className="landing-copy-block">
                <h2>Seu diário, sob seu controle.</h2>
                <p>Privado por padrão. Você decide o que entra, o que fica visível e com quem compartilhar.</p>
                <ul>
                  <li>Conteúdo pessoal protegido por conta</li>
                  <li>Compartilhamento por link para um lugar específico</li>
                  <li>Interface clara para decidir o que entra e o que fica guardado</li>
                  <li>Acesso seguro e permissões sob seu controle</li>
                </ul>
              </div>
              <LandingImage
                src="/landing-assets/privacy-share.png"
                alt="Cartões de privacidade e compartilhamento de um lugar"
              />
            </div>
          </section>

          <section className="landing-section landing-section--faq">
            <SectionNumber number="04" label="PERGUNTAS" />
            <div className="landing-section-content">
              <div className="landing-copy-block">
                <h2>Perguntas sem enrolação.</h2>
              </div>
              <div className="landing-faq-list">
                {faq.map((item) => (
                  <article key={item.question}>
                    <h3>{item.question}</h3>
                    <p>{item.answer}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer className="landing-footer">
          <p>BOORA ALI, O DIÁRIO DOS LUGARES QUE VALEM VOLTAR.</p>
          <div>
            <Link to="/login">ENTRAR</Link>
            <Link to="/register">CRIAR CONTA</Link>
            <Link to="/termos-de-uso">TERMOS</Link>
            <Link to="/politica-de-privacidade">PRIVACIDADE</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
