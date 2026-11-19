const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('../database/schema');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Session configuration
app.use(session({
  secret: 'pocketnest-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Make user available in all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.messages = req.session.messages || [];
  req.session.messages = [];
  next();
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.messages = [{ type: 'error', text: 'Please log in to access this page' }];
    return res.redirect('/login');
  }
  next();
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      req.session.messages = [{ type: 'error', text: 'Unauthorized access' }];
      return res.redirect('/login');
    }
    next();
  };
};

// Helper functions
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const generateInvitationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// ==================== AUTH ROUTES ====================

// Login page
app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'parent' ? '/parent/dashboard' : '/child/dashboard');
  }
  res.render('auth/login', { title: 'Login - PocketNest' });
});

// Register page
app.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'parent' ? '/parent/dashboard' : '/child/dashboard');
  }
  res.render('auth/register', { title: 'Register - PocketNest' });
});

// Handle login
app.post('/login', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    req.session.messages = [{ type: 'error', text: 'All fields are required' }];
    return res.redirect('/login');
  }

  const user = await db.get('SELECT * FROM users WHERE email = ? AND role = ?', [email, role]);

  if (!user) {
    req.session.messages = [{ type: 'error', text: 'Invalid credentials' }];
    return res.redirect('/login');
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);

  if (!validPassword) {
    req.session.messages = [{ type: 'error', text: 'Invalid credentials' }];
    return res.redirect('/login');
  }

  req.session.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar
  };

  res.redirect(role === 'parent' ? '/parent/dashboard' : '/child/dashboard');
});

