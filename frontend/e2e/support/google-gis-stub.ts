import type { Page } from "@playwright/test";

type GoogleCallback = (response: { credential: string }) => void;

export async function stubGoogleIdentity(page: Page, idToken = "fake-google-id-token") {
  await page.addInitScript((token) => {
    let callback: GoogleCallback | null = null;

    (window as Window & typeof globalThis & { google?: unknown }).google = {
      accounts: {
        id: {
          initialize: (options: { callback: GoogleCallback }) => {
            callback = options.callback;
          },
          renderButton: (container: HTMLElement) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Fazer Login com o Google";
            button.addEventListener("click", () => {
              callback?.({ credential: token });
            });
            container.replaceChildren(button);
          },
          prompt: () => {},
        },
      },
    };
  }, idToken);
}
