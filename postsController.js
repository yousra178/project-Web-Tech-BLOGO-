const db = require('./db.js');

async function addPost(username, caption, imagePaths) {
    const sqlPost = "INSERT INTO posts (username, caption) VALUES (?, ?)";
    const [result] = await db.query(sqlPost, [username, caption]);
    const postId = result.insertId;

    if (imagePaths && imagePaths.length > 0) {
        const sqlImages = "INSERT INTO post_images (post_id, image_path) VALUES ?";
        const imageValues = imagePaths.map(path => [postId, path]);
        await db.query(sqlImages, [imageValues]);
    }

    return postId;
}

async function getPostsForUser(username) {
    const sql = `
        SELECT p.*, GROUP_CONCAT(pi.image_path) as images 
        FROM posts p 
        LEFT JOIN post_images pi ON p.id = pi.post_id 
        WHERE p.username = ? 
        GROUP BY p.id 
        ORDER BY p.created_at DESC
    `;
    const [posts] = await db.query(sql, [username]);

    return posts.map(post => ({
        ...post,
        images: post.images ? post.images.split(',') : []
    }));
}

async function getAllPosts(viewerUsername) {
    const sql = `
        SELECT p.*, GROUP_CONCAT(pi.image_path) as images 
        FROM posts p 
        LEFT JOIN users u ON u.username = p.username
        LEFT JOIN post_images pi ON p.id = pi.post_id 
        WHERE u.privacy = 'public' OR p.username = ?
        GROUP BY p.id 
        ORDER BY p.created_at DESC
    `;
    const [posts] = await db.query(sql, [viewerUsername || '']);

    return posts.map(post => ({
        ...post,
        images: post.images ? post.images.split(',') : []
    }));
}

async function deletePost(id, username) {
    const sql = "DELETE FROM posts WHERE id = ? AND username = ?";
    const [result] = await db.query(sql, [id, username]);
    return result.affectedRows === 1;
}

async function renamePostsUser(oldUsername, newUsername) {
    await db.query("UPDATE posts SET username = ? WHERE username = ?", [newUsername, oldUsername]);
}

module.exports = {
    addPost,
    getPostsForUser,
    getAllPosts,
    deletePost,
    renamePostsUser
};
