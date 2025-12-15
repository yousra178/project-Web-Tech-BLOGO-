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


async function getRootCommentsForPost(postId){
    const sql = `
        SELECT * 
        FROM comments 
        WHERE post_id = ? AND parent_id is NULL
        ORDER BY created_at DESC
    `;
    const [comments] = await db.query(sql, [postId]);

    return comments;

}

async function getRepliesForComment(commentId){
    const sql = `
        SELECT * 
        FROM comments 
        WHERE parent_id = ?
        ORDER BY created_at DESC
    `;
    const [comments] = await db.query(sql, [commentId]);

    return comments;

}

async function addComment(post_id, username, caption , parent_id) {
    const sql = "INSERT INTO comments (post_id, username, caption , parent_id) VALUES (?, ?, ? , ?)";
    const [result] = await db.query(sql, [post_id, username, caption , parent_id]);

    return result.insertId; 
}

async function deleteComment(id, username) {
    console.log("=== DELETE COMMENT DEBUG ===");
    console.log("Received ID:", id);
    console.log("Received username:", username);

    const sql = "DELETE FROM comments WHERE id = ? AND username = ?";
    console.log("SQL Query:", sql);
    console.log("SQL Params:", [id, username]);

    const [result] = await db.query(sql, [id, username]);

    console.log("DB Result:", result);
    console.log("Affected rows:", result.affectedRows);
    console.log("=== END DEBUG ===");

    return result.affectedRows === 1;
}



async function updateComment(comment_id, username, caption) {
    console.log("=== UPDATE COMMENT DB DEBUG ===");
    console.log("comment_id:", comment_id);
    console.log("username:", username);
    console.log("caption:", caption);

    const sql = `
        UPDATE comments
        SET caption = ?
        WHERE id = ? AND username = ?
    `;
    console.log("SQL:", sql);
    console.log("Params:", [caption, comment_id, username]);

    const [result] = await db.query(sql, [caption, comment_id, username]);

    console.log("DB Result:", result);
    console.log("Affected rows:", result.affectedRows);
    console.log("=== END DB DEBUG ===");

    return result.affectedRows === 1;
}

//haal profil picture van de user dat het post heeft gemaakt 
async function getProfilPictureForPost(postId) {

    const sql = `
        SELECT u.profilePic
        FROM users u
        JOIN posts p ON u.username = p.username
        WHERE p.id = ?
    `;

    const [rows] = await db.query(sql, [postId]);

    return rows.length > 0 ? rows[0].profilePic : null;
}



module.exports = {
    addPost,
    getPostsForUser,
    getAllPosts,
    deletePost,
    renamePostsUser,
    getRootCommentsForPost,
    getRepliesForComment,
    addComment,
    deleteComment,
    updateComment,
    getProfilPictureForPost
};
