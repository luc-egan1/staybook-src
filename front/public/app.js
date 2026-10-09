const API = '/api';

const state = {
  from: null,
  to: null,
  hotels: [],
  availability: [],
};

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function stars(n) {
  return '*'.repeat(n);
}

async function loadHotels() {
  const resp = await fetch(`${API}/hotels`);
  state.hotels = await resp.json();
}

async function loadAvailability() {
  const url = `${API}/availability/all?from=${state.from}&to=${state.to}`;
  const resp = await fetch(url);
  state.availability = await resp.json();
}

function availabilityFor(hotelId) {
  const entry = state.availability.find(a => a.hotel.id === hotelId);
  return entry ? entry.available_rooms : [];
}

function renderHotels() {
  const grid = document.getElementById('hotel-list');
  grid.innerHTML = '';
  for (const h of state.hotels) {
    const rooms = availabilityFor(h.id);
    const card = document.createElement('div');
    card.className = 'hotel-card';
    card.innerHTML = `
      <img src="${h.image_url}" alt="${h.name}">
      <div class="hotel-body">
        <div class="hotel-name">${h.name}</div>
        <div class="hotel-meta">${h.city} - <span class="stars">${stars(h.stars)}</span></div>
        <div class="hotel-desc">${h.description}</div>
        <div class="dispo ${rooms.length === 0 ? 'none' : ''}">
          ${rooms.length === 0
            ? 'Aucune chambre disponible'
            : `${rooms.length} chambre(s) disponible(s) a partir de ${Math.min(...rooms.map(r => r.price_per_night))} EUR`}
        </div>
        <button data-id="${h.id}">Voir les chambres</button>
      </div>
    `;
    card.querySelector('button').addEventListener('click', () => openModal(h));
    grid.appendChild(card);
  }
}

function openModal(hotel) {
  document.getElementById('modal-hotel-name').textContent = hotel.name;
  document.getElementById('modal-period').textContent = `Du ${state.from} au ${state.to}`;
  const rooms = availabilityFor(hotel.id);
  const container = document.getElementById('modal-rooms');
  container.innerHTML = '';
  if (rooms.length === 0) {
    container.innerHTML = '<p>Aucune chambre disponible sur cette periode.</p>';
  } else {
    for (const r of rooms) {
      const row = document.createElement('div');
      row.className = 'room-row';
      row.innerHTML = `
        <div>
          <div><strong>${r.type}</strong></div>
          <div style="font-size:12px;color:#6b7280">Capacite ${r.capacity} - ${r.price_per_night} EUR/nuit</div>
        </div>
        <form data-room="${r.id}" data-hotel="${hotel.id}">
          <input name="name" placeholder="Votre nom" required>
          <input name="email" placeholder="Email" type="email">
          <button type="submit">Reserver</button>
        </form>
      `;
      row.querySelector('form').addEventListener('submit', onReserve);
      container.appendChild(row);
    }
  }
  document.getElementById('reservation-modal').classList.remove('hidden');
}

async function onReserve(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const payload = {
    hotel_id: parseInt(form.dataset.hotel, 10),
    room_id: parseInt(form.dataset.room, 10),
    customer_name: form.name.value,
    customer_email: form.email.value,
    check_in: state.from,
    check_out: state.to,
  };
  const resp = await fetch(`${API}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (resp.ok) {
    alert('Reservation confirmee !');
    await loadAvailability();
    renderHotels();
    document.getElementById('reservation-modal').classList.add('hidden');
  } else {
    const err = await resp.json().catch(() => ({}));
    alert('Echec: ' + (err.error || resp.status));
  }
}

document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('reservation-modal').classList.add('hidden');
});

document.getElementById('apply').addEventListener('click', async () => {
  state.from = document.getElementById('from').value;
  state.to = document.getElementById('to').value;
  if (!state.from || !state.to) return;
  await loadAvailability();
  renderHotels();
});

// Chat
const chatToggle = document.getElementById('chat-toggle');
const chatPanel = document.getElementById('chat-panel');
const chatClose = document.getElementById('chat-close');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

chatToggle.addEventListener('click', () => {
  chatPanel.classList.remove('hidden');
  chatToggle.style.display = 'none';
});
chatClose.addEventListener('click', () => {
  chatPanel.classList.add('hidden');
  chatToggle.style.display = '';
});

function addMessage(role, text, sources) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  if (sources && sources.length) {
    const wrap = document.createElement('div');
    wrap.className = 'sources';
    for (const s of sources.slice(0, 3)) {
      const card = document.createElement('div');
      card.className = 'source-card';
      card.innerHTML = `
        <img src="${s.image_url}" alt="${s.name}">
        <div>
          <div><strong>${s.name}</strong></div>
          <div style="color:#6b7280">${s.city}</div>
        </div>
      `;
      wrap.appendChild(card);
    }
    div.appendChild(wrap);
  }
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage('user', text);
  chatInput.value = '';
  const loading = document.createElement('div');
  loading.className = 'msg bot loading';
  loading.textContent = 'Le concierge reflechit...';
  chatMessages.appendChild(loading);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const resp = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, from: state.from, to: state.to }),
    });
    const data = await resp.json();
    loading.remove();
    addMessage('bot', data.answer || 'Pas de reponse.', data.sources);
  } catch (err) {
    loading.remove();
    addMessage('bot', 'Erreur: ' + err.message);
  }
});

(async function init() {
  document.getElementById('from').value = todayPlus(1);
  document.getElementById('to').value = todayPlus(4);
  state.from = todayPlus(1);
  state.to = todayPlus(4);
  await loadHotels();
  await loadAvailability();
  renderHotels();
  addMessage('bot', 'Bonjour ! Je suis votre concierge. Demandez-moi par exemple : "Une chambre pour 2 a Paris ce week-end".');
})();
