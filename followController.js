const db = require('./db.js');

async function followUser(follower, followee) {
    const sql = "INSERT INTO follows (follower, followee) VALUES (?, ?)";
    const [result] = await db.query(sql, [follower, followee]);
    return result.affectedRows === 1;
}

async function unfollowUser(follower, followee) {
    const sql = "DELETE FROM follows WHERE follower = ? AND followee = ?";
    const [result] = await db.query(sql, [follower, followee]);
    return result.affectedRows === 1;
}

async function getFollowerCount(username) {
    const sql = "SELECT COUNT(*) AS cnt FROM follows WHERE followee = ?";
    const [rows] = await db.query(sql, [username]);
    return rows[0].cnt;
}

async function getFollowingCount(username) {
    const sql = "SELECT COUNT(*) AS cnt FROM follows WHERE follower = ?";
    const [rows] = await db.query(sql, [username]);
    return rows[0].cnt;
}

async function isFollowing(follower, followee) {
    const sql = "SELECT 1 FROM follows WHERE follower = ? AND followee = ? LIMIT 1";
    const [rows] = await db.query(sql, [follower, followee]);
    return rows.length > 0;
}

async function isFollowed(followee, follower) {
    // check: follower → followee
    const sql = "SELECT 1 FROM follows WHERE follower = ? AND followee = ? LIMIT 1";
    const [rows] = await db.query(sql, [follower, followee]);
    return rows.length > 0;
}

module.exports = {
    followUser,
    unfollowUser,
    getFollowerCount,
    getFollowingCount,
    isFollowing,
    isFollowed
};
