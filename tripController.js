const db = require('./db.js'); // Import MYSQL pool

// Add a trip to database
async function addTrip(username, title, description, budget, currency, status) {
    const sql = "INSERT INTO trips (username, title, description, budget, currency, status) VALUES (?, ?, ?, ?, ?, ?)";
    await db.query(sql, [username, title, description, budget, currency, status]);
}

// Add trip with location to database
async function addTripLocation(tripId, country, city, date, activity, order) {
    const sql = `
        INSERT INTO trip_locations (trip_id, country, city, date, activity, order_index)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    await db.query(sql, [tripId, country, city, date, activity, order]);
}

// Get trips where the user is the owner or a participant
async function getTripsForUser(username) {
    const [trips] = await db.query(`
        SELECT DISTINCT t.*
        FROM trips t
        LEFT JOIN trip_participants tp ON t.id = tp.trip_id
        WHERE t.username = ? OR tp.username = ?
    `, [username, username]);

    for (const trip of trips) {
        const [locations] = await db.query(       // Get locations
            "SELECT * FROM trip_locations WHERE trip_id = ? ORDER BY order_index",
            [trip.id]
        );
        trip.locations = locations;

        const [participants] = await db.query(    // Get participants
            `SELECT tp.*, u.firstName, u.lastName 
             FROM trip_participants tp 
             JOIN users u ON tp.username = u.username 
             WHERE tp.trip_id = ?`,
            [trip.id]
        );
        trip.participants = participants;
    }
    return trips;
}

async function getPublishedTripsForUser(username) {
    const [trips] = await db.query(`
        SELECT DISTINCT t.*
        FROM trips t
        LEFT JOIN trip_participants tp ON t.id = tp.trip_id
        WHERE (t.username = ? OR tp.username = ?)
        AND t.status = 'published'
    `, [username, username]);

    for (const trip of trips) {
        const [locations] = await db.query(       // Get locations
            "SELECT * FROM trip_locations WHERE trip_id = ? ORDER BY order_index",
            [trip.id]
        );
        trip.locations = locations;

        const [participants] = await db.query(    // Get participants
            `SELECT tp.*, u.firstName, u.lastName 
             FROM trip_participants tp 
             JOIN users u ON tp.username = u.username 
             WHERE tp.trip_id = ?`,
            [trip.id]
        );
        trip.participants = participants;
    }
    return trips;
}

// Edit an existing trip 
async function editTrip(tripId, username, title, description, budget, currency, locations, participants, status) {
    const conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
        'SELECT username FROM trips WHERE id = ?', // If user part of trip
        [tripId]
    );

    const owner = rows[0].username;

    const [participantRows] = await conn.query(
        'SELECT username FROM trip_participants WHERE trip_id = ? AND username = ?',  // Check if user is owner or participant
        [tripId, username]
    );
    if (username !== owner && participantRows.length === 0) {
        throw new Error('Not authorized');
    }

    await conn.query(
        'UPDATE trips SET title = ?, description = ?, budget = ?, currency = ?, status = ? WHERE id = ?', // Update title, description, budget, currency and status
        [title, description, budget, currency, status, tripId]
    );

    await conn.query('DELETE FROM trip_locations WHERE trip_id = ?', [tripId]); // Delete existing locations 
    for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        const dateValue = loc.date && loc.date.trim() !== '' ? loc.date : null;

        const visited = loc.visited || false;

        await conn.query(
            'INSERT INTO trip_locations (trip_id, country, city, date, activity, order_index, visited) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [tripId, loc.country, loc.city, dateValue, loc.activity, i, visited] // add new locations
        );
    }

    if (username === owner) {
        await conn.query('DELETE FROM trip_participants WHERE trip_id = ?', [tripId]); // Only owner can modify participants

        await conn.query(
            'INSERT INTO trip_participants (trip_id, username, role) VALUES (?, ?, ?)', // re-add owner (else error of duplicates)
            [tripId, username, 'owner']
        );

        if (participants && participants.length > 0) {
            for (const participant of participants) {
                if (participant === username) continue;
                await conn.query(
                    'INSERT INTO trip_participants (trip_id, username, role) VALUES (?, ?, ?)', // Add new participants
                    [tripId, participant, 'editor']
                );
            }
        }
    }

    await conn.commit();
    return true;

}

// Delete an existing trip
async function deleteTrip(id, username) {
    const sql = "DELETE FROM trips WHERE id = ? AND username = ?";
    await db.query(sql, [id, username]);
}

// Update change of usernames
async function renameTripsUser(oldUsername, newUsername) {
    const sql = "UPDATE trips SET username = ? WHERE username = ?";
    await db.query(sql, [newUsername, oldUsername]);
}

// Create collaborative trip (= with other participants)
async function createCollaborativeTrip(username, title, description, budget, currency, locations, participants, status) {
    const conn = await db.getConnection();
    await conn.beginTransaction();

    // Create main trip
    const [result] = await conn.query(
        'INSERT INTO trips (username, title, description, budget, currency, status) VALUES (?, ?, ?, ?, ?, ?)',
        [username, title, description, budget, currency, status]
    );
    const tripId = result.insertId;

    // Add owner as participant
    await conn.query(
        'INSERT INTO trip_participants (trip_id, username, role) VALUES (?, ?, ?)',
        [tripId, username, 'owner']
    );

    // Add other participants
    if (participants && Array.isArray(participants) && participants.length > 0) {
        for (const participant of participants) {
            await conn.query(
                'INSERT INTO trip_participants (trip_id, username, role) VALUES (?, ?, ?)',
                [tripId, participant, 'editor']
            );
        }
    }
    // Add locations
    for (let i = 0; i < locations.length; i++) {
        const dateValue = locations[i].date && locations[i].date.trim() !== '' // empty date string => null
            ? locations[i].date
            : null;

        const visited = locations[i].visited || false;

        await conn.query(
            'INSERT INTO trip_locations (trip_id, country, city, date, activity, order_index, visited) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [tripId, locations[i].country, locations[i].city, dateValue, locations[i].activity, i, visited]
        );
    }
    await conn.commit();
    return tripId;
}

// Get trip with locations and participants
async function getTripDetails(tripId) {
    const [trips] = await db.query('SELECT * FROM trips WHERE id = ?', [tripId]);
    if (trips.length === 0) return null;

    const trip = trips[0];

    // Get locations
    const [locations] = await db.query(
        'SELECT * FROM trip_locations WHERE trip_id = ? ORDER BY order_index',
        [tripId]
    );

    // Get participants
    const [participants] = await db.query(
        'SELECT tp.*, u.firstName, u.lastName FROM trip_participants tp JOIN users u ON tp.username = u.username WHERE tp.trip_id = ?',
        [tripId]
    );

    trip.locations = locations;
    trip.participants = participants;

    return trip;
}

// Add chat message
async function addTripMessage(tripId, username, message) {
    await db.query(
        'INSERT INTO trip_messages (trip_id, username, message) VALUES (?, ?, ?)',
        [tripId, username, message]
    );
}

// Get chat messages
async function getTripMessages(tripId) {
    const [messages] = await db.query(
        'SELECT tm.*, u.firstName, u.lastName FROM trip_messages tm JOIN users u ON tm.username = u.username WHERE tm.trip_id = ? ORDER BY tm.created_at ASC',
        [tripId]
    );
    return messages;
}

// Get all the posts from the database (from each user)
async function getAllTrips() {
        const [trips] = await db.query(`
        SELECT DISTINCT t.*
        FROM trips t
        LEFT JOIN trip_participants tp ON t.id = tp.trip_id
        WHERE status = 'published';
        `);

    for (const trip of trips) {
        const [locations] = await db.query(       // Get locations
            "SELECT * FROM trip_locations WHERE trip_id = ? ORDER BY order_index",
            [trip.id]
        );
        trip.locations = locations;

        const [participants] = await db.query(    // Get participants
            `SELECT tp.*, u.firstName, u.lastName 
             FROM trip_participants tp 
             JOIN users u ON tp.username = u.username 
             WHERE tp.trip_id = ?`,
            [trip.id]
        );
        trip.participants = participants;
    }
    return trips;
}

// Export functions
module.exports = {
    addTrip,
    addTripLocation,
    getTripsForUser,
    getPublishedTripsForUser,
    editTrip,
    deleteTrip,
    renameTripsUser,
    createCollaborativeTrip,
    getTripDetails,
    addTripMessage,
    getTripMessages,
    getAllTrips
};
