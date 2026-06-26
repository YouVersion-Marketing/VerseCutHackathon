/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BIBLE_PROVIDER?: 'mock' | 'youversion' | 'api.bible';
  readonly VITE_BIBLE_API_KEY?: string;
  readonly VITE_BIBLE_DEFAULT_VERSION?: string;
  readonly VITE_YV_BASE_URL?: string;
  readonly VITE_YV_SEND_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
