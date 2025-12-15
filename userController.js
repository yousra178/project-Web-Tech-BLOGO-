const db = require('./db.js'); // Import MYSQL pool


async function findUserInfoByUsername(name){
   const sql = "SELECT * FROM users WHERE username = ? ";
   const [info] = await db.query(sql, [name]);
   return info[0];
}

// Add the current user, during registration
async function AddUser(values , res){
    const sql = "INSERT INTO users (firstName, lastName, email, username, password) VALUES (?, ?, ?, ?, ?)";
    await db.query(sql , values);

}

// Delete the current user
async function DeleteUser(username) {
    const sql = "DELETE FROM users WHERE username = ?";
    return db.query(sql, [username]);
}

// Update the changes after editing the profile
async function UpdateUser(username, fieldOrFields, value) {
    const allowed = ["firstName", "lastName", "email", "username", "profilePic", "privacy"];

    if (typeof fieldOrFields === 'string') { // One field
        if (!allowed.includes(fieldOrFields)) return;
        const sql = `UPDATE users SET ${fieldOrFields} = ? WHERE username = ?`;
        await db.query(sql, [value, username]);
        return;
    }

    const updates = [];
    const values = [];

    for (const key in fieldOrFields) {       // multiple fields
        if (allowed.includes(key) && fieldOrFields[key]) {
            updates.push(`${key} = ?`);
            values.push(fieldOrFields[key]);
        }
    }

    if (updates.length === 0) return;

    const sql = `UPDATE users SET ${updates.join(", ")} WHERE username = ?`;
    values.push(username);

    await db.query(sql, values);
}


async function ValidateLogin(username, password) {
    const info = await findUserInfoByUsername(username);

    if (!info) return false;   // user doens't exist

    const dbPassword = info.password;
    return password === dbPassword;
}

// Export functions
module.exports = {
    findUserInfoByUsername,
    AddUser,
    DeleteUser,
    UpdateUser,
    ValidateLogin
};
