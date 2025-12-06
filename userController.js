const db = require('./db.js');

async function findUserInfoByUsername(name){
   const sql = "SELECT * FROM users WHERE username = ? ";
   const [info] = await db.query(sql, [name]);
   return info[0];
}

async function AddUser(values , res){
    const sql = "INSERT INTO users (firstName, lastName, email, username, password) VALUES (?, ?, ?, ?, ?)";
    const [user] = await db.query(sql , values);
    return user.affectedRows === 1;
}

async function DeleteUser(values , res){
    const sql = "DELETE INTO users (firstName, lastName, email, username, password ) VALUES(?)";
    const [user] = await db.query(sql , [values]);
    return user.affectedRows === 1;
}

async function UpdateUser(username, fieldOrFields, value) {
    const allowed = ["firstName", "lastName", "email", "username", "profilePic", "privacy"];

    // een enkel veld 
    if (typeof fieldOrFields === 'string') {
        if (!allowed.includes(fieldOrFields)) return;
        const sql = `UPDATE users SET ${fieldOrFields} = ? WHERE username = ?`;
        await db.query(sql, [value, username]);
        return;
    }

    // meerdere
    const updates = [];
    const values = [];

    for (const key in fieldOrFields) {
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

    if (!info) return false;   // user bestaat niet

    const dbPassword = info.password;
    return password === dbPassword;
}


module.exports = {
    findUserInfoByUsername,
    AddUser,
    UpdateUser,
    ValidateLogin
};
