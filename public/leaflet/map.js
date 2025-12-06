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

async function renderTripsOnMap() {
    markers.forEach(marker => map.removeLayer(marker)); // reset markers
    markers = []; // " "
    const trips = await loadTrips();
    const today = new Date(); // vandaag
    const filterWish = document.getElementById('filter-wishlist').checked; // filter voor checkbox
    const filterVisited = document.getElementById('filter-visited').checked;

    for (let i = 0; i < trips.length; i++) {

        const trip = trips[i];

        const status = new Date(trip.date) < today ? 'visited' : 'wishlist' ; // als plan date < today => visited, anders wishlist

        if ((status == 'visited' && !filterVisited) || (status == 'wishlist' && !filterWish)){
            continue;
        }
        
        const coords = await geocodeLocation(trip.country, trip.city);

        if (coords) {
            const marker = L.marker([coords.lat, coords.lon], {
                icon: status == 'visited' ? visitedIcon : wishIcon}).addTo(map);
            markers.push(marker); // voeg marker too aan de lijst
            const dateString = new Date(trip.date).toLocaleDateString("nl-BE");

            marker.bindPopup(`
                <strong>${trip.country}</strong><br>
                ${trip.city}<br>
                ${dateString}<br>
                ${trip.activity}<br>
                Status: ${status}
            `);
        }

    }
}

renderTripsOnMap();
document.getElementById('filter-wishlist').addEventListener('change', renderTripsOnMap);
document.getElementById('filter-visited').addEventListener('change', renderTripsOnMap);
