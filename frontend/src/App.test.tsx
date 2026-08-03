import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("mostra a landing pública na rota raiz", async () => {
    window.history.pushState({}, "", "/");

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /seu diário de lugares para guardar visitas e experiências/i,
      }),
    ).toBeInTheDocument();
  });
});
