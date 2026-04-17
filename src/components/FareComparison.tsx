import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bus, Car, Train, Users, Fuel, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FareOption {
  type: string;
  fare: number;
  time: string;
  isCheapest?: boolean;
  isFastest?: boolean;
}

interface FareComparisonProps {
  fares: FareOption[];
}

const iconMap: Record<string, { icon: React.ReactNode; color: string }> = {
  Bus: { icon: <Bus className="w-5 h-5" />, color: "text-transport-bus" },
  Taxi: { icon: <Car className="w-5 h-5" />, color: "text-transport-taxi" },
  Train: { icon: <Train className="w-5 h-5" />, color: "text-transport-train" },
  Carpool: { icon: <Users className="w-5 h-5" />, color: "text-transport-carpool" },
  "Fuel Cost": { icon: <Fuel className="w-5 h-5" />, color: "text-transport-fuel" },
};

export default function FareComparison({ fares }: FareComparisonProps) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="font-bold text-lg">Fare Comparison</h3>
        <p className="text-sm text-muted-foreground">Compare all transport options at a glance</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            <TableHead className="font-semibold">Transport</TableHead>
            <TableHead className="font-semibold text-right">Estimated Fare</TableHead>
            <TableHead className="font-semibold text-right">Time</TableHead>
            <TableHead className="font-semibold text-center">Best For</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fares.map((fare) => {
            const { icon, color } = iconMap[fare.type] || { icon: null, color: "" };
            return (
              <TableRow key={fare.type} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className={cn(color)}>{icon}</span>
                    <span className="font-medium">{fare.type}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold">₹{fare.fare}</TableCell>
                <TableCell className="text-right text-muted-foreground">{fare.time}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-2">
                    {fare.isCheapest && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Check className="w-3 h-3" />
                        Cheapest
                      </span>
                    )}
                    {fare.isFastest && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <Check className="w-3 h-3" />
                        Fastest
                      </span>
                    )}
                    {!fare.isCheapest && !fare.isFastest && (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
