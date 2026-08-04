/**
 * Instagram publishing via the Graph API.
 *
 * Single image flow:
 *   1) POST /{IG_USER_ID}/media  { image_url, caption }  -> { id: creationId }
 *   2) POST /{IG_USER_ID}/media_publish { creation_id }  -> { id: mediaId }
 *
 * Carousel flow (2-10 images):
 *   1) POST /{IG_USER_ID}/media { image_url, is_carousel_item: true }  per image -> child id
 *   2) POST /{IG_USER_ID}/media { media_type: "CAROUSEL", children: <ids>, caption } -> parent id
 *      (the caption goes on the parent container, not the children)
 *   3) POST /{IG_USER_ID}/media_publish { creation_id: parent id } -> { id: mediaId }
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

  const container = await graph(`${GRAPH}/${userId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: token,
  });
  const mediaId = await publishCreation(userId, token, container.id as string);
  return { mediaId };
}

/**
 * Publishes a carousel (2-10 images) with the caption on the parent
 * container. Callers should keep a single-image fallback for when this
 * fails — see app/api/cron/run/route.ts, where extra slides beyond the
 * proven daily card are strictly additive and must never block the post.
 */
export async function publishCarouselToInstagram({
  imageUrls,
  caption,
}: {
  imageUrls: string[];
  caption: string;
}): Promise<{ mediaId: string }> {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error(`carousel needs 2-10 images, got ${imageUrls.length}`);
  }
  const userId = required("IG_USER_ID");
  const token = required("IG_ACCESS_TOKEN");

  const childIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const child = await graph(`${GRAPH}/${userId}/media`, {
      image_url: imageUrl,
      is_carousel_item: "true",
      access_token: token,
    });
    childIds.push(child.id as string);
  }

  const parent = await graph(`${GRAPH}/${userId}/media`, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
    access_token: token,
  });
  const mediaId = await publishCreation(userId, token, parent.id as string);
  return { mediaId };
}

/** Shared publish step (with retry — the container may need a moment to be ready). */
async function publishCreation(userId: string, token: string, creationId: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const published = await graph(`${GRAPH}/${userId}/media_publish`, {
        creation_id: creationId,
        access_token: token,
      });
      return published.id as string;
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
