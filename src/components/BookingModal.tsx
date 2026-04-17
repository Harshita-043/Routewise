import { useState } from "react";
import { MapPin, Navigation, Clock, X, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  source: string;
  destination: string;
  distance: number;
  transportType: string;
  fare: number;
  time: string;
}

export default function BookingModal({
  isOpen,
  onClose,
  onConfirm,
  source,
  destination,
  distance,
  transportType,
  fare,
  time,
}: BookingModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsConfirming(true);
    await onConfirm();
    setIsConfirmed(true);
    setIsConfirming(false);
    setTimeout(() => {
      setIsConfirmed(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-2xl border border-border/50 w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-secondary p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-xl font-bold mb-1">Confirm Booking</h2>
          <p className="text-white/80 text-sm">Review your trip details</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {isConfirmed ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Booking Confirmed!</h3>
              <p className="text-muted-foreground">Your ride has been booked successfully.</p>
            </div>
          ) : (
            <>
              {/* Route */}
              <div className="flex items-start gap-4 mb-6">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="w-0.5 h-6 bg-gradient-to-b from-primary to-secondary" />
                  <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                    <Navigation className="w-4 h-4 text-secondary" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">From</p>
                    <p className="font-semibold">{source}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">To</p>
                    <p className="font-semibold">{destination}</p>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Transport</p>
                  <p className="font-bold">{transportType}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Distance</p>
                  <p className="font-bold">{distance.toFixed(1)} km</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Time</p>
                  <p className="font-bold flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    {time}
                  </p>
                </div>
              </div>

              {/* Fare */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 mb-6">
                <span className="font-medium">Total Fare</span>
                <span className="text-2xl font-bold text-primary">₹{fare}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                  disabled={isConfirming}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    "Confirm Booking"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
