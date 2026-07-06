import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Footer } from "../components/layout/Footer";

export default function PrivacyPolicyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Política de Privacidade — Boora Ali</title>
        <meta name="description" content="Saiba como o Boora Ali coleta, usa e protege seus dados pessoais." />
        <link rel="canonical" href="https://booraali.com.br/politica-de-privacidade" />
      </Helmet>
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
            <h2 className="text-lg font-semibold text-text mb-3">1. Sobre o Boora Ali</h2>
            <p>
              O <strong>Boora Ali</strong> é um diário gastronômico pessoal que permite registrar e
              organizar lugares, visitas, avaliações e consumíveis — como refeições, bebidas e
              petiscos — de uso exclusivamente pessoal. Este documento descreve como tratamos os
              dados dos usuários da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">{t("privacy.lgpd.categories.title")}</h2>
            <p className="mb-2">{t("privacy.lgpd.categories.intro")}</p>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li><strong>{t("privacy.lgpd.categories.account.label")}:</strong> {t("privacy.lgpd.categories.account.detail")}</li>
              <li><strong>{t("privacy.lgpd.categories.profile.label")}:</strong> {t("privacy.lgpd.categories.profile.detail")}</li>
              <li><strong>{t("privacy.lgpd.categories.content.label")}:</strong> {t("privacy.lgpd.categories.content.detail")}</li>
              <li><strong>{t("privacy.lgpd.categories.technical.label")}:</strong> {t("privacy.lgpd.categories.technical.detail")}</li>
              <li><strong>{t("privacy.lgpd.categories.consent.label")}:</strong> {t("privacy.lgpd.categories.consent.detail")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">{t("privacy.lgpd.operators.title")}</h2>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li><strong>{t("privacy.lgpd.operators.cloudflare.label")}:</strong> {t("privacy.lgpd.operators.cloudflare.detail")}</li>
              <li><strong>{t("privacy.lgpd.operators.r2.label")}:</strong> {t("privacy.lgpd.operators.r2.detail")}</li>
              <li><strong>{t("privacy.lgpd.operators.resend.label")}:</strong> {t("privacy.lgpd.operators.resend.detail")}</li>
              <li><strong>{t("privacy.lgpd.operators.google.label")}:</strong> {t("privacy.lgpd.operators.google.detail")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">{t("privacy.lgpd.retention.title")}</h2>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li>{t("privacy.lgpd.retention.account")}</li>
              <li>{t("privacy.lgpd.retention.content")}</li>
              <li>{t("privacy.lgpd.retention.technical")}</li>
              <li>{t("privacy.lgpd.retention.consent")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">{t("privacy.lgpd.rights.title")}</h2>
            <p className="mb-2">{t("privacy.lgpd.rights.intro")}</p>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2">
              <li>{t("privacy.lgpd.rights.editProfile")}</li>
              <li>{t("privacy.lgpd.rights.exportData")}</li>
              <li>{t("privacy.lgpd.rights.withdrawConsent")}</li>
              <li>{t("privacy.lgpd.rights.deleteAccount")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">6. Armazenamento e segurança</h2>
            <p>
              Os dados são armazenados em servidores na Europa (Contabo VPS, Alemanha). Adotamos
              práticas de segurança como criptografia em trânsito (HTTPS/TLS), hashing de senhas
              com Argon2, tokens JWT com expiração curta e controles de acesso por função.
            </p>
            <ul className="list-disc list-inside space-y-1 text-text/80 ml-2 mt-3">
              <li>Conta ativa: enquanto a conta estiver ativa.</li>
              <li>Conta solicitada para exclusão: 7 dias de graça antes da exclusão permanente.</li>
              <li>Registros de consentimento: mantidos enquanto necessário para prova e auditoria.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">7. Exercício de direitos</h2>
            <p className="mb-2">
              Para pedidos e reclamações, use o e-mail do encarregado ou o canal público da ANPD em{" "}
              <a href="https://www.gov.br/anpd" className="text-primary hover:underline">
                gov.br/anpd
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">8. Cookies e armazenamento local</h2>
            <p>
              Utilizamos <em>localStorage</em> do navegador para manter sua sessão autenticada e
              preferências de idioma e tema. Não utilizamos cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text mb-3">9. Contato</h2>
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
