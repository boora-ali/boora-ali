import { Link } from "react-router-dom";
import { Footer } from "../components/layout/Footer";

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link to="/login" className="text-sm text-muted hover:text-text transition-colors">
            ← Voltar
          </Link>
        </div>

        <h1 className="font-fraunces text-3xl font-bold text-text mb-2">
          Termos de Uso
        </h1>
        <p className="text-sm text-muted mb-8">Última atualização: maio de 2026</p>

        <div className="space-y-8 text-text/90 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-text mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao criar uma conta no <strong>Bora Ali</strong>, você concorda com estes Termos de Uso
              e com nossa{" "}
              <Link to="/politica-de-privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              . Se não concordar, não utilize o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">2. O que é o Bora Ali</h2>
            <p>
              O Bora Ali é uma plataforma de uso pessoal para registro de experiências
              gastronômicas — restaurantes, bares, cafeterias, padarias e outros estabelecimentos.
              Você pode registrar lugares, visitas, avaliações de ambiente e atendimento, consumíveis
              (pratos, bebidas, doces etc.) com preços e notas, além de fotos e localização geográfica.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">3. Cadastro e conta</h2>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li>Você deve ter pelo menos 13 anos para criar uma conta.</li>
              <li>As informações de cadastro devem ser verdadeiras e atualizadas.</li>
              <li>Você é responsável por manter a segurança da sua senha e por todas as atividades realizadas na sua conta.</li>
              <li>Em caso de uso não autorizado da sua conta, notifique-nos imediatamente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">4. Uso permitido</h2>
            <p className="mb-2">Você pode usar o Bora Ali para:</p>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li>Registrar e organizar suas experiências gastronômicas pessoais.</li>
              <li>Fazer upload de fotos dos lugares e pratos que você consumiu.</li>
              <li>Avaliar e anotar suas impressões sobre estabelecimentos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">5. Uso proibido</h2>
            <p className="mb-2">É vedado:</p>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li>Usar o serviço para fins comerciais sem autorização prévia por escrito.</li>
              <li>Fazer upload de conteúdo ilegal, ofensivo, difamatório ou que viole direitos de terceiros.</li>
              <li>Tentar acessar dados de outros usuários ou sistemas internos da plataforma.</li>
              <li>Utilizar bots, scrapers ou automações para interagir com o serviço.</li>
              <li>Compartilhar credenciais de acesso com terceiros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">6. Conteúdo do usuário</h2>
            <p>
              Todo conteúdo que você inserir (textos, avaliações, fotos, localizações) permanece
              de sua propriedade. Ao fazer upload, você nos concede uma licença limitada e não
              exclusiva para armazenar e exibir esse conteúdo exclusivamente para você, dentro da
              plataforma. Não compartilhamos seu conteúdo com outros usuários ou publicamente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">7. Disponibilidade do serviço</h2>
            <p>
              O Bora Ali é oferecido como está, sem garantia de disponibilidade contínua. Podemos
              realizar manutenções, atualizações ou encerrar o serviço com aviso prévio razoável.
              Recomendamos exportar seus dados periodicamente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">8. Encerramento de conta</h2>
            <p>
              Você pode solicitar a exclusão da sua conta a qualquer momento pelo e-mail de contato.
              Reservamo-nos o direito de suspender contas que violem estes termos, sem aviso prévio
              em casos de violações graves.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">9. Limitação de responsabilidade</h2>
            <p>
              O Bora Ali não se responsabiliza por perdas de dados decorrentes de falhas técnicas,
              nem pela precisão de informações de estabelecimentos cadastrados pelos usuários. As
              avaliações e notas são de caráter pessoal e subjetivo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">10. Alterações nos Termos</h2>
            <p>
              Podemos atualizar estes Termos periodicamente. Comunicaremos alterações relevantes
              por e-mail ou notificação na plataforma. O uso continuado do serviço após as
              alterações implica na aceitação dos novos Termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">11. Contato</h2>
            <p>
              Dúvidas sobre estes Termos? Entre em contato:{" "}
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
