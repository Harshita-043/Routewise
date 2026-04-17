import { Link, useSearchParams } from "react-router";
import { CheckCircle2, Home, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const bookingId = params.get("bookingId");
  const type = params.get("type");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card rounded-2xl border border-border/50 p-8 text-center shadow-xl">
        <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Payment Successful</h1>
        <p className="text-muted-foreground mb-6">
          Your {type} booking is confirmed and the live inventory has been updated.
        </p>
        <div className="rounded-xl bg-muted/40 p-4 mb-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Booking ID</p>
          <p className="font-semibold">{bookingId}</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Home
            </Link>
          </Button>
          <Button asChild className="flex-1">
            <Link to="/my-bookings">
              <ReceiptText className="w-4 h-4 mr-2" />
              My Bookings
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
