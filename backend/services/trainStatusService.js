function createSeedNumber(input) {
  return String(input)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export async function getPnrStatus(pnr) {
  // Uses robust deterministic simulation since live PNR APIs are restricted
  const seed = createSeedNumber(pnr);
  const confirmed = seed % 2 === 0;

  return {
    pnr,
    trainNo: `12${String(seed % 900).padStart(3, "0")}`,
    passengers: [
      {
        passenger: 1,
        bookingStatus: confirmed ? "CNF" : "WL/4",
        currentStatus: confirmed ? "CNF" : "RAC/1",
        coach: confirmed ? "S3" : null,
        berth: confirmed ? `4${seed % 10}` : null,
      },
    ],
    chartPrepared: confirmed,
    source: "simulated",
  };
}

export async function getTrainLiveStatus(trainNo, date) {
  // Uses robust deterministic simulation since live Status APIs are restricted
  const seed = createSeedNumber(`${trainNo}${date}`);
  return {
    trainNo,
    date,
    delayMinutes: seed % 48,
    currentStation: seed % 2 === 0 ? "Kanpur" : "Agra",
    currentLocation: {
      lat: 27.2 + (seed % 10) * 0.11,
      lng: 77.8 + (seed % 10) * 0.12,
    },
    status: seed % 3 === 0 ? "Running right time" : "Running with minor delay",
    source: "simulated",
  };
}

