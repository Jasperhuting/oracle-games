# 🚀 Quick Start: Testing with Admin & User Accounts

## Step-by-Step Guide

### Terminal 1: Start Emulators
```bash
npm run emulators
```
✅ Wait for: "All emulators ready!"

### Terminal 2: Seed Test Accounts
```bash
npm run emulators:seed
```
✅ Creates admin@test.com and user@test.com

### Terminal 3: Start Your App
```bash
npm run dev
```
✅ App auto-connects to emulators

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@test.com` | `admin123` | Admin |
| `user@test.com` | `user123` | User |
| `user2@test.com` | `user123` | User |

## Testing Flow

1. **Login as Admin**
   - Go to http://localhost:3210/login
   - Use: `admin@test.com` / `admin123`
   - ✅ You'll see the "Admin" menu item
   - ✅ Can access /admin page

2. **Logout & Login as User**
   - Click profile → Logout
   - Login with: `user@test.com` / `user123`
   - ✅ No "Admin" menu item
   - ✅ Cannot access /admin page

3. **View Data in Emulator UI**
   - Open: http://127.0.0.1:4000
   - Browse users, games, etc.

## Useful Links

- **Your App**: http://localhost:3210
- **Emulator UI**: http://127.0.0.1:4000
- **Auth Emulator**: http://127.0.0.1:9099
- **Firestore Emulator**: http://127.0.0.1:8080

## Common Commands

```bash
# Start fresh (clear all data)
npm run emulators:clear

# Re-seed test accounts
npm run emulators:seed

# Stop emulators
Ctrl+C in the emulator terminal
```

## Tips

- 💡 Keep emulators running while developing
- 💡 Data persists between restarts (saved in `emulator-data/`)
- 💡 Use Emulator UI to inspect/modify data
- 💡 Production data is never affected
