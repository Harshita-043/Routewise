function getReservationCharge(classType) {
  const charges = {
    SL: 25,
    "3A": 45,
    "2A": 60,
    "1A": 75,
    CC: 35,
  };

  return charges[classType] || 30;
}

function getTatkalRate(classType) {
  const rates = {
    SL: 0.1,
    "3A": 0.3,
    "2A": 0.3,
    "1A": 0.3,
  };

  return rates[classType] || 0;
}

function daysUntilJourney(date) {
  const target = new Date(date);
  const now = new Date();
  const diff = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

function getClassMultiplier(classType) {
  const multipliers = {
    "2S": 0.6,
    "SL": 1.0,
    "CC": 2.4,
    "3A": 2.6,
    "2A": 3.8,
    "1A": 6.5,
  };
  return multipliers[classType] || 1.0;
}

export function buildFareBreakdown({ train, classType = "SL", date, availability }) {
  let selectedClass = train.classes.find((item) => item.type === classType);
  let baseFare = 0;

  if (selectedClass) {
    baseFare = Number(selectedClass.baseFare || 0);
  } else {
    // Fallback: estimate baseFare using another class (prefer SL)
    const refClass = train.classes.find((item) => item.type === "SL") || train.classes[0];
    if (refClass && refClass.baseFare) {
      const refMultiplier = getClassMultiplier(refClass.type);
      const targetMultiplier = getClassMultiplier(classType);
      baseFare = Math.round((Number(refClass.baseFare) / refMultiplier) * targetMultiplier);
    } else {
      // Hard fallback if no classes at all
      baseFare = Math.round(300 * getClassMultiplier(classType));
    }
  }

  const reservationCharge = Number(selectedClass?.reservationCharge ?? getReservationCharge(classType));
  const superfastSurcharge = /superfast|rajdhani|shatabdi/i.test(train.trainName) ? 45 : 0;

  const tatkalEligible = Number.isFinite(daysUntilJourney(date)) && daysUntilJourney(date) <= 2;
  const tatkalSurcharge = tatkalEligible ? Math.round(baseFare * getTatkalRate(classType)) : 0;
  const subtotal = baseFare + reservationCharge + superfastSurcharge + tatkalSurcharge;
  const gstRate = subtotal < 250 ? 0.05 : 0.12;
  const gst = Math.round(subtotal * gstRate);
  const total = subtotal + gst;

  return {
    trainNo: train.trainNo,
    trainName: train.trainName,
    classType: selectedClass?.type || classType,
    baseFare,
    reservationCharge,
    superfastSurcharge,
    tatkalSurcharge,
    gst,
    gstRate,
    total,
    availability: availability || null,
  };
}
