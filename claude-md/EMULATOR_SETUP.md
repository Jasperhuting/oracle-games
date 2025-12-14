# Firebase Emulator Setup

This guide explains how to use Firebase Emulators for local testing with admin and user accounts.

## What are Firebase Emulators?

Firebase Emulators let you test your app locally without affecting production data. They provide:
- **Auth Emulator**: Test authentication flows
- **Firestore Emulator**: Test database operations
- **Emulator UI**: Visual interface to manage test data

## Quick Start

### 1. Start the Emulators

In one terminal, start the Firebase emulators:

```bash
npm run emulators
```

This will start:
- **Auth Emulator**: http://127.0.0.1:9099
- **Firestore Emulator**: http://127.0.0.1:8080
- **Emulator UI**: http://127.0.0.1:4000

### 2. Seed Test Users

In another terminal, create test accounts:

```bash
npm run emulators:seed
```

This creates three test accounts:
- **Admin**: `admin@test.com` / `admin123`
- **User**: `user@test.com` / `user123`
- **User 2**: `user2@test.com` / `user123`

### 3. Start Your App

In a third terminal, start your Next.js app:

```bash
npm run dev
```

Your app will automatically detect and connect to the emulators in development mode.

## Using the Emulators

### Login with Test Accounts

1. Go to http://localhost:3210/login
2. Use one of the test accounts:
   - **Admin**: `admin@test.com` / `admin123`
   - **User**: `user@test.com` / `user123`

### View Emulator UI

Open http://127.0.0.1:4000 to:
- View all test users
- Browse Firestore data
- Manually create/edit data
- Clear all data

### Switch Between Accounts

Simply logout and login with a different test account.

## Data Persistence

Emulator data is saved to `./emulator-data` and persists between restarts.

### Clear All Data

To start fresh:

```bash
npm run emulators:clear
```

Then re-seed:

```bash
npm run emulators:seed
```

## How It Works

The app automatically detects emulators in development:

1. When `NODE_ENV === 'development'`, the Firebase client tries to connect to emulators
2. If emulators are running, it connects automatically
3. If emulators are NOT running, it falls back to production Firebase

**No code changes needed** - just start/stop the emulators!

## Tips

- **Keep emulators running**: Leave them running while developing
- **Use Emulator UI**: Great for inspecting/debugging data at http://127.0.0.1:4000
- **Production safety**: Emulators only work in development mode
- **Port conflicts**: If ports are in use, edit `firebase.json` to change them

## Troubleshooting

### "Address already in use"

Stop any running processes on ports 9099, 8080, or 4000, or change ports in `firebase.json`.

### App not connecting to emulators

Check the browser console for the connection message:
- ✅ `🔧 Connected to Firebase Emulators` - Working!
- ❌ `📡 Using production Firebase` - Emulators not detected

### Need to reset everything

```bash
npm run emulators:clear
npm run emulators:seed
```
