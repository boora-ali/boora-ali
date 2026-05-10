import { Link } from "react-router-dom";
import { Footer } from "../components/layout/Footer";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link to="/login" className="text-sm text-muted hover:text-text transition-colors">
            ← Voltar
          </Link>
        </div>

        <h1 className="font-fraunces text-3xl font-bold text-text mb-2">
          Política de Privacidade
        </h1>
        <p className="text-sm text-muted mb-8">Última atualização: maio de 2026</p>

        <div className="space-y-8 text-text/90 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-text mb-3">1. Sobre o Bora Ali</h2>
            <p>
              O <strong>Bora Ali</strong> é um diário gastronômico pessoal que permite registrar e
              organizar lugares, visitas, avaliações e consumíveis — como refeições, bebidas e
              petiscos — de uso exclusivamente pessoal. Este documento descreve como tratamos os
              dados dos usuários da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">2. Dados coletados</h2>
            <p className="mb-2">Coletamos apenas os dados necessários para o funcionamento do serviço:</p>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li><strong>Conta:</strong> nome de usuário, e-mail e senha (armazenada com hash seguro).</li>
              <li><strong>Perfil:</strong> nome de exibição, apelido e foto de perfil (opcional).</li>
              <li><strong>Conteúdo:</strong> lugares, visitas, avaliações, fotos e notas que você registrar.</li>
              <li><strong>Dados técnicos:</strong> endereço IP (para proteção contra bots via Cloudflare Turnstile) e logs de acesso padrão.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">3. Como usamos seus dados</h2>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li>Criar e autenticar sua conta.</li>
              <li>Exibir e organizar o seu diário gastronômico.</li>
              <li>Processar coordenadas geográficas de URLs do Google Maps que você inserir.</li>
              <li>Enviar e-mails transacionais quando necessário (ex.: recuperação de senha).</li>
              <li>Proteger o serviço contra abusos e acessos automatizados.</li>
            </ul>
            <p className="mt-3">
              Não usamos seus dados para publicidade, não os vendemos e não os compartilhamos com terceiros,
              exceto pelos serviços de infraestrutura listados abaixo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">4. Serviços de terceiros</h2>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li><strong>Cloudflare:</strong> CDN, proteção DDoS e verificação anti-bot (Turnstile). Os IPs são processados pela Cloudflare conforme sua política de privacidade.</li>
              <li><strong>Cloudflare R2:</strong> armazenamento de fotos de perfil e imagens de lugares e visitas.</li>
              <li><strong>Google OAuth:</strong> login social opcional. Recebemos apenas seu nome, e-mail e foto do Google, sem acesso a outros dados da sua conta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">5. Armazenamento e segurança</h2>
            <p>
              Os dados são armazenados em servidores na Europa (Contabo VPS, Alemanha). Adotamos
              práticas de segurança como criptografia em trânsito (HTTPS/TLS), hashing de senhas
              com Argon2, tokens JWT com expiração curta e controles de acesso por função.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">6. Seus direitos</h2>
            <p className="mb-2">Você pode, a qualquer momento:</p>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li>Acessar e corrigir seus dados pessoais nas configurações da conta.</li>
              <li>Excluir conteúdos (lugares, visitas, fotos) diretamente pela plataforma.</li>
              <li>Solicitar a exclusão completa da sua conta e dados por e-mail.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">7. Cookies e armazenamento local</h2>
            <p>
              Utilizamos <em>localStorage</em> do navegador para manter sua sessão autenticada e
              preferências de idioma e tema. Não utilizamos cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">8. Contato</h2>
            <p>
              Para dúvidas, solicitações ou exercício dos seus direitos, entre em contato pelo e-mail:{" "}
              <a
                href="mailto:samuelviana.dev@gmail.com"
                className="text-primary hover:underline"
              >
                samuelviana.dev@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}

