import { lookupInvite } from "@/lib/invites";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  params,
}: PageProps<"/signup/[token]">) {
  const { token } = await params;
  const invite = await lookupInvite(token);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b-4 border-[#DA1717] px-4 py-4">
        <span className="text-xl font-bold tracking-tight text-[#DA1717]">
          DON&apos;T TELL
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        {invite.status === "valid" ? (
          <>
            <h1 className="text-lg font-semibold text-zinc-950">
              Set up {invite.name}&apos;s account
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              You&apos;ve been invited as a {invite.role}. Fill in the rest
              below.
            </p>
            <SignupForm token={token} />
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-zinc-950">
              This link isn&apos;t valid
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {invite.status === "used"
                ? "It's already been used to create an account."
                : "It doesn't exist, or the address is wrong."}{" "}
              Ask whoever invited you for a new link.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
