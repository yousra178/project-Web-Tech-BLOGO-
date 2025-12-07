const db = require('./db'); // Importeer de MySQL pool

// Check of een post is opgeslagen door een user
async function isPostSavedByUser(username, postId) {
    const query = 'SELECT 1 FROM saved_posts WHERE username = ? AND post_id = ?';
    const [rows] = await db.query(query, [username, postId]);
    return rows.length > 0; // true als er een row is, false als niet
}

// Post opslaan
async function savePostForUser(username, postId) {
    try {
        const query = 'INSERT INTO saved_posts (username, post_id) VALUES (?, ?)';
        await db.query(query, [username, postId]);
    } catch (err) {
        // Als post al is opgeslagen (duplicate key error), negeer de error
        if (err.code !== 'ER_DUP_ENTRY') {
            throw err;
        }
    }
}

// Post unsaven
async function unsavePostForUser(username, postId) {
    const query = 'DELETE FROM saved_posts WHERE username = ? AND post_id = ?';
    await db.query(query, [username, postId]);
}

// Alle opgeslagen posts van een user ophalen
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
    
    // Converteer images string naar array
    return posts.map(post => ({
        ...post,
        images: post.images ? post.images.split(',') : []
    }));
}

// Exporteer alle functies
module.exports = {
    isPostSavedByUser,
    savePostForUser,
    unsavePostForUser,
    getSavedPostsForUser
};
