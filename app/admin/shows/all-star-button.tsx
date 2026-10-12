"use client";

/** A star that marks a show all-star: filled when on, outline when off. */
export function AllStarButton({
  isAllStar,
  label,
  disabled,
  onClick,
}: {
  isAllStar: boolean;
  /** Names the show for screen readers, e.g. its city. */
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isAllStar}
      aria-label={`All-star: ${label}`}
      title={isAllStar ? "All-star show (click to remove)" : "Make all-star"}
      disabled={disabled}
      onClick={onClick}
      className={`text-xl leading-none disabled:opacity-50 ${
        isAllStar ? "text-[#DA1717]" : "text-zinc-300 hover:text-[#DA1717]"
      }`}
    >
      {isAllStar ? "★" : "☆"}
    </button>
  );
}
