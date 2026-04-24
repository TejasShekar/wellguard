# Firebase Setup

One-time setup per Firebase project. The RN app and the AP companion PWA share the same Firebase project and Firestore database.

## 1. Create the project

[console.firebase.google.com](https://console.firebase.google.com) → **Add project**. Name: `wellguard` (or anything). Disable Google Analytics — not needed.

## 2. Register the Android app

Project Overview → **Add app** → Android:

- **Package name:** `com.wellguard`
- **App nickname:** WellGuard Android
- **Debug signing SHA-1:** skip for now (not needed for email/password auth)

Download `google-services.json` → save as:

```
android/app/google-services.json
```

This file is git-ignored. Every developer needs to download it themselves (or share it out-of-band).

## 3. Enable Email/Password authentication

Authentication → **Get started** → **Email/Password** provider → **Enable**.

Leave "Email link (passwordless sign-in)" off.

## 4. Create Firestore database

Firestore Database → **Create database** → **Native mode** → pick a region (`asia-south1` / Mumbai if based in India, otherwise `nam5` US multi-region).

Start in **production mode** (locked) — rules will be deployed in step 5.

## 5. Deploy Firestore security rules

Firestore → Rules tab → paste the contents of [`firestore.rules`](./firestore.rules) → **Publish**.

Rules are scoped:
- Users read/write their own doc; APs can read a user's doc only if listed in `apIds`.
- `unblockRequests` / `removalRequests`: the owning user creates, the designated AP resolves (updates `status`).
- `accountabilityPartners`: user creates + manages; AP can read/update their own record.

## 6. Enable FCM (Cloud Messaging)

Cloud Messaging is enabled automatically once the Android app is registered. No additional setup on the Firebase side.

## Verify the build

After `google-services.json` is in place:

```sh
npm run android
```

Gradle should apply the `com.google.gms.google-services` plugin without complaint. If the app launches and reaches the sign-in screen, wiring is correct.

## Dev credentials

During development we use:

- Email: `test@wellguard.com`
- Password: `test@123`

Create this user once via the in-app **Sign up** toggle. The sign-in screen pre-fills these values for convenience.
