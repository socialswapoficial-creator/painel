import { supabaseUrl, supabasePublishableKey, originalAssetsUrl } from "./supabase-config.js";

export const mediaBucket = "moda-infantil-media";
export async function connect() {
  if (!supabaseUrl || !supabasePublishableKey) return null;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm");
  return createClient(supabaseUrl, supabasePublishableKey);
}

export function mediaUrl(client, path) {
  if (/^[a-z0-9-]+\.webp$/.test(path)) return new URL(path, originalAssetsUrl).href;
  if (/^(products|hero)\/[a-f0-9-]+\.(jpg|png|webp)$/.test(path)) {
    return client.storage.from(mediaBucket).getPublicUrl(path).data.publicUrl;
  }
  return "";
}
