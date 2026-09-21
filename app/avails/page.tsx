import { requireUser } from "@/lib/auth";
import {
  isTravelShow,
  loadAvailsProfile,
  loadVisibleShows,
} from "@/lib/avails";
import { AvailsForm, type AvailsShow } from "./avails-form";

export default async function AvailsPage() {
  const user = await requireUser();

  const [visible, profile] = await Promise.all([
    loadVisibleShows(user),
    loadAvailsProfile(user),
  ]);

  const shows: AvailsShow[] = visible.map((s) => ({
    id: s.id,
    city: s.city,
    neighborhood: s.neighborhood,
    date: s.show_date,
    time: s.show_time,
    isAllStar: s.is_all_star,
    isTravel: isTravelShow(s.city, profile.homeMarket),
  }));

  const initialAnswers: Record<number, boolean> = {};
  for (const s of visible) {
    if (s.available !== null) initialAnswers[s.id] = s.available;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b-4 border-[#DA1717] bg-white">
        <div className="mx-auto w-full max-w-xl px-4 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-xl font-bold tracking-tight text-[#DA1717]">
              DON&apos;T TELL
            </span>
            <a
              href="/logout"
              className="text-sm text-zinc-500 underline hover:text-zinc-950"
            >
              Sign out
            </a>
          </div>
          <h1 className="mt-3 text-lg font-semibold text-zinc-950">
            Avails for {user.name}
          </h1>
          <p className="text-sm text-zinc-500">
            {profile.homeMarket
              ? `Home market: ${profile.homeMarket}`
              : "Home market: not set, ask Joe to add it"}
          </p>
        </div>
      </header>

      <AvailsForm
        shows={shows}
        initialAnswers={initialAnswers}
        lastSubmittedAt={profile.lastSubmittedAt}
      />
    </div>
  );
}
