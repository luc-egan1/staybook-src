CREATE TABLE IF NOT EXISTS hotels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(80) NOT NULL,
  stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  description TEXT NOT NULL,
  image_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  hotel_id INT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  capacity INT NOT NULL,
  price_per_night NUMERIC(10,2) NOT NULL
);

INSERT INTO hotels (name, city, stars, description, image_url) VALUES
('Le Grand Paris', 'Paris', 5, 'Palace au coeur de Paris, vue sur la tour Eiffel, spa, restaurant etoile.', 'https://images.unsplash.com/photo-1455587734955-081b22074882?w=800'),
('Hotel du Vieux Port', 'Marseille', 4, 'Hotel de charme face au vieux port, terrasse panoramique, cuisine provencale.', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'),
('Chalet des Alpes', 'Chamonix', 4, 'Chalet authentique au pied du Mont-Blanc, sauna, acces direct aux pistes.', 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800'),
('Riviera Palace', 'Nice', 5, 'Hotel art-deco sur la Promenade des Anglais, piscine a debordement, plage privee.', 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800'),
('Loire Castel', 'Tours', 3, 'Demeure du XVIIIe siecle au coeur des chateaux de la Loire, parc arbore.', 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800'),
('Atlantique Resort', 'Biarritz', 4, 'Resort face a l ocean, ecole de surf, spa marin et restaurant gastronomique.', 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800');

INSERT INTO rooms (hotel_id, type, capacity, price_per_night) VALUES
(1, 'Suite Eiffel', 2, 850.00),
(1, 'Suite Eiffel', 2, 850.00),
(1, 'Chambre Deluxe', 2, 480.00),
(1, 'Chambre Familiale', 4, 620.00),
(2, 'Chambre Vue Port', 2, 220.00),
(2, 'Chambre Vue Port', 2, 220.00),
(2, 'Suite Junior', 3, 340.00),
(3, 'Chambre Montagne', 2, 280.00),
(3, 'Chambre Montagne', 2, 280.00),
(3, 'Chalet Familial', 6, 540.00),
(4, 'Suite Mediterranee', 2, 720.00),
(4, 'Chambre Vue Mer', 2, 410.00),
(4, 'Chambre Vue Mer', 2, 410.00),
(5, 'Chambre Classique', 2, 145.00),
(5, 'Chambre Classique', 2, 145.00),
(5, 'Chambre Familiale', 4, 210.00),
(6, 'Chambre Ocean', 2, 320.00),
(6, 'Chambre Ocean', 2, 320.00),
(6, 'Suite Surf', 3, 460.00);
