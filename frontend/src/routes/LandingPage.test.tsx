import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import LandingPage from "./LandingPage";

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("LandingPage", () => {
  it("exibe a hero neo-brutalista e os CTAs principais", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /vá\. viva\. guarde\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /começar agora/i })).toHaveAttribute("href", "/register");
    expect(screen.getAllByRole("link", { name: /entrar/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /como funciona/i })).toHaveAttribute("href", "#como-funciona");
    expect(screen.getAllByRole("link", { name: /privacidade/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /criar meu diário/i })).toHaveAttribute("href", "/register");
  });

  it("organiza a landing em bandas editoriais com identidade do produto", () => {
    renderPage();

    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
    expect(screen.getByText("04")).toBeInTheDocument();
    expect(screen.getByAltText(/cartão de lugar com título, categoria, endereço, notas, foto e tags/i)).toBeInTheDocument();
    expect(screen.getByAltText(/mapa com rota marcada e cartão de lugar salvo/i)).toBeInTheDocument();
    expect(screen.getByAltText(/cartões de privacidade e compartilhamento de um lugar/i)).toBeInTheDocument();
    expect(screen.getByText(/privado por padrão/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /como salvar lugares que quero visitar/i, level: 3 })).toBeInTheDocument();
  });
});
