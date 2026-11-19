# PocketNest - Family Pocket Money Management

A complete, full-stack pocket money management website for families. Built with Node.js, Express, SQLite, and vanilla JavaScript.

## Features

### For Parents
- Create and manage family groups
- Generate invitation codes for children
- Add/deduct money from children's wallets
- Approve/reject withdrawal requests
- Set spending limits (daily/weekly/monthly)
- Freeze/unfreeze wallets
- View transaction history for all children
- Receive notifications for requests and activities

### For Children
- Join family using invitation code
- View wallet balance and transaction history
- Request money from parents
- Request withdrawals (requires parent approval)
- Create and track savings goals with progress bars
- View spending limits
- Receive notifications for approvals/rejections

### Technical Features
- **Secure Authentication**: bcrypt password hashing, session management
- **Role-based Access Control**: Parent and Child dashboards
- **Real-time Updates**: Instant balance updates across family
- **SQLite Database**: Lightweight, file-based storage
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern UI**: Purple/white fintech-inspired design

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **Authentication**: express-session, bcryptjs
- **Templating**: EJS
- **Frontend**: HTML5, CSS3 (CSS Variables), Vanilla JavaScript (ES6+)
- **Icons**: Inline SVG

## Project Structure

```
PocketNest-V2/
├── package.json
├── README.md
├── database/
│   └── schema.js          # Database initialization & tables
├── src/
│   ├── app.js             # Main application entry point
├── public/
│   ├── css/
│   │   └── style.css      # Complete stylesheet
│   └── js/
│       └── main.js        # Client-side JavaScript
└── views/
    ├── layout.ejs         # Base layout
    ├── home.ejs           # Landing page
    ├── auth/
    │   ├── login.ejs      # Login page
    │   └── register.ejs   # Registration page
    ├── parent/
    │   ├── dashboard.ejs  # Parent dashboard
    │   ├── transactions.ejs
    │   └── notifications.ejs
    └── child/
        ├── dashboard.ejs  # Child dashboard
        ├── transactions.ejs
        └── notifications.ejs
```

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm (comes with Node.js)

### Installation

1. **Navigate to the project directory:**
   ```bash
   cd PocketNest-V2
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   Navigate to `http://localhost:3000`

### Development

For development with auto-restart (if you have nodemon):
```bash
npx nodemon src/app.js
```

## Usage Guide

### For Parents

1. **Register** as a Parent at `/register`
2. **Login** at `/login`
3. **Create a Family** - Enter a family name on the dashboard
4. **Get Invitation Code** - Click "Invitation Code" button to see the code
5. **Share Code** with your children
6. **Manage Money** - Add/deduct money, set limits, approve requests

### For Children

1. **Register** as a Child at `/register`
2. **Login** at `/login`
3. **Join Family** - Enter the invitation code from your parent
4. **Start Using** - View balance, request money, create savings goals

## Database Schema

The application creates these tables automatically:

- **users** - User accounts (parents & children)
- **families** - Family groups with invitation codes
- **family_members** - Links users to families with roles
- **wallets** - Individual wallets with balance, limits, freeze status
- **transactions** - All financial transactions with types & statuses
- **withdrawal_requests** - Child withdrawal requests pending approval
- **notifications** - In-app notifications for both roles
- **savings_goals** - Children's savings goals with progress tracking
- **spending_limits** - Configurable spending limits per child

## Security Features

- Passwords hashed with bcrypt (10 rounds)
- Secure session cookies (httpOnly, 24hr expiry)
- Role-based route protection
- Input validation on frontend & backend
- SQL injection prevention via parameterized queries
- Family isolation - parents only see their family's data

## Customization

### Colors
Edit CSS variables in `public/css/style.css`:
```css
:root {
  --primary: #A855F7;        /* Main purple */
  --primary-dark: #9333EA;   /* Darker purple */
  --secondary: #6366F1;      /* Indigo accent */
  --accent: #EC4899;         /* Pink accent */
}
```

### Currency
Change currency in `src/app.js` and `public/js/main.js`:
- Default: Indian Rupees (₹)
- Modify `formatCurrency()` function for other currencies

## API Endpoints

### Authentication
- `GET /login` - Login page
- `POST /login` - Handle login
- `GET /register` - Register page
- `POST /register` - Handle registration
- `GET /logout` - Logout

### Parent Routes
- `GET /parent/dashboard` - Parent dashboard
- `POST /parent/family/create` - Create family
- `GET /parent/family/invitation` - Get invitation code
- `POST /parent/wallet/add` - Add money to child
- `POST /parent/wallet/deduct` - Deduct money from child
- `POST /parent/wallet/toggle-freeze` - Freeze/unfreeze wallet
- `POST /parent/wallet/set-limit` - Set spending limit
- `POST /parent/withdrawal/approve` - Approve withdrawal
- `POST /parent/withdrawal/reject` - Reject withdrawal
- `GET /parent/transactions` - Transaction history
- `GET /parent/notifications` - Notifications

### Child Routes
- `GET /child/dashboard` - Child dashboard
- `POST /child/family/join` - Join family
- `POST /child/money/request` - Request money
- `POST /child/withdrawal/request` - Request withdrawal
- `POST /child/savings/create` - Create savings goal
- `POST /child/savings/add` - Add to savings goal
- `GET /child/transactions` - Transaction history
- `GET /child/notifications` - Notifications

## Troubleshooting

### Port Already in Use
```bash
# Change PORT in src/app.js or use:
PORT=3001 npm start
```

### Database Issues
Delete `database/pocketnest.db` and restart - it will recreate automatically.

### Module Not Found
```bash
rm -rf node_modules package-lock.json
npm install
```

## License

MIT License - Feel free to use for personal or educational purposes.

## Contributing

This is a learning project. Feel free to fork and enhance!

---

**Built with ❤️ for families learning financial responsibility together.**