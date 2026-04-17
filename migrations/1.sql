
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  source_location TEXT NOT NULL,
  destination_location TEXT NOT NULL,
  distance REAL NOT NULL,
  duration TEXT NOT NULL,
  transport_type TEXT NOT NULL,
  fare INTEGER NOT NULL,
  status TEXT DEFAULT 'confirmed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);
