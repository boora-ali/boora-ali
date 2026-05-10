export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (element: HTMLElement, options?: Record<string, unknown>) => void;
        };
      };
    };
  }

  interface GoogleCredentialResponse {
    credential?: string;
    select_by?: string;
  }
}
