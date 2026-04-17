import { Bus, Car, Leaf, TrainFront, Users } from "lucide-react";

export interface ComparisonCard {
  mode: "carpool" | "bus" | "train" | "taxi" | "metro";
  fare: number;
  duration: string;
  co2Kg: number;
  badge?: "best value" | "fastest" | "greenest";
}

interface FareComparisonPanelProps {
  cards: ComparisonCard[];
  sortBy: "cheapest" | "fastest" | "greenest";
  onSortChange: (sort: "cheapest" | "fastest" | "greenest") => void;
}

const icons = {
  carpool: Users,
  bus: Bus,
  train: TrainFront,
  taxi: Car,
  metro: Leaf,
};

export default function FareComparisonPanel({ cards, sortBy, onSortChange }: FareComparisonPanelProps) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-lg">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-bold">Multi-Modal Comparison</h3>
          <p className="text-sm text-muted-foreground">Compare fare, time, and CO2 footprint side by side.</p>
        </div>
        <select
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value as "cheapest" | "fastest" | "greenest")}
          className="rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm"
        >
          <option value="cheapest">Cheapest</option>
          <option value="fastest">Fastest</option>
          <option value="greenest">Greenest</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {cards.map((card) => {
          const Icon = icons[card.mode];
          return (
            <article key={card.mode} className="rounded-2xl border border-border/50 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h4 className="font-semibold capitalize">{card.mode}</h4>
                </div>
                {card.badge ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    {card.badge}
                  </span>
                ) : null}
              </div>
              <p className="text-2xl font-bold">₹{card.fare}</p>
              <p className="mt-1 text-sm text-muted-foreground">{card.duration}</p>
              <p className="mt-4 text-xs text-muted-foreground">CO2 estimate: {card.co2Kg.toFixed(1)} kg</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
