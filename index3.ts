import { db, LocalUser } from './db';

const SESSION_KEY = 'diantuha_active_user_id';

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const localAuth = {
  async register(username: string, email: string, password: string): Promise<LocalUser> {
    const cleanUser = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUser || !cleanEmail || password.length < 6) {
      throw new Error('Tên đăng nhập, email không hợp lệ hoặc mật khẩu dưới 6 ký tự.');
    }

    const existing = await db.users
      .where('username')
      .equalsIgnoreCase(cleanUser)
      .or('email')
      .equals(cleanEmail)
      .first();

    if (existing) {
      throw new Error('Tên đăng nhập hoặc email đã tồn tại trên thiết bị này.');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = Date.now();

    const newUser: LocalUser = {
      id: crypto.randomUUID(),
      username: cleanUser,
      email: cleanEmail,
      passwordHash,
      salt,
      createdAt: now,
      updatedAt: now,
    };

    await db.users.add(newUser);

    // Tạo sẵn thư mục mặc định cho sổ tay từ vựng của người dùng
    await db.vocabFolders.add({
      id: `default_${newUser.id}`,
      userId: newUser.id,
      name: 'Từ vựng chung',
      color: '#4A6B53', // Xanh rêu
      description: 'Thư mục lưu trữ mặc định',
      createdAt: now,
    });

    localStorage.setItem(SESSION_KEY, newUser.id);
    return newUser;
  },

  async login(identifier: string, password: string): Promise<LocalUser> {
    const cleanId = identifier.trim();
    const user = await db.users
      .where('username')
      .equalsIgnoreCase(cleanId)
      .or('email')
      .equals(cleanId.toLowerCase())
      .first();

    if (!user) {
      throw new Error('Không tìm thấy tài khoản trên thiết bị này.');
    }

    const attemptHash = await hashPassword(password, user.salt);
    if (attemptHash !== user.passwordHash) {
      throw new Error('Mật khẩu không chính xác.');
    }

    localStorage.setItem(SESSION_KEY, user.id);
    return user;
  },

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
  },

  async getCurrentUser(): Promise<LocalUser | null> {
    const userId = localStorage.getItem(SESSION_KEY);
    if (!userId) return null;
    const user = await db.users.get(userId);
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return user;
  },
};