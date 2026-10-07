/**
 * The AIs a prompt can be sent to (docs/specs/quiz-ai-import.md,
 * docs/specs/program-import.md §3): the prompt goes in the URL where the
 * site takes it, and always on the clipboard.
 */

export type AiProvider = "chatgpt" | "claude" | "gemini";

export interface AiProviderConfig {
  label: string;
  prefill: boolean;
  /** Link to open; `prefill` means the prompt travels in the URL. */
  url: (prompt: string) => string;
}

export const AI_PROVIDERS: Record<AiProvider, AiProviderConfig> = {
  chatgpt: {
    label: "ChatGPT",
    prefill: true,
    url: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
  },
  claude: {
    label: "Claude",
    prefill: true,
    url: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
  // Gemini has no URL parameter to prefill a prompt; the clipboard carries it.
  gemini: {
    label: "Gemini",
    prefill: false,
    url: () => "https://gemini.google.com/app",
  },
};

/** The prompt's language, from the app's. */
export function promptLanguage(language: string): "en" | "pt-BR" {
  return language.startsWith("pt") ? "pt-BR" : "en";
}
