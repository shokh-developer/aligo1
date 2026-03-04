export interface TranslateRequest {
  apiKey: string;
  inputText: string;
  sourceLanguage: string;
  targetLanguage: string;
  model?: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function translateWithApi({
  apiKey,
  inputText,
  sourceLanguage,
  targetLanguage,
  model = "openai/gpt-4o-mini",
}: TranslateRequest): Promise<string> {
  const trimmedText = inputText.trim();
  if (!trimmedText) {
    throw new Error("Tarjima uchun matn kiriting.");
  }

  const translationInstruction =
    sourceLanguage === "Auto-detect"
      ? `Detect the source language automatically and translate to ${targetLanguage}:\n\n${trimmedText}`
      : `Translate from ${sourceLanguage} to ${targetLanguage}:\n\n${trimmedText}`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Alifgo",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a precise translation engine. Return only translated text. Preserve line breaks and formatting.",
        },
        {
          role: "user",
          content: translationInstruction,
        },
      ],
    }),
  });

  const data = (await response.json()) as ChatCompletionResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || "Tarjima API xatoligi yuz berdi.");
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("API javobidan tarjima matni topilmadi.");
  }

  return content;
}
