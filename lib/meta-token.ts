/**
 * Long-lived IG token refresh.
 *
 * Long-lived tokens last ~60 days and can be refreshed (extended another ~60
 * days) any time before they expire — but NOT after. We refresh well before
 * that (see cron schedule) and push the new value into Vercel's env var via
 * the Vercel REST API so the running deployment picks it up automatically.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export interface RefreshResult {
  accessToken: string;
  expiresInSeconds: number;
}

export async function refreshLongLivedToken(): Promise<RefreshResult> {
  const current = required("IG_ACCESS_TOKEN");
  const res = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=ig_refresh_token&access_token=${current}`,
  );
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: unknown;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(`token refresh failed: ${JSON.stringify(json.error ?? json)}`);
  }
  return { accessToken: json.access_token, expiresInSeconds: json.expires_in ?? 0 };
}

/**
 * Push the refreshed token into the Vercel project's env var so future
 * invocations pick it up without a manual redeploy. Requires a Vercel API
 * token (VERCEL_API_TOKEN) with access to the project — set this up once in
 * Vercel dashboard -> Account Settings -> Tokens, scoped to this project.
 *
 * If VERCEL_API_TOKEN/VERCEL_PROJECT_ID are not set, falls back to just
 * notifying so the value can be updated by hand.
 */
export async function persistTokenToVercel(newToken: string): Promise<"updated" | "manual"> {
  const apiToken = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID; // optional, only for team-scoped projects
  if (!apiToken || !projectId) return "manual";

  const teamQuery = teamId ? `?teamId=${teamId}` : "";
  const listRes = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env${teamQuery}`,
    { headers: { Authorization: `Bearer ${apiToken}` } },
  );
  const list = (await listRes.json()) as { envs?: Array<{ id: string; key: string }> };
  const existing = list.envs?.find((e) => e.key === "IG_ACCESS_TOKEN");
  if (!existing) throw new Error("IG_ACCESS_TOKEN env var not found on Vercel project");

  const updateRes = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}${teamQuery}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: newToken }),
    },
  );
  if (!updateRes.ok) {
    throw new Error(`Vercel env update failed: ${updateRes.status} ${await updateRes.text()}`);
  }
  return "updated";
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
