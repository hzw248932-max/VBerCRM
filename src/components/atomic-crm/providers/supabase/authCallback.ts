import type { SupabaseClient } from "@supabase/supabase-js";

/** Complete email confirmation explicitly rather than restoring a stale signup route. */
export async function completeEmailCallback(
  client: SupabaseClient,
  hash: string,
) {
  const params = new URLSearchParams(hash.split("?")[1] ?? "");
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (
    params.has("error") ||
    params.has("error_code") ||
    !access_token ||
    !refresh_token ||
    access_token === "null" ||
    refresh_token === "null"
  ) {
    throw new Error("ra-supabase.auth.missing_tokens");
  }
  // The CRM wrapper fetches protected configuration immediately after this
  // callback. Recovery/invite links must establish their session first too.
  const { error } = await client.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  const type = params.get("type");
  if (type === "recovery" || type === "invite") {
    const search = new URLSearchParams({
      access_token,
      refresh_token,
      type,
    }).toString();
    return { redirectTo: () => ({ pathname: "/set-password", search }) };
  }
  return { redirectTo: "/" };
}
