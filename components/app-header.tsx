export function AppHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between border-b-4 border-[#DA1717] px-4 py-4">
      <div className="flex items-baseline gap-3">
        <span className="text-xl font-bold tracking-tight text-[#DA1717]">
          DON&apos;T TELL
        </span>
        <span className="text-sm text-zinc-500">{title}</span>
      </div>
      <a
        href="/logout"
        className="text-sm text-zinc-500 underline hover:text-zinc-950"
      >
        Sign out
      </a>
    </header>
  );
}
