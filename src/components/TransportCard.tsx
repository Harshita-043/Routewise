import { Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TransportType = "bus" | "taxi" | "train" | "carpool" | "fuel";

interface TransportCardProps {
  type: TransportType;
  icon: React.ReactNode;
  name: string;
  fare: number;
  time: string;
  description: string;
  isCheapest?: boolean;
  isFastest?: boolean;
  onBook: () => void;
  showBookButton?: boolean;
}

const colorMap: Record<TransportType, { bg: string; border: string; badge: string }> = {
  bus: {
    bg: "bg-transport-bus/10",
    border: "border-transport-bus/30 hover:border-transport-bus/50",
    badge: "bg-transport-bus text-white",
  },
  taxi: {
    bg: "bg-transport-taxi/10",
    border: "border-transport-taxi/30 hover:border-transport-taxi/50",
    badge: "bg-transport-taxi text-gray-900",
  },
  train: {
    bg: "bg-transport-train/10",
    border: "border-transport-train/30 hover:border-transport-train/50",
    badge: "bg-transport-train text-white",
  },
  carpool: {
    bg: "bg-transport-carpool/10",
    border: "border-transport-carpool/30 hover:border-transport-carpool/50",
    badge: "bg-transport-carpool text-white",
  },
  fuel: {
    bg: "bg-transport-fuel/10",
    border: "border-transport-fuel/30 hover:border-transport-fuel/50",
    badge: "bg-transport-fuel text-white",
  },
};

export default function TransportCard({
  type,
  icon,
  name,
  fare,
  time,
  description,
  isCheapest,
  isFastest,
  onBook,
  showBookButton = true,
}: TransportCardProps) {
  const colors = colorMap[type];

  return (
    <div
      className={cn(
        "relative group bg-card/60 backdrop-blur-sm rounded-2xl border-2 p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2",
        colors.border
      )}
    >
      {/* Badges */}
      <div className="absolute -top-3 right-6 flex gap-2 z-10">
        {isCheapest && (
          <span className="px-4 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg border border-white/20">
            Best Value
          </span>
        )}
        {isFastest && (
          <span className="px-4 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg border border-white/20">
            Fastest
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-start gap-5">
        {/* Icon Container with Glow */}
        <div className={cn(
          "relative w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", 
          colors.bg
        )}>
          <div className={cn("absolute inset-0 rounded-2xl blur-lg opacity-0 group-hover:opacity-40 transition-opacity", colors.bg)} />
          <div className="relative z-10">{icon}</div>
        </div>

        {/* Content */}
        <div className="flex-1 w-full space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-extrabold text-xl tracking-tight">{name}</h3>
            <div className={cn("px-4 py-1.5 rounded-xl font-black text-xl shadow-sm border border-black/5", colors.badge)}>
              ₹{fare}
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
          
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground/80">
              <Clock className="w-4 h-4 text-primary/60" />
              <span>{time}</span>
            </div>
            {showBookButton ? (
              <Button
                onClick={onBook}
                size="sm"
                className={cn(
                  "font-bold px-5 rounded-xl transition-all duration-300 active:scale-95 shadow-md hover:shadow-lg",
                  colors.badge
                )}
              >
                Book
                <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
              </Button>
            ) : (
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 px-3 py-1 rounded-md border border-border/30">
                View Only
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
