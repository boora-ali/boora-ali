import { fireEvent, render, screen } from "@testing-library/react";
import { ImageWithSpinner } from "./ImageWithSpinner";

test("renders fallback when src is missing", () => {
  render(
    <ImageWithSpinner
      alt="Foto"
      fallback={<div>Sem imagem</div>}
    />,
  );

  expect(screen.getByText("Sem imagem")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("shows spinner while the image loads", () => {
  render(
    <ImageWithSpinner
      src="https://example.com/photo.jpg"
      alt="Foto"
      fallback={<div>Sem imagem</div>}
    />,
  );

  expect(screen.getByRole("status", { name: "Carregando imagem" })).toBeInTheDocument();
  fireEvent.load(screen.getByRole("img", { name: "Foto" }));
  expect(screen.queryByRole("status", { name: "Carregando imagem" })).not.toBeInTheDocument();
});
