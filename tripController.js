const db = require('./db.js');

async function addTrip(values) {
    const sql = "INSERT INTO trips (username, country, city, date, activity) VALUES (?)";
    const [result] = await db.query(sql, [values]);
    return result.affectedRows === 1;
}

async function getTripsForUser(username) {
    const sql = "SELECT * FROM trips WHERE username = ?";
    const [rows] = await db.query(sql, [username]);
    return rows;
}

async function deleteTrip(id, username) {
  const sql = "DELETE FROM trips WHERE id = ? AND username = ?";
  const [result] = await db.query(sql, [id, username]);
  return result.affectedRows === 1;
}

async function renameTripsUser(oldUsername, newUsername) {
    const sql = "UPDATE trips SET username = ? WHERE username = ?";
    await db.query(sql, [newUsername, oldUsername]);
}

module.exports = {
    addTrip,
    getTripsForUser,
    deleteTrip,
    renameTripsUser
};
