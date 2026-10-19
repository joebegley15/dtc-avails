import { findInviteNomination } from "@/lib/nominations";
import { INVALID_INVITE_MESSAGE } from "@/lib/nomination-message";
import { InviteSignupForm } from "./invite-signup-form";

/** Public: a comic a producer nominated, signing up from the DM'd link. */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  // Invalid, used and expired all look the same from here.
  const nomination = await findInviteNomination(token);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b-4 border-[#DA1717] px-4 py-4">
        <span className="text-xl font-bold tracking-tight text-[#1F3A5F]">
          Texahoma Avails
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        {nomination ? (
          <>
            <h1 className="text-lg font-semibold text-zinc-950">
              Welcome! Set up your account
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Once you&apos;re in, you&apos;ll pick which shows you&apos;re free for.
            </p>
            <InviteSignupForm token={token} name={nomination.comic_name} />
          </>
        ) : (
          <p className="text-sm text-zinc-600">{INVALID_INVITE_MESSAGE}</p>
        )}
      </main>
    </div>
  );
}
