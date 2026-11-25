import { requireComedian } from "@/lib/auth";
import { AppHeader, hasTabs } from "@/components/app-header";
import {
  isLocalPass,
  isTravelShow,
  loadAvailsProfile,
  offersInTown,
  loadVisibleShows,
} from "@/lib/avails";
import { matchCity } from "@/lib/cities";
import { formatCity } from "@/lib/markets";
import { LOCAL_PASS_RADIUS_MILES } from "@/lib/pass-level";
import { AvailsForm, type AvailsShow } from "./avails-form";
import { HomeMarketEditor } from "./home-market-editor";

export default async function AvailsPage() {
  // Bookers are sent to /booker: they don't submit avails.
  const user = await requireComedian();
  const localPass = isLocalPass(user);

  const [visible, profile] = await Promise.all([
    loadVisibleShows(user),
    loadAvailsProfile(user),
  ]);

  const rawCities = visible.map((s) => s.city);
  const shows: AvailsShow[] = visible.map((s) => ({
    id: s.id,
    city: formatCity(s.city, rawCities),
    neighborhood: s.neighborhood,
    date: s.show_date,
    time: s.show_time,
    isAllStar: s.is_all_star,
    locked: s.locked,
    isTravel: isTravelShow(s.city, profile.homeMarket),
    offersInTown: offersInTown(s.city, profile.homeMarket),
  }));

  const tabbed = hasTabs(user);

  const initialAnswers: Record<number, boolean> = {};
  const initialHelp: Record<number, boolean> = {};
  const initialInTown: Record<number, boolean> = {};
  for (const s of visible) {
    if (s.available !== null) initialAnswers[s.id] = s.available;
    if (s.down_to_help) initialHelp[s.id] = true;
    if (s.in_town && offersInTown(s.city, profile.homeMarket)) initialInTown[s.id] = true;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {tabbed && <AppHeader user={user} />}
      <header
        className={tabbed ? "bg-white" : "border-b-4 border-[#DA1717] bg-white"}
      >
        <div className="mx-auto w-full max-w-xl px-4 py-4">
          {!tabbed && (
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <span className="text-xl font-bold tracking-tight text-[#1F3A5F]">
                Texahoma Avails
              </span>
              <a
                href="/logout"
                className="text-sm text-zinc-500 underline hover:text-zinc-950"
              >
                Sign out
              </a>
            </div>
          )}
          <h1 className="text-lg font-semibold text-zinc-950">
            Avails for {user.name}
          </h1>
          {localPass ? (
            <p className="mt-1 text-sm text-zinc-600">
              Home market:{" "}
              <span className="font-medium text-zinc-950">
                {profile.homeMarket ?? "not set"}
              </span>
            </p>
          ) : (
            <HomeMarketEditor
              // Remount after a save so the picker starts from the new value.
              key={profile.homeMarket ?? ""}
              homeMarket={profile.homeMarket}
              selectValue={
                profile.homeMarket
                  ? (matchCity(profile.homeMarket) ?? profile.homeMarket)
                  : ""
              }
            />
          )}
          {localPass && (
            <p className="mt-3 rounded-md border border-[#1F3A5F]/20 bg-[#1F3A5F]/5 px-3 py-2 text-sm text-[#1F3A5F]">
              {profile.homeMarket ? (
                <>
                  You&rsquo;re locally passed, so you&rsquo;ll only see shows
                  within {LOCAL_PASS_RADIUS_MILES} miles of {profile.homeMarket}.
                  Ask an admin if your home market needs to change.
                </>
              ) : (
                <>
                  You&rsquo;re locally passed, so you&rsquo;ll see shows within{" "}
                  {LOCAL_PASS_RADIUS_MILES} miles of your home market. Ask an
                  admin to set your home market.
                </>
              )}
            </p>
          )}
          <p className="mt-3 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
            An important note: Only submit for dates you think you can make.
            And remember, submitting helps us sort through a big list of comics,
            but it isn&rsquo;t a guaranteed booking.
            <br />
            <br />
            And one more note: A lot of these are local spots that do not cover
            travel. Please keep that in mind when submitting.
            <br/>
            <br/>
            &ldquo;In town&rdquo; lets us know you&rsquo;ll already be in the
            area, which helps us work out booking. You do NOT need to select &ldquo;In town&rdquo; for shows in and around your home market
          </p>
        </div>
      </header>

      <AvailsForm
        shows={shows}
        initialAnswers={initialAnswers}
        initialHelp={initialHelp}
        initialInTown={initialInTown}
        initialHasTruck={profile.hasTruck}
        lastSubmittedAt={profile.lastSubmittedAt}
      />
    </div>
  );
}
