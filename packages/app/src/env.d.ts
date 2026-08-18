interface ImportMetaEnv {
  readonly VITE_CODETUTOR_SERVER_HOST: string
  readonly VITE_CODETUTOR_SERVER_PORT: string
  readonly VITE_CODETUTOR_CHANNEL?: "dev" | "beta" | "prod"
  readonly VITE_DEFAULT_SERVER_URL?: string
  readonly VITE_CODETUTOR_ACCOUNT_ENABLED?: "0" | "1"
  readonly VITE_CODETUTOR_ACCOUNT_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.png" {
  const src: string
  export default src
}

declare module "*.mp4" {
  const src: string
  export default src
}

export declare module "solid-js" {
  namespace JSX {
    interface Directives {
      sortable: true
    }
  }
}
