var map = L.map('map').setView([0, 0], 2);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

let markers = []; // later aangepast (niet const)

const visitedIcon = L.icon({
    iconUrl : 'https://maps.google.com/mapfiles/ms/icons/pink-dot.png',
    iconSize:     [32, 32], 
    iconAnchor:   [22, 32], 
    popupAnchor:  [-3, -32] 
});

const wishIcon = L.icon({
    iconUrl : 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
    iconSize:     [32, 32], 
    iconAnchor:   [22, 32], 
    popupAnchor:  [-3, -32] 
});

async function loadTrips() {
    const res = await fetch('/api/trips');
    return await res.json();
}


async function geocodeLocation(country, city) {
    const query = encodeURIComponent(city + " " + country);

    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    const res = await fetch(url, { headers: { 'User-Agent': 'GloboApp/1.0' } });
    const data = await res.json();

    if (data.length === 0) {
        return null;
    }

    return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
    };
}

const tripColors = [
     'pink', 'ltblue', 'purple', 'green', 'blue','red'
];

function getTripColor(tripId) {
    return tripColors[tripId % tripColors.length]; 
}

function createTripIcon(color) {
    return L.icon({
        iconUrl: `https://maps.google.com/mapfiles/ms/icons/${color}-dot.png`,
        iconSize: [32, 32],
        iconAnchor: [22, 32],
        popupAnchor: [-3, -32]
    });
}

async function renderTripsOnMap() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    const trips = await loadTrips();
    const today = new Date();
    const filterWish = document.getElementById('filter-wishlist').checked;
    const filterVisited = document.getElementById('filter-visited').checked;

    updateMapStats(trips);

    for (const trip of trips) {
        const color = getTripColor(trip.id); 
        const tripIcon = createTripIcon(color);

        for (const loc of trip.locations) {
            const status = loc.visited ? 'visited' : 'wishlist';
            
            if ((status === 'visited' && !filterVisited) || (status === 'wishlist' && !filterWish)) {
                continue;
            }

            const coords = await geocodeLocation(loc.country, loc.city);
            if (!coords) continue;

            const marker = L.marker([coords.lat, coords.lon], { icon: tripIcon }).addTo(map);
            markers.push(marker);

            const dateString = new Date(loc.date).toLocaleDateString("nl-BE");

            marker.bindPopup(`
                <strong>${loc.country}</strong><br>
                ${loc.city}<br>
                ${dateString}<br>
                ${loc.activity}<br>
                Status: ${status}
            `);
        }
    }
    updateMapStats(trips);
}

renderTripsOnMap();
document.getElementById('filter-wishlist').addEventListener('change', renderTripsOnMap);
document.getElementById('filter-visited').addEventListener('change', renderTripsOnMap);

function updateMapStats(trips) {
    let total = 0;
    let visited = 0;
    let wishlist = 0;

    trips.forEach(trip => {
        trip.locations.forEach(loc => {
            total++;
            if (loc.visited) visited++;
            else wishlist++;
        });
    });

    document.getElementById('total-locations').textContent = `Total Locations: ${total}`;
    document.getElementById('visited-count').textContent = `Visited: ${visited}`;
    document.getElementById('wishlist-count').textContent = `Wishlist: ${wishlist}`;
}
