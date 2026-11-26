import type { PricedOrder } from "../engine/stats";
import type { Menu } from "../engine/types";
import { executeTool, toolDeclarations } from "./tools";

export type BotErrorCode = "NO_KEY" | "BAD_KEY" | "QUOTA" | "NETWORK" | "API" | "EMPTY";

export class BotError extends Error {
  code: BotErrorCode;
  constructor(code: BotErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const SYSTEM = `You are a sales assistant for a breakfast shop. Staff ask about orders.
Rules:
- Answer ONLY with data returned by your tools. Never calculate or estimate numbers yourself.
- Money: report the "bdt" value from the tool result.
- Orders contain NO customer data (no names, phones, emails). If asked who a customer is, say you cannot know it from this data. Never invent a name.
- If no tool can answer the question, say so plainly. Do not guess.
- Keep answers short, plain English.`;

interface Part {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  [key: string]: unknown;
}
interface Content {
  role: string;
  parts: Part[];
}

export interface AskDeps {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

function mapStatus(status: number, body: string): BotError {
  if (status === 429) return new BotError("QUOTA", "Gemini quota exceeded (429). Wait a bit and try again.");
  if (status === 401 || status === 403 || (status === 400 && /API key|API_KEY/i.test(body))) {
    return new BotError("BAD_KEY", "Gemini rejected the API key. Check VITE_GEMINI_API_KEY in .env.local.");
  }
  return new BotError("API", `Gemini error (HTTP ${status}).`);
}

async function generate(doFetch: typeof fetch, apiKey: string, model: string, contents: Content[]) {
  let res: Response;
  try {
    res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        tools: [{ functionDeclarations: toolDeclarations }],
      }),
    });
  } catch {
    throw new BotError("NETWORK", "Network error. Check your connection and try again.");
  }
  if (!res.ok) throw mapStatus(res.status, await res.text().catch(() => ""));
  return (await res.json()) as { candidates?: Array<{ content?: Content }> };
}

// Model picks a tool. OUR code runs it. Model only phrases the result.
// Raw orders are never sent to the model.
export async function askBot(
  question: string,
  orders: PricedOrder[],
  menu: Menu,
  deps: AskDeps = {},
): Promise<string> {
  const apiKey = deps.apiKey ?? import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new BotError("NO_KEY", "No Gemini API key. Add VITE_GEMINI_API_KEY to .env.local and restart.");
  const model = deps.model ?? import.meta.env.VITE_GEMINI_MODEL ?? "gemini-3.5-flash";
  const doFetch = deps.fetchImpl ?? fetch;

  const contents: Content[] = [{ role: "user", parts: [{ text: question }] }];
  for (let step = 0; step < 4; step++) {
    const res = await generate(doFetch, apiKey, model, contents);
    const content = res.candidates?.[0]?.content;
    const calls = content?.parts?.filter((p) => p.functionCall) ?? [];

    if (!content || calls.length === 0) {
      const text = (content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      if (!text) throw new BotError("EMPTY", "Gemini returned no answer. Try rephrasing.");
      return text;
    }

    contents.push(content); // echo model turn as is
    contents.push({
      role: "user",
      parts: calls.map((p) => ({
        functionResponse: {
          name: p.functionCall!.name,
          response: { result: executeTool(p.functionCall!.name, p.functionCall!.args, orders, menu) },
        },
      })),
    });
  }
  throw new BotError("API", "Gemini kept calling tools without answering.");
}