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
  it("exibe a proposta pública e os CTAs principais", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /guarde os lugares que valem lembrar/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /começar grátis/i })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /já tenho conta/i })).toHaveAttribute("href", "/login");
    expect(screen.getAllByRole("link", { name: /entrar/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /como funciona/i })).toHaveAttribute("href", "#como-funciona");
    expect(screen.getAllByRole("link", { name: /privacidade/i }).length).toBeGreaterThan(0);
  });

  it("organiza a landing em bandas editoriais com identidade do produto", () => {
    renderPage();

    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
    expect(screen.getByText("04")).toBeInTheDocument();
    expect(screen.getByText(/largo da batata/i)).toBeInTheDocument();
    expect(screen.getByText(/livraria da vila/i)).toBeInTheDocument();
    expect(screen.getAllByText(/privado por padrão/i).length).toBeGreaterThan(1);
  });
});
