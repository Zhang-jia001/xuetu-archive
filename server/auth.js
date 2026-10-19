// 鉴权：scrypt 存密码 + 手写 HS256 token（零依赖）
const crypto = require('node:crypto');
const { get, run } = require('./db');

const SECRET = process.env.JWT_SECRET || 'comp-guide-dev-secret-change-me';
const TTL = 1000 * 60 * 60 * 24 * 30; // 30 天

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(pw, salt, 32).toString('hex');
  return salt + ':' + key;
}

function checkPassword(pw, stored) {
  const [salt, key] = String(stored).split(':');
  if (!salt || !key) return false;
  const calc = crypto.scryptSync(pw, salt, 32).toString('hex');
  // 定长比较，避免时序侧信道
  try {
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(calc, 'hex'));
  } catch (e) {
    return false;
  }
}

function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(s) {
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

function sign(user) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ uid: user.id, exp: Date.now() + TTL }));
  const sig = b64u(crypto.createHmac('sha256', SECRET).update(head + '.' + body).digest());
  return head + '.' + body + '.' + sig;
}

function verify(token) {
  if (!token || token.split('.').length !== 3) return null;
  const [head, body, sig] = token.split('.');
  const want = b64u(crypto.createHmac('sha256', SECRET).update(head + '.' + body).digest());
  if (sig !== want) return null;
  let payload;
  try { payload = JSON.parse(unb64u(body)); } catch (e) { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  const u = get('SELECT id, email, name FROM users WHERE id = ?', payload.uid);
  return u || null;
}

function register(email, name, password) {
  email = String(email || '').trim().toLowerCase();
  name = String(name || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, '邮箱格式不对');
  if (name.length < 1) throw httpError(400, '名字不能为空');
  if (String(password || '').length < 6) throw httpError(400, '密码至少 6 位');
  if (get('SELECT id FROM users WHERE email = ?', email)) throw httpError(409, '这个邮箱已经注册过了');
  const now = Date.now();
  const r = run('INSERT INTO users (email, name, pass, created_at) VALUES (?,?,?,?)',
    email, name, hashPassword(password), now);
  const user = { id: Number(r.lastInsertRowid), email, name };
  return { token: sign(user), user };
}

function login(email, password) {
  email = String(email || '').trim().toLowerCase();
  const u = get('SELECT * FROM users WHERE email = ?', email);
  if (!u || !checkPassword(password, u.pass)) throw httpError(401, '邮箱或密码不对');
  const user = { id: u.id, email: u.email, name: u.name };
  return { token: sign(user), user };
}

function httpError(code, msg) {
  const e = new Error(msg);
  e.code = code;
  return e;
}

module.exports = { register, login, verify, httpError };
