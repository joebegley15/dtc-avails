import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import { sql } from "@/lib/db";
import { logout } from "./actions";
import { UploadCsvForm } from "./upload-csv-form";

type RecentShow = {
  id: number;
  city: string;
  neighborhood: string | null;
  show_date: string;
  show_time: string;
  venue: string;
  producer_name: string | null;
};

export default async function UploadPage() {
  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value)) {
    redirect("/upload/login");
  }

  const recentShows = (await sql`
    select
      s.id, s.city, s.neighborhood,
      to_char(s.show_date, 'YYYY-MM-DD') as show_date,
      to_char(s.show_time, 'HH24:MI') as show_time,
      s.venue, u.name as producer_name
    from shows s
    left join show_producers sp on sp.show_id = s.id
    left join users u on u.id = sp.producer_id
    order by s.created_at desc
    limit 15
  `) as RecentShow[];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Add shows to avails
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Paste CSV rows with header: city,neighborhood,date,time,producer,venue,capacity
          </p>
        </div>
        <form action={logout}>
          <button className="text-sm text-zinc-500 underline hover:text-zinc-950 dark:hover:text-zinc-50">
            Log out
          </button>
        </form>
      </div>

      <UploadCsvForm />

      <section>
        <h2 className="text-sm font-medium text-zinc-500">Recently added</h2>
        <ul className="mt-2 divide-y divide-black/5 text-sm dark:divide-white/10">
          {recentShows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
              <span className="font-medium">{s.city}</span>
              {s.neighborhood && <span className="text-zinc-500">({s.neighborhood})</span>}
              <span>{s.show_date}</span>
              <span>{s.show_time}</span>
              <span>{s.venue}</span>
              {s.producer_name && <span className="text-zinc-500">— {s.producer_name}</span>}
            </li>
          ))}
          {recentShows.length === 0 && <li className="py-2 text-zinc-500">No shows yet.</li>}
        </ul>
      </section>
    </div>
  );
}