// Handle registration
app.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword, role } = req.body;

  if (!name || !email || !password || !confirmPassword || !role) {
    req.session.messages = [{ type: 'error', text: 'All fields are required' }];
    return res.redirect('/register');
  }

  if (password !== confirmPassword) {
    req.session.messages = [{ type: 'error', text: 'Passwords do not match' }];
    return res.redirect('/register');
  }

  if (password.length < 6) {
    req.session.messages = [{ type: 'error', text: 'Password must be at least 6 characters' }];
    return res.redirect('/register');
  }

  const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existingUser) {
    req.session.messages = [{ type: 'error', text: 'Email already registered' }];
    return res.redirect('/register');
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const userId = generateId();

  await db.run('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [userId, name, email, passwordHash, role]);

  // Create wallet for user
  await db.run('INSERT INTO wallets (id, user_id, balance) VALUES (?, ?, 0)',
    [generateId(), userId]);

  req.session.messages = [{ type: 'success', text: 'Registration successful! Please log in.' }];
  res.redirect('/login');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ==================== PARENT ROUTES ====================

// Parent dashboard
app.get('/parent/dashboard', requireAuth, requireRole('parent'), async (req, res) => {
  const userId = req.session.user.id;

  // Get family info
  const family = await db.get(`
    SELECT f.* FROM families f
    JOIN family_members fm ON f.id = fm.family_id
    WHERE fm.user_id = ? AND fm.role = 'parent'
  `, [userId]);

  let stats = {
    totalBalance: 0,
    totalChildren: 0,
    totalDistributed: 0,
    totalWithdrawals: 0,
    recentTransactions: [],
    children: []
  };

  if (family) {
    // Get children
    const children = await db.all(`
      SELECT u.id, u.name, u.avatar, w.balance, w.is_frozen, w.spending_limit
      FROM users u
      JOIN family_members fm ON u.id = fm.user_id
      JOIN wallets w ON u.id = w.user_id
      WHERE fm.family_id = ? AND fm.role = 'child'
    `, [family.id]);

    stats.totalChildren = children.length;

    // Calculate total family balance
    const totalBalance = children.reduce((sum, child) => sum + (child.balance || 0), 0);
    stats.totalBalance = totalBalance;
    stats.children = children;

    // Get total distributed (deposits by parent)
    const distributed = await db.get(`
      SELECT SUM(amount) as total FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      JOIN family_members fm ON w.user_id = fm.user_id
      WHERE fm.family_id = ? AND t.type = 'deposit' AND t.status = 'completed'
    `, [family.id]);
    stats.totalDistributed = distributed.total || 0;

    // Get total withdrawals
    const withdrawals = await db.get(`
      SELECT SUM(amount) as total FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      JOIN family_members fm ON w.user_id = fm.user_id
      WHERE fm.family_id = ? AND t.type = 'withdrawal' AND t.status = 'completed'
    `, [family.id]);
    stats.totalWithdrawals = withdrawals.total || 0;

    // Recent transactions
    stats.recentTransactions = await db.all(`
      SELECT t.*, u.name as child_name
      FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      JOIN users u ON w.user_id = u.id
      JOIN family_members fm ON u.id = fm.user_id
      WHERE fm.family_id = ? AND t.status = 'completed'
      ORDER BY t.created_at DESC
      LIMIT 10
    `, [family.id]);
  }

  // Get notifications
  const notifications = await db.all(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
  `, [userId]);

  res.render('parent/dashboard', {
    title: 'Parent Dashboard - PocketNest',
    family,
    stats,
    notifications
  });
});

// Create family
app.post('/parent/family/create', requireAuth, requireRole('parent'), async (req, res) => {
  const { familyName } = req.body;
  const userId = req.session.user.id;

  if (!familyName) {
    req.session.messages = [{ type: 'error', text: 'Family name is required' }];
    return res.redirect('/parent/dashboard');
  }

  // Check if parent already has a family
  const existingFamily = await db.get(`
    SELECT f.* FROM families f
    JOIN family_members fm ON f.id = fm.family_id
    WHERE fm.user_id = ? AND fm.role = 'parent'
  `, [userId]);

  if (existingFamily) {
    req.session.messages = [{ type: 'error', text: 'You already have a family' }];
    return res.redirect('/parent/dashboard');
  }

  const familyId = generateId();
  const invitationCode = generateInvitationCode();

  await db.run('INSERT INTO families (id, name, invitation_code, parent_id) VALUES (?, ?, ?, ?)',
    [familyId, familyName, invitationCode, userId]);

  await db.run('INSERT INTO family_members (id, family_id, user_id, role) VALUES (?, ?, ?, ?)',
    [generateId(), familyId, userId, 'parent']);

  req.session.messages = [{ type: 'success', text: 'Family created successfully!' }];
  res.redirect('/parent/dashboard');
});

// Get invitation code
app.get('/parent/family/invitation', requireAuth, requireRole('parent'), async (req, res) => {
  const userId = req.session.user.id;

  const family = await db.get(`
    SELECT f.invitation_code, f.name FROM families f
    JOIN family_members fm ON f.id = fm.family_id
    WHERE fm.user_id = ? AND fm.role = 'parent'
  `, [userId]);

  if (!family) {
    req.session.messages = [{ type: 'error', text: 'No family found' }];
    return res.redirect('/parent/dashboard');
  }

  res.json({ invitationCode: family.invitation_code, familyName: family.name });
});

// Add money to child's wallet
app.post('/parent/wallet/add', requireAuth, requireRole('parent'), async (req, res) => {
  const { childId, amount, description } = req.body;
  const parentId = req.session.user.id;

  if (!childId || !amount || amount <= 0) {
    req.session.messages = [{ type: 'error', text: 'Invalid amount' }];
    return res.redirect('/parent/dashboard');
  }

  // Verify child belongs to parent's family
  const family = await db.get(`
    SELECT f.id FROM families f
    JOIN family_members fm ON f.id = fm.family_id
    WHERE fm.user_id = ? AND fm.role = 'parent'
  `, [parentId]);

  if (!family) {
    req.session.messages = [{ type: 'error', text: 'No family found' }];
    return res.redirect('/parent/dashboard');
  }

  const childInFamily = await db.get(`
    SELECT 1 FROM family_members WHERE family_id = ? AND user_id = ? AND role = 'child'
  `, [family.id, childId]);

  if (!childInFamily) {
    req.session.messages = [{ type: 'error', text: 'Child not found in your family' }];
    return res.redirect('/parent/dashboard');
  }

  const wallet = await db.get('SELECT id, balance FROM wallets WHERE user_id = ?', [childId]);
  if (!wallet) {
    req.session.messages = [{ type: 'error', text: 'Wallet not found' }];
    return res.redirect('/parent/dashboard');
  }

  const transactionId = generateId();
  const newBalance = wallet.balance + parseFloat(amount);

  // Use transaction for atomicity
  await db.run('BEGIN TRANSACTION');
  try {
    await db.run('UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [newBalance, childId]);

    await db.run('INSERT INTO transactions (id, wallet_id, amount, type, description, status) VALUES (?, ?, ?, ?, ?, ?)',
      [transactionId, wallet.id, parseFloat(amount), 'deposit', description || 'Money added by parent', 'completed']);

    // Create notification for child
    await db.run('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), childId, 'Money Received', `₹${amount} added to your wallet by parent`, 'success', transactionId]);

    // Create notification for parent
    await db.run('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), parentId, 'Money Added', `₹${amount} added to child's wallet`, 'success', transactionId]);

    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }

  req.session.messages = [{ type: 'success', text: `₹${amount} added successfully!` }];
  res.redirect('/parent/dashboard');
});

// Deduct money from child's wallet
app.post('/parent/wallet/deduct', requireAuth, requireRole('parent'), async (req, res) => {
  const { childId, amount, description } = req.body;
  const parentId = req.session.user.id;

  if (!childId || !amount || amount <= 0) {
    req.session.messages = [{ type: 'error', text: 'Invalid amount' }];
    return res.redirect('/parent/dashboard');
  }

  const family = await db.get(`
    SELECT f.id FROM families f
    JOIN family_members fm ON f.id = fm.family_id
    WHERE fm.user_id = ? AND fm.role = 'parent'
  `, [parentId]);

  if (!family) {
    req.session.messages = [{ type: 'error', text: 'No family found' }];
    return res.redirect('/parent/dashboard');
  }

  const childInFamily = await db.get(`
    SELECT 1 FROM family_members WHERE family_id = ? AND user_id = ? AND role = 'child'
  `, [family.id, childId]);

  if (!childInFamily) {
    req.session.messages = [{ type: 'error', text: 'Child not found in your family' }];
    return res.redirect('/parent/dashboard');
  }

  const wallet = await db.get('SELECT id, balance FROM wallets WHERE user_id = ?', [childId]);
  if (!wallet) {
    req.session.messages = [{ type: 'error', text: 'Wallet not found' }];
    return res.redirect('/parent/dashboard');
  }

  if (wallet.balance < parseFloat(amount)) {
    req.session.messages = [{ type: 'error', text: 'Insufficient balance' }];
    return res.redirect('/parent/dashboard');
  }

  const transactionId = generateId();
  const newBalance = wallet.balance - parseFloat(amount);

  await db.run('BEGIN TRANSACTION');
  try {
    await db.run('UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [newBalance, childId]);

    await db.run('INSERT INTO transactions (id, wallet_id, amount, type, description, status) VALUES (?, ?, ?, ?, ?, ?)',
      [transactionId, wallet.id, parseFloat(amount), 'deduction', description || 'Money deducted by parent', 'completed']);

    await db.run('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), childId, 'Money Deducted', `₹${amount} deducted from your wallet by parent`, 'warning', transactionId]);

    await db.run('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), parentId, 'Money Deducted', `₹${amount} deducted from child's wallet`, 'info', transactionId]);

    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }

  req.session.messages = [{ type: 'success', text: `₹${amount} deducted successfully!` }];
  res.redirect('/parent/dashboard');
});

// Freeze/Unfreeze wallet
app.post('/parent/wallet/toggle-freeze', requireAuth, requireRole('parent'), async (req, res) => {
  const { childId } = req.body;
  const parentId = req.session.user.id;

  const family = await db.get(`
    SELECT f.id FROM families f
    JOIN family_members fm ON f.id = fm.family_id
    WHERE fm.user_id = ? AND fm.role = 'parent'
  `, [parentId]);

  if (!family) {
    req.session.messages = [{ type: 'error', text: 'No family found' }];
    return res.redirect('/parent/dashboard');
  }

  const childInFamily = await db.get(`
    SELECT 1 FROM family_members WHERE family_id = ? AND user_id = ? AND role = 'child'
  `, [family.id, childId]);

  if (!childInFamily) {
    req.session.messages = [{ type: 'error', text: 'Child not found in your family' }];
    return res.redirect('/parent/dashboard');
  }

  const wallet = await db.get('SELECT is_frozen FROM wallets WHERE user_id = ?', [childId]);
  if (!wallet) {
    req.session.messages = [{ type: 'error', text: 'Wallet not found' }];
    return res.redirect('/parent/dashboard');
  }

  const newStatus = wallet.is_frozen ? 0 : 1;
  await db.run('UPDATE wallets SET is_frozen = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [newStatus, childId]);

  req.session.messages = [{
    type: 'success',
    text: newStatus ? 'Wallet frozen successfully!' : 'Wallet unfrozen successfully!'
  }];
  res.redirect('/parent/dashboard');
});

// Set spending limit
app.post('/parent/wallet/set-limit', requireAuth, requireRole('parent'), async (req, res) => {
  const { childId, limitAmount, period } = req.body;
  const parentId = req.session.user.id;

  const family = await db.get(`
    SELECT f.id FROM families f
    JOIN family_members fm ON f.id = fm.family_id
    WHERE fm.user_id = ? AND fm.role = 'parent'
  `, [parentId]);

  if (!family) {
    req.session.messages = [{ type: 'error', text: 'No family found' }];
    return res.redirect('/parent/dashboard');
  }

  const childInFamily = await db.get(`
    SELECT 1 FROM family_members WHERE family_id = ? AND user_id = ? AND role = 'child'
  `, [family.id, childId]);

  if (!childInFamily) {
    req.session.messages = [{ type: 'error', text: 'Child not found in your family' }];
    return res.redirect('/parent/dashboard');
  }

  const limitId = generateId();
  await db.run('INSERT OR REPLACE INTO spending_limits (id, child_id, limit_amount, period, set_by) VALUES (?, ?, ?, ?, ?)',
    [limitId, childId, parseFloat(limitAmount), period, parentId]);

  await db.run('UPDATE wallets SET spending_limit = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [parseFloat(limitAmount), childId]);

  // Notify child
  await db.run('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
    [generateId(), childId, 'Spending Limit Updated', `Your ${period} spending limit has been set to ₹${limitAmount}`, 'info']);

  req.session.messages = [{ type: 'success', text: 'Spending limit updated!' }];
  res.redirect('/parent/dashboard');
});

// Approve withdrawal request
app.post('/parent/withdrawal/approve', requireAuth, requireRole('parent'), async (req, res) => {
  const { requestId } = req.body;
  const parentId = req.session.user.id;

  const request = await db.get(`
    SELECT wr.*, w.balance, w.id as wallet_id, u.name as child_name
    FROM withdrawal_requests wr
    JOIN wallets w ON wr.child_id = w.user_id
    JOIN users u ON wr.child_id = u.id
    WHERE wr.id = ? AND wr.parent_id = ? AND wr.status = 'pending'
  `, [requestId, parentId]);

  if (!request) {
    req.session.messages = [{ type: 'error', text: 'Withdrawal request not found' }];
    return res.redirect('/parent/dashboard');
  }

  if (request.balance < request.amount) {
    req.session.messages = [{ type: 'error', text: 'Insufficient balance in child\'s wallet' }];
    return res.redirect('/parent/dashboard');
  }

  const transactionId = generateId();
  const newBalance = request.balance - request.amount;

  await db.run('BEGIN TRANSACTION');
  try {
    await db.run('UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [newBalance, request.child_id]);

    await db.run('UPDATE withdrawal_requests SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?', ['approved', requestId]);

    await db.run('INSERT INTO transactions (id, wallet_id, amount, type, description, status, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [transactionId, request.wallet_id, request.amount, 'withdrawal', request.description || 'Withdrawal approved', 'completed', requestId]);

    await db.run('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), request.child_id, 'Withdrawal Approved', `Your withdrawal of ₹${request.amount} has been approved`, 'success', requestId]);

    await db.run('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), parentId, 'Withdrawal Approved', `Approved withdrawal of ₹${request.amount} for ${request.child_name}`, 'success', requestId]);

    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }

  req.session.messages = [{ type: 'success', text: 'Withdrawal approved successfully!' }];
  res.redirect('/parent/dashboard');
});

// Reject withdrawal request
app.post('/parent/withdrawal/reject', requireAuth, requireRole('parent'), async (req, res) => {
  const { requestId } = req.body;
  const parentId = req.session.user.id;

  const request = await db.get(`
    SELECT wr.*, u.name as child_name
    FROM withdrawal_requests wr
    JOIN users u ON wr.child_id = u.id
    WHERE wr.id = ? AND wr.parent_id = ? AND wr.status = 'pending'
  `, [requestId, parentId]);

  if (!request) {
    req.session.messages = [{ type: 'error', text: 'Withdrawal request not found' }];
    return res.redirect('/parent/dashboard');
  }

  await db.run('UPDATE withdrawal_requests SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?', ['rejected', requestId]);

  await db.run('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
    [generateId(), request.child_id, 'Withdrawal Rejected', `Your withdrawal of ₹${request.amount} has been rejected`, 'error', requestId]);

  req.session.messages = [{ type: 'success', text: 'Withdrawal rejected!' }];
  res.redirect('/parent/dashboard');
});

// Parent transaction history
app.get('/parent/transactions', requireAuth, requireRole('parent'), async (req, res) => {
  const userId = req.session.user.id;

  const family = await db.get(`
    SELECT f.id FROM families f
    JOIN family_members fm ON f.id = fm.family_id
    WHERE fm.user_id = ? AND fm.role = 'parent'
  `, [userId]);

  let transactions = [];
  if (family) {
    transactions = await db.all(`
      SELECT t.*, u.name as child_name
      FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      JOIN users u ON w.user_id = u.id
      JOIN family_members fm ON u.id = fm.user_id
      WHERE fm.family_id = ?
      ORDER BY t.created_at DESC
    `, [family.id]);
  }

  res.render('parent/transactions', {
    title: 'Transaction History - PocketNest',
    transactions,
    family
  });
});

// Parent notifications
app.get('/parent/notifications', requireAuth, requireRole('parent'), async (req, res) => {
  const userId = req.session.user.id;

  // Get family info
  const family = await db.get(`
    SELECT f.* FROM families f
    JOIN family_members fm ON f.id = fm.family_id
    WHERE fm.user_id = ? AND fm.role = 'parent'
  `, [userId]);

  const notifications = await db.all(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
  `, [userId]);

  // Mark as read
  await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);

  res.render('parent/notifications', {
    title: 'Notifications - PocketNest',
    notifications,
    family
  });
});

// ==================== CHILD ROUTES ====================

// Child dashboard
app.get('/child/dashboard', requireAuth, requireRole('child'), async (req, res) => {
  const userId = req.session.user.id;

  // Get family info
  const familyMember = await db.get(`
    SELECT fm.*, f.name as family_name, f.invitation_code
    FROM family_members fm
    JOIN families f ON fm.family_id = f.id
    WHERE fm.user_id = ? AND fm.role = 'child'
  `, [userId]);

  let stats = {
    balance: 0,
    totalReceived: 0,
    totalSpent: 0,
    recentTransactions: [],
    pendingRequests: [],
    savingsGoals: [],
    spendingLimit: 0,
    isFrozen: 0
  };

  if (familyMember) {
    const wallet = await db.get('SELECT * FROM wallets WHERE user_id = ?', [userId]);
    if (wallet) {
      stats.balance = wallet.balance;
      stats.isFrozen = wallet.is_frozen;
      stats.spendingLimit = wallet.spending_limit;
    }

    // Total received (deposits)
    const received = await db.get(`
      SELECT SUM(amount) as total FROM transactions
      WHERE wallet_id = ? AND type = 'deposit' AND status = 'completed'
    `, [wallet?.id]);
    stats.totalReceived = received.total || 0;

    // Total spent (withdrawals + spending + deductions)
    const spent = await db.get(`
      SELECT SUM(amount) as total FROM transactions
      WHERE wallet_id = ? AND type IN ('withdrawal', 'spending', 'deduction') AND status = 'completed'
    `, [wallet?.id]);
    stats.totalSpent = spent.total || 0;

    // Recent transactions
    stats.recentTransactions = await db.all(`
      SELECT * FROM transactions
      WHERE wallet_id = ? AND status = 'completed'
      ORDER BY created_at DESC LIMIT 10
    `, [wallet?.id]);

    // Pending withdrawal requests
    stats.pendingRequests = await db.all(`
      SELECT * FROM withdrawal_requests
      WHERE child_id = ? AND status = 'pending'
      ORDER BY requested_at DESC
    `, [userId]);

    // Savings goals
    stats.savingsGoals = await db.all(`
      SELECT * FROM savings_goals
      WHERE child_id = ? AND is_completed = 0
      ORDER BY created_at DESC
    `, [userId]);
  }

  // Notifications
  const notifications = await db.all(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
  `, [userId]);

  res.render('child/dashboard', {
    title: 'My Dashboard - PocketNest',
    family: familyMember,
    stats,
    notifications
  });
});

// Join family
app.post('/child/family/join', requireAuth, requireRole('child'), async (req, res) => {
  const { invitationCode } = req.body;
  const userId = req.session.user.id;

  if (!invitationCode) {
    req.session.messages = [{ type: 'error', text: 'Invitation code is required' }];
    return res.redirect('/child/dashboard');
  }

  const family = await db.get('SELECT * FROM families WHERE invitation_code = ?', [invitationCode.toUpperCase()]);

  if (!family) {
    req.session.messages = [{ type: 'error', text: 'Invalid invitation code' }];
    return res.redirect('/child/dashboard');
  }

  // Check if already in a family
  const existingMember = await db.get('SELECT * FROM family_members WHERE user_id = ?', [userId]);
  if (existingMember) {
    req.session.messages = [{ type: 'error', text: 'You are already part of a family' }];
    return res.redirect('/child/dashboard');
  }

  await db.run('INSERT INTO family_members (id, family_id, user_id, role) VALUES (?, ?, ?, ?)',
    [generateId(), family.id, userId, 'child']);

  // Notify parent
  await db.run('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
    [generateId(), family.parent_id, 'New Family Member', `${req.session.user.name} joined the family`, 'success']);

  req.session.messages = [{ type: 'success', text: `Successfully joined ${family.name}!` }];
  res.redirect('/child/dashboard');
});

// Request money
app.post('/child/money/request', requireAuth, requireRole('child'), async (req, res) => {
  const { amount, description } = req.body;
  const userId = req.session.user.id;

  if (!amount || amount <= 0) {
    req.session.messages = [{ type: 'error', text: 'Invalid amount' }];
    return res.redirect('/child/dashboard');
  }

  const familyMember = await db.get(`
    SELECT fm.*, f.parent_id FROM family_members fm
    JOIN families f ON fm.family_id = f.id
    WHERE fm.user_id = ? AND fm.role = 'child'
  `, [userId]);

  if (!familyMember) {
    req.session.messages = [{ type: 'error', text: 'You are not part of a family' }];
    return res.redirect('/child/dashboard');
  }

  // Create notification for parent (money request)
  await db.run('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
    [generateId(), familyMember.parent_id, 'Money Request', `${req.session.user.name} requested ₹${amount}${description ? ': ' + description : ''}`, 'info']);

  req.session.messages = [{ type: 'success', text: 'Money request sent to parent!' }];
  res.redirect('/child/dashboard');
});

// Request withdrawal
app.post('/child/withdrawal/request', requireAuth, requireRole('child'), async (req, res) => {
  const { amount, description } = req.body;
  const userId = req.session.user.id;

  if (!amount || amount <= 0) {
    req.session.messages = [{ type: 'error', text: 'Invalid amount' }];
    return res.redirect('/child/dashboard');
  }

  const wallet = await db.get('SELECT * FROM wallets WHERE user_id = ?', [userId]);
  if (!wallet) {
    req.session.messages = [{ type: 'error', text: 'Wallet not found' }];
    return res.redirect('/child/dashboard');
  }

  if (wallet.is_frozen) {
    req.session.messages = [{ type: 'error', text: 'Your wallet is frozen. Contact your parent.' }];
    return res.redirect('/child/dashboard');
  }

  if (wallet.balance < parseFloat(amount)) {
    req.session.messages = [{ type: 'error', text: 'Insufficient balance' }];
    return res.redirect('/child/dashboard');
  }

  const familyMember = await db.get(`
    SELECT fm.*, f.parent_id FROM family_members fm
    JOIN families f ON fm.family_id = f.id
    WHERE fm.user_id = ? AND fm.role = 'child'
  `, [userId]);

  if (!familyMember) {
    req.session.messages = [{ type: 'error', text: 'You are not part of a family' }];
    return res.redirect('/child/dashboard');
  }

  const requestId = generateId();
  await db.run('INSERT INTO withdrawal_requests (id, child_id, parent_id, amount, description, status) VALUES (?, ?, ?, ?, ?, ?)',
    [requestId, userId, familyMember.parent_id, parseFloat(amount), description || 'Withdrawal request', 'pending']);

  // Notify parent
  await db.run('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
    [generateId(), familyMember.parent_id, 'Withdrawal Request', `${req.session.user.name} requested withdrawal of ₹${amount}`, 'warning', requestId]);

  req.session.messages = [{ type: 'success', text: 'Withdrawal request sent for approval!' }];
  res.redirect('/child/dashboard');
});

// Create savings goal
app.post('/child/savings/create', requireAuth, requireRole('child'), async (req, res) => {
  const { title, targetAmount, description, targetDate } = req.body;
  const userId = req.session.user.id;

  if (!title || !targetAmount || targetAmount <= 0) {
    req.session.messages = [{ type: 'error', text: 'Title and target amount are required' }];
    return res.redirect('/child/dashboard');
  }

  const goalId = generateId();
  await db.run('INSERT INTO savings_goals (id, child_id, title, target_amount, description, target_date) VALUES (?, ?, ?, ?, ?, ?)',
    [goalId, userId, title, parseFloat(targetAmount), description || '', targetDate || null]);

  req.session.messages = [{ type: 'success', text: 'Savings goal created!' }];
  res.redirect('/child/dashboard');
});

// Add to savings goal
app.post('/child/savings/add', requireAuth, requireRole('child'), async (req, res) => {
  const { goalId, amount } = req.body;
  const userId = req.session.user.id;

  if (!goalId || !amount || amount <= 0) {
    req.session.messages = [{ type: 'error', text: 'Invalid amount' }];
    return res.redirect('/child/dashboard');
  }

  const wallet = await db.get('SELECT * FROM wallets WHERE user_id = ?', [userId]);
  if (!wallet || wallet.balance < parseFloat(amount)) {
    req.session.messages = [{ type: 'error', text: 'Insufficient balance' }];
    return res.redirect('/child/dashboard');
  }

  const goal = await db.get('SELECT * FROM savings_goals WHERE id = ? AND child_id = ?', [goalId, userId]);
  if (!goal) {
    req.session.messages = [{ type: 'error', text: 'Savings goal not found' }];
    return res.redirect('/child/dashboard');
  }

  const newBalance = wallet.balance - parseFloat(amount);
  const newGoalAmount = goal.current_amount + parseFloat(amount);
  const isCompleted = newGoalAmount >= goal.target_amount ? 1 : 0;
  const transactionId = generateId();

  await db.run('BEGIN TRANSACTION');
  try {
    await db.run('UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [newBalance, userId]);

    await db.run('UPDATE savings_goals SET current_amount = ?, is_completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newGoalAmount, isCompleted, goalId]);

    await db.run('INSERT INTO transactions (id, wallet_id, amount, type, description, status, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [transactionId, wallet.id, parseFloat(amount), 'savings', `Saved for ${goal.title}`, 'completed', goalId]);

    if (isCompleted) {
      await db.run('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        [generateId(), userId, 'Goal Completed!', `Congratulations! You've completed your savings goal: ${goal.title}`, 'success']);
    }

    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }

  req.session.messages = [{ type: 'success', text: `₹${amount} added to savings goal!` }];
  res.redirect('/child/dashboard');
});

// Child transaction history
app.get('/child/transactions', requireAuth, requireRole('child'), async (req, res) => {
  const userId = req.session.user.id;

  // Get family info
  const familyMember = await db.get(`
    SELECT fm.*, f.name as family_name, f.invitation_code
    FROM family_members fm
    JOIN families f ON fm.family_id = f.id
    WHERE fm.user_id = ? AND fm.role = 'child'
  `, [userId]);

  const wallet = await db.get('SELECT id FROM wallets WHERE user_id = ?', [userId]);
  let transactions = [];

  if (wallet) {
    transactions = await db.all(`
      SELECT * FROM transactions
      WHERE wallet_id = ?
      ORDER BY created_at DESC
    `, [wallet.id]);
  }

  res.render('child/transactions', {
    title: 'Transaction History - PocketNest',
    transactions,
    family: familyMember
  });
});

// Child notifications
app.get('/child/notifications', requireAuth, requireRole('child'), async (req, res) => {
  const userId = req.session.user.id;

  // Get family info
  const familyMember = await db.get(`
    SELECT fm.*, f.name as family_name, f.invitation_code
    FROM family_members fm
    JOIN families f ON fm.family_id = f.id
    WHERE fm.user_id = ? AND fm.role = 'child'
  `, [userId]);

  const notifications = await db.all(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
  `, [userId]);

  await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);

  res.render('child/notifications', {
    title: 'Notifications - PocketNest',
    notifications,
    family: familyMember
  });
});

// ==================== HOME ROUTE ====================
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'parent' ? '/parent/dashboard' : '/child/dashboard');
  }
  res.render('home', { title: 'PocketNest - Family Pocket Money Manager' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PocketNest server running on http://localhost:${PORT}`);
  console.log(`Network access: http://<your-ip>:${PORT}`);
});

module.exports = app;