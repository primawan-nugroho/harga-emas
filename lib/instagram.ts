/**
 * Instagram publishing via the Graph API.
 *
 * Flow:
 *   1) POST /{IG_USER_ID}/media  { image_url, caption }  -> { id: creationId }
 *   2) POST /{IG_USER_ID}/media_publish { creation_id }  -> { id: mediaId }
 *
 * Requirements:
 *   - IG Business/Creator account linked to a Facebook Page
 *   - A long-lived IG_ACCESS_TOKEN with instagram_content_publish
 *   - image_url must be a PUBLIC https URL (upload PNG to Vercel Blob first)
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export interface PublishInput {
  imageUrl: string;
  caption: string;
}

export async function publishToInstagram({
  imageUrl,
  caption,
}: PublishInput): Promise<{ mediaId: string }> {
  const userId = required("IG_USER_ID");
  const token = required("IG_ACCESS_TOKEN");

  // 1) Create media container
  const container = await graph(`${GRAPH}/${userId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: token,
  });
  const creationId = container.id as string;

  // 2) Publish (small retry: container may need a moment to be ready)
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const published = await graph(`${GRAPH}/${userId}/media_publish`, {
        creation_id: creationId,
        access_token: token,
      });
      return { mediaId: published.id as string };
    } catch (e) {
      lastErr = e;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error(`media_publish failed: ${String(lastErr)}`);
}

async function graph(
  url: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error) {
    throw new Error(`Graph API ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  }
  return json;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
