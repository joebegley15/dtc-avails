export type ShowRowData = {
  id: number;
  city: string;
  neighborhood: string | null;
  show_date: string; // YYYY-MM-DD
  show_time: string; // HH:MM
  venue: string;
  capacity: number | null;
  is_all_star: boolean;
  producer_ids: number[];
  producer_names: string[];
};
