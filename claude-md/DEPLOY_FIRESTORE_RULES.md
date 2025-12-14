# Deploy Firestore Security Rules

The Firestore security rules have been updated to allow admin users to read all user documents for the realtime user list.

## To deploy the rules:

1. Make sure you have Firebase CLI installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select your Firebase project
   - Use `firestore.rules` as the rules file

4. Deploy the Firestore rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

## What changed:

- Added `isAdmin()` helper function that checks if the authenticated user has `userType == 'admin'`
- Updated users collection rules to allow admins to read all user documents
- Regular users can still only read their own document
- This enables the realtime user list on the admin dashboard

## Security:

✅ Only authenticated users can access
✅ Only admin users can read all users
✅ Regular users can only read their own data
✅ No one can delete user documents
