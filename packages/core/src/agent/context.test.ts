import { describe, expect, it } from "bun:test";
import { compactToolResults } from "./context";
import type { ProviderMessage } from "./types";

type Step = { name: string; path: string; size: number };

function conversation(steps: Step[]): ProviderMessage[] {
  const messages: ProviderMessage[] = [
    { role: "system", content: "sistema" },
    { role: "user", content: "prompt" },
  ];
  steps.forEach((step, i) => {
    messages.push({ role: "assistant", content: "", toolCalls: [{ id: `c${i}`, name: step.name, arguments: { path: step.path } }] });
    messages.push({ role: "tool", content: "x".repeat(step.size), toolCallId: `c${i}`, name: step.name });
  });
  return messages;
}

const tools = (messages: ProviderMessage[]) =>
  messages.filter((m): m is Extract<ProviderMessage, { role: "tool" }> => m.role === "tool");

const relaxed = { minChars: 1_500, maxContextChars: 1e9, keepRecent: 3 };

describe("compactación de contexto del agente", () => {
  it("bajo el límite conserva todas las lecturas vigentes (evita bucles de relectura)", () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({ name: "read_file", path: `src/f${i}.tsx`, size: 5_000 }));
    const input = conversation(steps);
    expect(compactToolResults(input, relaxed)).toEqual(input);
  });

  it("compacta lecturas obsoletas cuando el archivo se relee o se escribe", () => {
    const out = tools(
      compactToolResults(
        conversation([
          { name: "read_file", path: "src/a.tsx", size: 5_000 },
          { name: "read_file", path: "src/b.tsx", size: 5_000 },
          { name: "read_file", path: "src/a.tsx", size: 5_000 },
          { name: "write_file", path: "src/b.tsx", size: 80 },
        ]),
        relaxed,
      ),
    );
    expect(out[0]?.content).toContain("[compactado] read_file src/a.tsx");
    expect(out[1]?.content).toContain("[compactado] read_file src/b.tsx");
    expect(out[2]?.content).toHaveLength(5_000);
  });

  it("bajo presión compacta los más antiguos y respeta los recientes", () => {
    const steps = Array.from({ length: 6 }, (_, i) => ({ name: "read_file", path: `src/f${i}.tsx`, size: 5_000 }));
    const out = tools(compactToolResults(conversation(steps), { minChars: 1_500, maxContextChars: 16_000, keepRecent: 2 }));
    expect(out.slice(-2).every((m) => m.content.length === 5_000)).toBe(true);
    expect(out[0]?.content.startsWith("[compactado]")).toBe(true);
    expect(out.reduce((sum, m) => sum + m.content.length, 0)).toBeLessThanOrEqual(16_000);
  });

  it("no muta los mensajes originales", () => {
    const input = conversation([
      { name: "read_file", path: "a", size: 5_000 },
      { name: "read_file", path: "a", size: 5_000 },
    ]);
    compactToolResults(input, relaxed);
    expect(tools(input).every((m) => m.content.length === 5_000)).toBe(true);
  });
});
