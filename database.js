const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite3');
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");
});

// Helper functions using Promises
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function initDb() {
  // Create users table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_verified INTEGER DEFAULT 0,
      verification_code TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create items table
  await run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create messages table
  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create friends table
  await run(`
    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Safe migration check
  const columns = await all("PRAGMA table_info(users)");
  const colNames = columns.map(c => c.name);

  if (!colNames.includes('avatar_url')) {
    await run("ALTER TABLE users ADD COLUMN avatar_url TEXT");
    console.log("[DB Migration] Added avatar_url to users.");
  }
  if (!colNames.includes('banner_url')) {
    await run("ALTER TABLE users ADD COLUMN banner_url TEXT");
    console.log("[DB Migration] Added banner_url to users.");
  }

  const itemCols = await all("PRAGMA table_info(items)");
  const itemColNames = itemCols.map(c => c.name);
  if (!itemColNames.includes('recipient_id')) {
    await run("ALTER TABLE items ADD COLUMN recipient_id INTEGER REFERENCES users(id)");
    console.log("[DB Migration] Added recipient_id to items.");
  }

  console.log("Database initialized successfully.");
}

// ==================== USER OPERATIONS ====================

async function createUser(name, email, passwordHash, verificationCode) {
  try {
    const result = await run(
      "INSERT INTO users (name, email, password_hash, verification_code) VALUES (?, ?, ?, ?)",
      [name, email, passwordHash, verificationCode]
    );
    return result.id;
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return null;
    }
    throw err;
  }
}

async function getUserByEmail(email) {
  return await get("SELECT * FROM users WHERE email = ?", [email]);
}

async function getUserById(userId) {
  return await get("SELECT * FROM users WHERE id = ?", [userId]);
}

async function verifyUser(email, code) {
  const user = await get("SELECT * FROM users WHERE email = ?", [email]);
  if (user && user.verification_code === code) {
    await run("UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?", [user.id]);
    return true;
  }
  return false;
}

async function updateUserProfile(userId, name, avatarUrl = null, bannerUrl = null) {
  const updates = ["name = ?"];
  const params = [name];

  if (avatarUrl !== null) {
    updates.append ? null : updates.push("avatar_url = ?");
    params.push(avatarUrl);
  }
  if (bannerUrl !== null) {
    updates.push("banner_url = ?");
    params.push(bannerUrl);
  }

  params.push(userId);
  await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
}

async function searchUsers(currentUserId, query) {
  const searchPattern = `%${query}%`;
  return await all(
    `SELECT id, name, email, avatar_url FROM users 
     WHERE is_verified = 1 AND id != ? 
     AND (name LIKE ? OR email LIKE ?)
     LIMIT 20`,
    [currentUserId, searchPattern, searchPattern]
  );
}

// ==================== ITEMS OPERATIONS ====================

async function createItem(donorId, title, description, category, imageUrl = null) {
  const result = await run(
    "INSERT INTO items (donor_id, title, description, category, image_url) VALUES (?, ?, ?, ?, ?)",
    [donorId, title, description, category, imageUrl]
  );
  return result.id;
}

async function getAllItems(category = null, searchQuery = null) {
  let query = `SELECT items.*, users.name as donor_name, users.email as donor_email,
               users.avatar_url as donor_avatar
               FROM items JOIN users ON items.donor_id = users.id 
               WHERE items.status != 'donated'`;
  const params = [];

  if (category) {
    query += " AND items.category = ?";
    params.push(category);
  }

  if (searchQuery) {
    query += " AND (items.title LIKE ? OR items.description LIKE ?)";
    const searchPattern = `%${searchQuery}%`;
    params.push(searchPattern, searchPattern);
  }

  query += " ORDER BY items.created_at DESC";
  return await all(query, params);
}

async function getItemById(itemId) {
  return await get(
    `SELECT items.*, users.name as donor_name, users.email as donor_email, 
     users.avatar_url as donor_avatar
     FROM items JOIN users ON items.donor_id = users.id WHERE items.id = ?`,
    [itemId]
  );
}

async function updateItemStatus(itemId, donorId, status, recipientId = null) {
  let result;
  if (recipientId) {
    result = await run(
      "UPDATE items SET status = ?, recipient_id = ? WHERE id = ? AND donor_id = ?",
      [status, recipientId, itemId, donorId]
    );
  } else {
    result = await run(
      "UPDATE items SET status = ? WHERE id = ? AND donor_id = ?",
      [status, itemId, donorId]
    );
  }
  return result.changes > 0;
}

async function deleteItem(itemId, donorId) {
  const result = await run("DELETE FROM items WHERE id = ? AND donor_id = ?", [itemId, donorId]);
  return result.changes > 0;
}

async function getUserDonationHistory(userId) {
  // Items posted by user (active/available/requested)
  const myActive = await all(
    `SELECT items.*, users.name as donor_name FROM items 
     JOIN users ON items.donor_id = users.id
     WHERE items.donor_id = ? AND items.status != 'donated'
     ORDER BY items.created_at DESC`,
    [userId]
  );

  // Items already donated by user
  const myDonated = await all(
    `SELECT items.*, users.name as donor_name,
     r.name as recipient_name, r.avatar_url as recipient_avatar
     FROM items 
     JOIN users ON items.donor_id = users.id
     LEFT JOIN users r ON items.recipient_id = r.id
     WHERE items.donor_id = ? AND items.status = 'donated'
     ORDER BY items.created_at DESC`,
    [userId]
  );

  // Items received by user
  const received = await all(
    `SELECT items.*, users.name as donor_name, users.avatar_url as donor_avatar
     FROM items 
     JOIN users ON items.donor_id = users.id
     WHERE items.recipient_id = ? AND items.status = 'donated'
     ORDER BY items.created_at DESC`,
    [userId]
  );

  return {
    active: myActive,
    donated: myDonated,
    received: received
  };
}

// ==================== CHAT OPERATIONS ====================

async function saveMessage(senderId, receiverId, messageText) {
  const result = await run(
    "INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
    [senderId, receiverId, messageText]
  );
  return result.id;
}

async function getMessagesBetweenUsers(user1Id, user2Id) {
  const messages = await all(`
    SELECT * FROM messages 
    WHERE (sender_id = ? AND receiver_id = ?) 
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `, [user1Id, user2Id, user2Id, user1Id]);

  await run(`
    UPDATE messages SET is_read = 1 
    WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
  `, [user2Id, user1Id]);

  return messages;
}

async function getChatContactsForUser(userId) {
  const query = `
    SELECT DISTINCT u.id, u.name, u.email, u.avatar_url,
    (
        SELECT m.message FROM messages m 
        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = u.id)
        ORDER BY m.created_at DESC LIMIT 1
    ) as last_message,
    (
        SELECT m.created_at FROM messages m 
        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = u.id)
        ORDER BY m.created_at DESC LIMIT 1
    ) as last_message_time,
    (
        SELECT COUNT(*) FROM messages m 
        WHERE m.sender_id = u.id AND m.receiver_id = ? AND m.is_read = 0
    ) as unread_count
    FROM users u
    WHERE u.id IN (
        SELECT DISTINCT sender_id FROM messages WHERE receiver_id = ?
        UNION
        SELECT DISTINCT receiver_id FROM messages WHERE sender_id = ?
    )
    ORDER BY last_message_time DESC
  `;
  return await all(query, [userId, userId, userId, userId, userId, userId, userId]);
}

// ==================== FRIENDS OPERATIONS ====================

async function sendFriendRequest(userId, friendId) {
  try {
    const existing = await get(
      `SELECT * FROM friends 
       WHERE (user_id = ? AND friend_id = ?) 
       OR (user_id = ? AND friend_id = ?)`,
      [userId, friendId, friendId, userId]
    );
    if (existing) {
      return 'already_exists';
    }
    await run(
      "INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')",
      [userId, friendId]
    );
    return 'sent';
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return 'already_exists';
    }
    throw err;
  }
}

async function respondFriendRequest(requesterId, currentUserId, accept) {
  let result;
  if (accept) {
    result = await run(
      "UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ? AND status = 'pending'",
      [requesterId, currentUserId]
    );
  } else {
    result = await run(
      "DELETE FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'",
      [requesterId, currentUserId]
    );
  }
  return result.changes > 0;
}

async function getFriendsList(userId) {
  // Accepted friends (both directions)
  const accepted = await all(
    `SELECT u.id, u.name, u.email, u.avatar_url, f.created_at
     FROM friends f
     JOIN users u ON (
         CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END = u.id
     )
     WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
     ORDER BY u.name`,
    [userId, userId, userId]
  );

  // Pending incoming requests
  const incoming = await all(
    `SELECT u.id, u.name, u.email, u.avatar_url, f.created_at
     FROM friends f
     JOIN users u ON f.user_id = u.id
     WHERE f.friend_id = ? AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId]
  );

  // Pending outgoing requests
  const outgoing = await all(
    `SELECT u.id, u.name, u.email, u.avatar_url, f.created_at
     FROM friends f
     JOIN users u ON f.friend_id = u.id
     WHERE f.user_id = ? AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId]
  );

  return {
    accepted: accepted,
    incoming: incoming,
    outgoing: outgoing
  };
}

async function getFriendshipStatus(userId, otherId) {
  const relation = await get(
    `SELECT *, 
     CASE WHEN user_id = ? THEN 'sent' ELSE 'received' END as direction
     FROM friends 
     WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
    [userId, userId, otherId, otherId, userId]
  );
  if (!relation) return null;
  return relation;
}

module.exports = {
  initDb,
  createUser,
  getUserByEmail,
  getUserById,
  verifyUser,
  updateUserProfile,
  searchUsers,
  createItem,
  getAllItems,
  getItemById,
  updateItemStatus,
  deleteItem,
  getUserDonationHistory,
  saveMessage,
  getMessagesBetweenUsers,
  getChatContactsForUser,
  sendFriendRequest,
  respondFriendRequest,
  getFriendsList,
  getFriendshipStatus
};
