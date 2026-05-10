import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { PlaceForm } from "./PlaceForm";

test("requires name before submitting", async () => {
  const onSubmit = vi.fn();
  render(<PlaceForm onSubmit={onSubmit} />);

  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  await waitFor(() => {
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });
  expect(onSubmit).not.toHaveBeenCalled();
});

test("shows backend character limits for place text fields", () => {
  render(<PlaceForm onSubmit={async () => {}} />);

  expect(screen.getAllByText("0/200")).toHaveLength(2);
  expect(screen.getByText("0/100")).toBeInTheDocument();
  expect(screen.getByText("0/300")).toBeInTheDocument();
  expect(screen.getByText("0/2000")).toBeInTheDocument();
  expect(screen.getByText("0/5000")).toBeInTheDocument();
});

test("accepts short Google Maps URLs and clears manual coordinates", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const shortUrl = "https://maps.app.goo.gl/KaeiRuA7EwybcJCu7";

  render(
    <PlaceForm
      initial={{
        name: "Casa monsenhor",
        maps_url: shortUrl,
        latitude: "-3.10",
        longitude: "-60.02",
      }}
      onSubmit={onSubmit}
    />,
  );

  fireEvent.click(screen.getByTitle(/Maps/i));
  expect(screen.queryByText(/coordenadas não encontradas/i)).not.toBeInTheDocument();

  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalled();
  });

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      maps_url: shortUrl,
      latitude: undefined,
      longitude: undefined,
    }),
  );
});

test("changing the maps url to a short Google Maps link clears old coordinates", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const shortUrl = "https://maps.app.goo.gl/KaeiRuA7EwybcJCu7";

  render(
    <PlaceForm
      initial={{
        name: "Casa monsenhor",
        maps_url: "https://www.google.com/maps/@-3.10,-60.02,17z",
        latitude: "-3.10",
        longitude: "-60.02",
      }}
      onSubmit={onSubmit}
    />,
  );

  fireEvent.change(screen.getByDisplayValue("https://www.google.com/maps/@-3.10,-60.02,17z"), {
    target: { value: shortUrl },
  });

  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        maps_url: shortUrl,
        latitude: undefined,
        longitude: undefined,
      }),
    );
  });
});

test("short Google Maps URLs can be saved and resolved from the icon action", async () => {
  const onResolveMapsUrl = vi.fn().mockResolvedValue(undefined);
  const shortUrl = "https://maps.app.goo.gl/KaeiRuA7EwybcJCu7";

  render(
    <PlaceForm
      initial={{
        name: "Casa monsenhor",
        maps_url: shortUrl,
      }}
      onSubmit={vi.fn()}
      onResolveMapsUrl={onResolveMapsUrl}
    />,
  );

  fireEvent.click(screen.getByTitle(/save and process short maps url/i));

  await waitFor(() => {
    expect(onResolveMapsUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Casa monsenhor",
        maps_url: shortUrl,
      }),
    );
  });
});

test("syncs the map pin when the initial coordinates change", async () => {
  const { rerender } = render(
    <PlaceForm
      key="a"
      initial={{
        name: "Casa monsenhor",
        maps_url: "https://maps.app.goo.gl/KaeiRuA7EwybcJCu7",
        latitude: "-3.10",
        longitude: "-60.02",
      }}
      onSubmit={vi.fn()}
    />,
  );

  expect(screen.getByText("-3.1000000, -60.0200000")).toBeInTheDocument();

  rerender(
    <PlaceForm
      key="b"
      initial={{
        name: "Casa monsenhor",
        maps_url: "https://www.google.com/maps/@-3.11,-60.03,17z",
        latitude: "-3.11",
        longitude: "-60.03",
      }}
      onSubmit={vi.fn()}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText("-3.1100000, -60.0300000")).toBeInTheDocument();
  });
});
