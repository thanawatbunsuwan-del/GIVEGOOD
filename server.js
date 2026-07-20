const express = require('express');
const session = require('express-session');
const multer = require('multer');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const database = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'givegood_super_secret_key_12345',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // set to true if running over https
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Configure Multer storage
const uploadFolder = path.join(__dirname, 'static', 'uploads');
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(4).toString('hex');
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${file.fieldname}_${unique}_${safeName}${ext}`);
  }
});
const upload = multer({ storage });

// --- REAL SMTP (GMAIL) CONFIGURATION ---
const SMTP_SERVER = 'smtp.gmail.com';
const SMTP_PORT = 587;
const SENDER_EMAIL = 'givegood@gmail.com';
const SENDER_PASSWORD = 'blwu cool cjbb yawy';

const transporter = nodemailer.createTransport({
  host: SMTP_SERVER,
  port: SMTP_PORT,
  secure: false,
  auth: {
    user: SENDER_EMAIL,
    pass: SENDER_PASSWORD
  }
});

async function sendVerificationEmail(recipientEmail, recipientName, code) {
  if (!SENDER_EMAIL || !SENDER_PASSWORD) {
    console.log(`\n[EMAIL SIMULATOR] รหัสยืนยันสำหรับคุณ ${recipientName} (${recipientEmail}) คือ: {code}\n`);
    return false;
  }
  try {
    const mailOptions = {
      from: `"GIVEGOOD" <${SENDER_EMAIL}>`,
      to: recipientEmail,
      subject: `รหัสยืนยันตัวตนของคุณคือ ${code} - GIVEGOOD`,
      text: `สวัสดีคุณ ${recipientName},

ขอบคุณสำหรับการสมัครสมาชิกเว็บไซต์ GIVEGOOD (สื่อกลางแบ่งปันสิ่งของที่ไม่ใช้แล้ว)

รหัสยืนยันตัวตนเพื่อเปิดใช้งานบัญชีของคุณคือ:

👉 ${code} 👈

กรุณากรอกรหัส 6 หลักนี้ในหน้าต่างยืนยันอีเมลเพื่อทำรายการต่อ

