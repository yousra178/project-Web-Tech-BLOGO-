const db = require('./db'); // Import the MySQL pool

// Check if a post is saved by a user
async function isPostSavedByUser(username, postId) {
    const query = 'SELECT 1 FROM saved_posts WHERE username = ? AND post_id = ?';
    const [rows] = await db.query(query, [username, postId]);
    return rows.length > 0; // true if it's a row (it exists), else false
}

// Save post
async function savePostForUser(username, postId) {
    const query = 'INSERT INTO saved_posts (username, post_id) VALUES (?, ?)';
    await db.query(query, [username, postId]);
}

// Unsave post 
async function unsavePostForUser(username, postId) {
    const query = 'DELETE FROM saved_posts WHERE username = ? AND post_id = ?';
    await db.query(query, [username, postId]);
}

// Get all the saved posts of a user 
async function getSavedPostsForUser(username) {
    const sql = `
        SELECT p.*, GROUP_CONCAT(pi.image_path) as images 
        FROM saved_posts sp
        JOIN posts p ON sp.post_id = p.id 
        LEFT JOIN post_images pi ON p.id = pi.post_id 
        WHERE sp.username = ? 
        GROUP BY p.id 
        ORDER BY p.created_at DESC
    `;
    const [posts] = await db.query(sql, [username]);

    //Convert imgs string to array (to use foreach etc)
    return posts.map(post => ({
        ...post,
        images: post.images ? post.images.split(',') : []
    }));
}

// Export all functions
module.exports = {
    isPostSavedByUser,
    savePostForUser,
    unsavePostForUser,
    getSavedPostsForUser
};
