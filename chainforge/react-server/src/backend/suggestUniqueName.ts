import useStore from "../store";
import { generateAndReplace } from "./ai";

export async function suggestUniqueName(
  seed: string,
  provider: string,
  apiKeys: any,
): Promise<string> {
  const { aiFeaturesProvider, nodes } = useStore.getState();
  // Ask the model for 3 short suggestions (bullet list)
  const prompt = `Suggest 1 short, unique, Camel-Case names for a node that groups variations of “${seed}”. Return them as a plain list.`;
  let response = "";
  try {
    const res = await generateAndReplace(
      prompt,
      1,
      false,
      aiFeaturesProvider,
      apiKeys,
    );
    response = res[0] || "";
  } catch {
    return seed + "Var";
  }

  const existing = new Set(Object.values(nodes).map((n: any) => n.data?.title));
  const candidates = response
    .split(/\n|,|;/)
    .map((s) => s.replace(/^[\-\d\.\s]*/, "").trim())
    .filter(Boolean);
  for (const c of candidates) if (!existing.has(c)) return c;

  // Fallback: append counter
  let i = 2;
  let name = seed + i;
  while (existing.has(name)) name = seed + ++i;
  return name;
}