ขอแสดงความนับถือ,
ทีมงาน GIVEGOOD.COM
`
    };
    await transporter.sendMail(mailOptions);
    console.log(`[SMTP] ส่งอีเมลรหัสยืนยันสำเร็จไปยัง ${recipientEmail}`);
    return true;
  } catch (err) {
    console.error(`[SMTP ERROR] ล้มเหลวในการส่งอีเมลไปยัง ${recipientEmail}:`, err.message);
    return false;
  }
}

// Authentication Helpers
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
  }
  next();
}

// ==================== STATIC ROUTES ====================

app.get('/', (req, res) => {
  const staticIndex = fs.existsSync(path.join(__dirname, 'static', 'index.html'))
    ? path.join(__dirname, 'static', 'index.html')
    : path.join(__dirname, 'index.html');
  if (fs.existsSync(staticIndex)) {
    res.sendFile(staticIndex);
  } else {
    res.status(404).send("Error: index.html not found!");
  }
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send("User-agent: *\nAllow: /");
});

// Serve other static files
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/static', express.static(__dirname));

// Custom fallback route mapping for style.css
app.get('/static/css/style.css', (req, res) => {
  const paths = [
    path.join(__dirname, 'static', 'css', 'style.css'),
    path.join(__dirname, 'css', 'style.css'),
    path.join(__dirname, 'style.css')
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      res.type('text/css');
      return res.sendFile(p);
    }
  }
  res.status(404).send('style.css not found');
});

// Custom fallback route mapping for api.js
app.get('/static/js/api.js', (req, res) => {
  const paths = [
    path.join(__dirname, 'static', 'js', 'api.js'),
    path.join(__dirname, 'js', 'api.js'),
    path.join(__dirname, 'api.js')
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      res.type('application/javascript');
      return res.sendFile(p);
    }
  }
  res.status(404).send('api.js not found');
});

// Custom fallback route mapping for app.js
app.get('/static/js/app.js', (req, res) => {
  const paths = [
    path.join(__dirname, 'static', 'js', 'app.js'),
    path.join(__dirname, 'js', 'app.js'),
    path.join(__dirname, 'app.js')
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      res.type('application/javascript');
      return res.sendFile(p);
    }
  }
  res.status(404).send('app.js not found');
});

// ==================== AUTH APIs ====================

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    const existingUser = await database.getUserByEmail(email);
    if (existingUser) {
      if (existingUser.is_verified === 0) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Update user
        const sqlite = require('sqlite3').verbose();
        const dbConn = new sqlite.Database(path.join(__dirname, 'db.sqlite3'));
        dbConn.run(
          "UPDATE users SET name = ?, password_hash = ?, verification_code = ? WHERE id = ?",
          [name, passwordHash, code, existingUser.id],
          async (err) => {
            dbConn.close();
            if (err) return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงทะเบียน' });
            
            const hasSentSmtp = await sendVerificationEmail(email, name, code);
            const msgText = hasSentSmtp ? 'ส่งรหัสยืนยันใหม่ไปยัง Gmail ของคุณแล้ว' : 'ส่งรหัสยืนยันใหม่ไปยัง Gmail แล้ว (จำลอง)';
            res.json({ message: msgText, email: email, debug_code: code });
          }
        );
        return;
      }
      return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await database.createUser(name, email, passwordHash, code);
    
    if (userId === null) {
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงทะเบียน' });
    }

    const hasSentSmtp = await sendVerificationEmail(email, name, code);
    const msgText = hasSentSmtp ? 'ส่งรหัสยืนยันไปยัง Gmail ของคุณแล้ว' : 'ส่งรหัสยืนยันไปยัง Gmail แล้ว (จำลอง)';
    res.status(201).json({ message: msgText, email: email, debug_code: code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงทะเบียน' });
  }
});

app.post('/api/verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'กรุณากรอกรหัสยืนยัน' });
  }

  try {
    const success = await database.verifyUser(email, code);
    if (!success) {
      return res.status(400).json({ error: 'รหัสยืนยันไม่ถูกต้อง' });
    }

    const user = await database.getUserByEmail(email);
    req.session.userId = user.id;
    req.session.name = user.name;
    req.session.email = user.email;

    res.json({
      message: 'ยืนยันอีเมลสำเร็จ',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการยืนยันตัวตน' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  try {
    const user = await database.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    if (user.is_verified === 0) {
      return res.status(403).json({
        error: 'อีเมลนี้ยังไม่ได้ยืนยันตัวตน',
        not_verified: true,
        email: email,
        debug_code: user.verification_code
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    req.session.userId = user.id;
    req.session.name = user.name;
    req.session.email = user.email;

    res.json({
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการออกจากระบบ' });
    }
    res.json({ message: 'ออกจากระบบสำเร็จ' });
  });
});

app.get('/api/current-user', async (req, res) => {
  if (req.session.userId) {
    try {
      const user = await database.getUserById(req.session.userId);
      if (user) {
        return res.json({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar_url: user.avatar_url,
            banner_url: user.banner_url
          }
        });
      }
    } catch (err) {
      console.error(err);
    }
  }
  res.json({ user: null });
});

// ==================== PROFILE APIs ====================

app.put('/api/profile', requireLogin, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ' });
  }

  let avatarUrl = null;
  let bannerUrl = null;

  if (req.files && req.files.avatar && req.files.avatar[0]) {
    avatarUrl = `/static/uploads/${req.files.avatar[0].filename}`;
  }
  if (req.files && req.files.banner && req.files.banner[0]) {
    bannerUrl = `/static/uploads/${req.files.banner[0].filename}`;
  }

  try {
    await database.updateUserProfile(req.session.userId, name, avatarUrl, bannerUrl);
    req.session.name = name;

    const user = await database.getUserById(req.session.userId);
    res.json({
      message: 'อัปเดตโปรไฟล์สำเร็จ',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
  }
});

app.get('/api/profile/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    const user = await database.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    }
    const history = await database.getUserDonationHistory(userId);
    
    let friendship = null;
    if (req.session.userId && req.session.userId !== userId) {
      friendship = await database.getFriendshipStatus(req.session.userId, userId);
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      banner_url: user.banner_url,
      donation_history: history,
      friendship: friendship
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์' });
  }
});

app.get('/api/profile/history', requireLogin, async (req, res) => {
  try {
    const history = await database.getUserDonationHistory(req.session.userId);
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงประวัติการบริจาค' });
  }
});

// ==================== ITEMS APIs ====================

app.get('/api/items', async (req, res) => {
  const { category, search } = req.query;
  try {
    const items = await database.getAllItems(category, search);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิ่งของ' });
  }
});

app.get('/api/items/:itemId', async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  try {
    const item = await database.getItemById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'ไม่พบสิ่งของที่บริจาค' });
    }
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิ่งของ' });
  }
});

app.post('/api/items', requireLogin, upload.single('image'), async (req, res) => {
  const { title, description, category } = req.body;
  if (!title || !description || !category) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  let imageUrl = null;
  if (req.file) {
    imageUrl = `/static/uploads/${req.file.filename}`;
  }

  try {
    const itemId = await database.createItem(
      req.session.userId,
      title,
      description,
      category,
      imageUrl
    );
    res.status(201).json({ message: 'ลงทะเบียนสิ่งของบริจาคสำเร็จ', item_id: itemId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงทะเบียนสิ่งของบริจาค' });
  }
});

app.put('/api/items/:itemId/status', requireLogin, async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  const { status, recipient_id } = req.body;

  if (!['available', 'requested', 'donated'].includes(status)) {
    return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
  }

  try {
    const success = await database.updateItemStatus(itemId, req.session.userId, status, recipient_id);
    if (!success) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขสิ่งของนี้ หรือไม่พบสิ่งของ' });
    }
    res.json({ message: 'อัปเดตสถานะสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
  }
});

app.delete('/api/items/:itemId', requireLogin, async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  try {
    const success = await database.deleteItem(itemId, req.session.userId);
    if (!success) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบสิ่งของนี้ หรือไม่พบสิ่งของ' });
    }
    res.json({ message: 'ลบข้อมูลสิ่งของสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูลสิ่งของ' });
  }
});

// ==================== FRIENDS APIs ====================

app.get('/api/friends/search', requireLogin, async (req, res) => {
  const query = (req.query.q || '').trim();
  if (query.length < 2) {
    return res.json([]);
  }

  try {
    const users = await database.searchUsers(req.session.userId, query);
    const result = [];
    for (const u of users) {
      const fs = await database.getFriendshipStatus(req.session.userId, u.id);
      result.push({
        id: u.id,
        name: u.name,
        email: u.email,
        avatar_url: u.avatar_url,
        friendship: fs
      });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาเพื่อน' });
  }
});

app.post('/api/friends/request', requireLogin, async (req, res) => {
  const { friend_id } = req.body;
  if (!friend_id) {
    return res.status(400).json({ error: 'ไม่ระบุผู้ใช้' });
  }

  if (parseInt(friend_id) === req.session.userId) {
    return res.status(400).json({ error: 'ไม่สามารถเพิ่มตัวเองเป็นเพื่อนได้' });
  }

  try {
    const result = await database.sendFriendRequest(req.session.userId, parseInt(friend_id));
    if (result === 'already_exists') {
      return res.status(409).json({ error: 'มีคำขอหรือความสัมพันธ์นี้อยู่แล้ว' });
    }
    res.status(201).json({ message: 'ส่งคำขอเป็นเพื่อนสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งคำขอเป็นเพื่อน' });
  }
});

app.post('/api/friends/respond', requireLogin, async (req, res) => {
  const { requester_id, accept } = req.body;
  if (!requester_id) {
    return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  }

  try {
    const success = await database.respondFriendRequest(parseInt(requester_id), req.session.userId, accept);
    if (!success) {
      return res.status(404).json({ error: 'ไม่พบคำขอ' });
    }
    const msg = accept ? 'ยอมรับคำขอเป็นเพื่อนสำเร็จ' : 'ปฏิเสธคำขอเป็นเพื่อนแล้ว';
    res.json({ message: msg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการตอบรับคำขอเป็นเพื่อน' });
  }
});

app.get('/api/friends', requireLogin, async (req, res) => {
  try {
    const data = await database.getFriendsList(req.session.userId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายชื่อเพื่อน' });
  }
});

// ==================== CHAT APIs ====================

app.get('/api/chat/contacts', requireLogin, async (req, res) => {
  try {
    const contacts = await database.getChatContactsForUser(req.session.userId);
    res.json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ติดต่อ' });
  }
});

app.get('/api/chat/messages/:contactId', requireLogin, async (req, res) => {
  const contactId = parseInt(req.params.contactId);
  try {
    const messages = await database.getMessagesBetweenUsers(req.session.userId, contactId);
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลแชท' });
  }
});

app.post('/api/chat/send', requireLogin, async (req, res) => {
  const { receiver_id, message } = req.body;
  if (!receiver_id || !message) {
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  }

  if (req.session.userId === parseInt(receiver_id)) {
    return res.status(400).json({ error: 'ไม่สามารถส่งข้อความหาตัวเองได้' });
  }

  try {
    const receiver = await database.getUserById(parseInt(receiver_id));
    if (!receiver) {
      return res.status(404).json({ error: 'ไม่พบผู้รับข้อความ' });
    }

    const msgId = await database.saveMessage(req.session.userId, parseInt(receiver_id), message);
    res.status(201).json({ message: 'ส่งข้อความสำเร็จ', message_id: msgId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งข้อความ' });
  }
});

// ==================== PUBLIC USER APIs ====================

app.get('/api/users/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    const user = await database.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      banner_url: user.banner_url
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน' });
  }
});

// Start DB then server
database.initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error("Database initialization failed:", err);
});
