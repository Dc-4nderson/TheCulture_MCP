const HF_TOKEN = process.env.HF_TOKEN;
const HF_USERNAME = process.env.HF_USERNAME ?? "Dc-4nderson";

if (!HF_TOKEN) {
  throw new Error("HF_TOKEN must be set");
}

export async function callHFInference(
  repoName: string,
  payload: Record<string, unknown>
): Promise<unknown> {
  const url = `https://api-inference.huggingface.co/models/${HF_USERNAME}/${repoName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
      "x-wait-for-model": "true",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HF inference failed [${repoName}] (${res.status}): ${err}`);
  }

  return res.json();
}
