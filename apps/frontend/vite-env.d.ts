/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SOCKET_URL: string;
  readonly VITE_GOOGLE_ENABLED: string;
  readonly VITE_APPLE_ENABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
