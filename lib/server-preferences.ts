import { cookies } from "next/headers";

import { parseStoredPreferences, PREFERENCES_COOKIE_KEY } from "@/lib/preferences-store";

export async function getServerPreferences() {
  const cookieStore = await cookies();
  return parseStoredPreferences(cookieStore.get(PREFERENCES_COOKIE_KEY)?.value);
}
