import { HOME_MARKETS } from "@/lib/markets";

/** A plain <select> of HOME_MARKETS. Pass name/defaultValue/etc. through. */
export function HomeMarketSelect({
  emptyLabel = "Home market (optional)",
  ...props
}: React.ComponentProps<"select"> & { emptyLabel?: string }) {
  return (
    <select {...props}>
      <option value="">{emptyLabel}</option>
      {HOME_MARKETS.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}
