"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { cityCoordinates } from "@/lib/cities";

export type SaveCityState = { error?: string; success?: string };

function coordinate(value: FormDataEntryValue | null, min: number, max: number): number | null | "bad" {
  const text = String(value ?? "").trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= min && n <= max ? n : "bad";
}

/**
 * Adds or corrects a city's coordinates. With latitude and longitude blank,
 * they're looked up in the bundled zip data (no network call).
 */
export async function saveCity(
  _prev: SaveCityState,
  formData: FormData
): Promise<SaveCityState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const lat = coordinate(formData.get("latitude"), -90, 90);
  const lon = coordinate(formData.get("longitude"), -180, 180);
  if (!name) return { error: "Enter the city as it appears on shows, like Kingwood, TX." };
  if (name.length > 100) return { error: "Keep the city name under 100 characters." };
  if (lat === "bad" || lon === "bad") return { error: "Latitude is -90 to 90, longitude -180 to 180." };
  if ((lat === null) !== (lon === null)) return { error: "Enter both latitude and longitude, or neither." };

  let latitude = lat;
  let longitude = lon;
  if (latitude === null || longitude === null) {
    const found = cityCoordinates(name);
    if (!found) {
      return { error: `${name} isn't in the zip data. Enter its latitude and longitude.` };
    }
    latitude = found.latitude;
    longitude = found.longitude;
  }

  await sql`
    insert into cities (name, latitude, longitude)
    values (${name}, ${latitude}, ${longitude})
    on conflict ((lower(name))) do update
      set latitude = excluded.latitude, longitude = excluded.longitude
  `;

  revalidatePath("/admin/cities");
  return { success: `Saved ${name} (${latitude.toFixed(4)}, ${longitude.toFixed(4)}).` };
}
