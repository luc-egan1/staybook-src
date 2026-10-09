CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  hotel_id INT NOT NULL,
  room_id INT NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(160),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_res_room_dates ON reservations (room_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_res_hotel_dates ON reservations (hotel_id, check_in, check_out);

INSERT INTO reservations (hotel_id, room_id, customer_name, customer_email, check_in, check_out) VALUES
(1, 1, 'Jean Dupont', 'jean.dupont@example.com', CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '6 days'),
(2, 5, 'Marie Curie', 'marie.curie@example.com', CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '14 days'),
(3, 8, 'Paul Martin', 'paul.martin@example.com', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '5 days');
