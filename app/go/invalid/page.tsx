export default function InvalidLinkPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b-4 border-[#DA1717] px-4 py-4">
        <span className="text-xl font-bold tracking-tight text-[#1F3A5F]">
          Texahoma Avails
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <p className="text-sm text-zinc-600">
          This link isn&apos;t valid. Ask Joe for a new one.
        </p>
      </main>
    </div>
  );
}
