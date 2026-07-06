# Celestial Daily — Native Mobile App (Capacitor)

This turns the existing web app into a real, installable iOS/Android app using
[Capacitor](https://capacitorjs.com/). The same React code runs inside a native
shell, so everything (daily readings, journal, share card) works as-is, and the
output is a genuine `.apk`/`.aab` and `.ipa` you can submit to the stores.

> The web build is unchanged — `npm run build` still produces `dist/` and the
> Vercel site keeps working. Capacitor just wraps that `dist/` output.

## Prerequisites

| Target | You need |
|--------|----------|
| Android | Node 18+, [Android Studio](https://developer.android.com/studio) (includes SDK + emulator). Builds on macOS/Windows/Linux. Play Console account ($25 one-time) to publish. |
| iOS | A **Mac** with [Xcode](https://developer.apple.com/xcode/), plus an Apple Developer account ($99/yr) to build on a device and publish. (No Mac? Use a cloud Mac build such as [Ionic Appflow](https://ionic.io/appflow) or GitHub Actions macOS runners.) |

## One-time setup

From the `celestial-daily/` folder:

```bash
# 1. Install dependencies (Capacitor is already in package.json)
npm install

# 2. Build the web assets
npm run build

# 3. Initialize native platform projects (creates android/ and ios/ folders)
npx cap add android
npx cap add ios        # macOS only

# 4. Generate app icons + splash screens from a source image
#    Put a 1024x1024 PNG at resources/icon.png and a 2732x2732 at resources/splash.png
npm run assets
```

`appId` (`com.celestialdaily.app`) and `appName` are set in
`capacitor.config.json` — change `appId` to your own reverse-domain identifier
before publishing (it can't be changed after the first store release).

## Develop / run

```bash
# Rebuild web + copy into native projects
npm run cap:sync

# Open the native IDE to run on a simulator or device
npm run cap:android      # opens Android Studio
npm run cap:ios          # opens Xcode (macOS)
```

Each time you change the web code, re-run `npm run cap:sync` (or the
`cap:android` / `cap:ios` scripts, which build + sync + open in one step).

## Build for the stores

**Android (Play Store)**
1. In Android Studio: *Build → Generate Signed Bundle / APK → Android App Bundle*.
2. Create/reuse an upload keystore (keep it safe — losing it blocks future updates).
3. Upload the resulting `.aab` in the [Play Console](https://play.google.com/console).

**iOS (App Store)**
1. In Xcode: set your Team under *Signing & Capabilities*.
2. *Product → Archive*, then *Distribute App → App Store Connect*.
3. Submit for review in [App Store Connect](https://appstoreconnect.apple.com).

## Recommended follow-ups (native polish)

These aren't required to run, but make it feel like a first-class app. Ask and
I'll implement them:

1. **Durable storage.** Journal notes currently use `localStorage`, which works
   in the WebView but the OS can evict it under storage pressure. Switching to
   `@capacitor/preferences` (already a dependency) stores notes in native
   storage that survives. This makes the note read/write async — a small refactor.
2. **Native share sheet.** The share card's download fallback (an `<a download>`
   click) does not work in a native WebView, so image sharing may fail on iOS.
   Wiring `@capacitor/share` + `@capacitor/filesystem` (already dependencies)
   writes the PNG to disk and opens the real native share sheet.
3. **Daily notification** reminding the user to read (and journal) their day.

## Notes

- Keep the Vercel web deploy as-is; it's independent of the native build.
- Commit the generated `android/` and `ios/` folders so builds are reproducible
  (their build outputs are gitignored — see `.gitignore`).
