declare module "*.css" {}

interface ImportMetaEnv {
  readonly VITE_CONSOLE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
