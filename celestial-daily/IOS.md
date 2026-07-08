# Shipping Celestial Daily to iOS

You can build and submit the iOS app **with or without a Mac**. Read the path
that matches your setup. All paths require one thing:

## Required no matter what: Apple Developer Program

- Enroll at <https://developer.apple.com/programs/> — **$99/year**. This is
  mandatory to run on a real device, use TestFlight, or submit to the App Store.
- Once enrolled, you'll create an **App Store Connect API key** (used by cloud
  builders to sign/upload without a Mac): App Store Connect → Users and Access →
  Integrations → App Store Connect API → generate a key. Save the `.p8` file,
  the **Key ID**, and the **Issuer ID**.
- Register the app's bundle id `com.celestialdaily.app` under Certificates,
  Identifiers & Profiles → Identifiers (or let automatic signing create it).

---

## Path A — You have a Mac (simplest)

```bash
cd celestial-daily
npm install
npm run build
npx cap add ios
npm run cap:ios          # builds, syncs, opens Xcode
```
In Xcode:
1. Select the **App** target → **Signing & Capabilities** → check *Automatically
   manage signing* and pick your Team.
2. **Product → Archive**.
3. **Distribute App → App Store Connect → Upload**.
4. Finish in [App Store Connect](https://appstoreconnect.apple.com): screenshots,
   description, then submit for review.

---

## Path B — No Mac: managed cloud build (recommended)

[**Codemagic**](https://codemagic.io) has first-class Capacitor support, a free
tier, real macOS builders, and a UI that handles Apple code signing for you —
much less fiddly than hand-rolled CI signing.

1. Sign up, connect this GitHub repo, pick the `celestial-daily` app.
2. In the workflow settings choose **Capacitor / iOS**.
3. Add your **App Store Connect API key** (`.p8`, Key ID, Issuer ID) under
   *Team settings → Code signing identities*. Codemagic uses it for automatic
   signing and TestFlight upload.
4. Set bundle id `com.celestialdaily.app`, enable *Automatic* signing, and turn
   on *Publish to App Store Connect (TestFlight)*.
5. Start the build. When it's green, the build appears in TestFlight; from there
   promote to App Store review in App Store Connect.

(Ionic Appflow is a similar managed alternative if you prefer.)

---

## Path C — No Mac: GitHub Actions

This repo already includes `.github/workflows/ios-build.yml`, which compiles the
app **unsigned** on a macOS runner on every push to `main` — a free sanity check
that the iOS project builds (public repos get free macOS minutes). It needs no
Apple account.

To turn that into a **signed TestFlight upload**, add a release workflow that:
1. Imports your distribution certificate + provisioning profile (or uses the
   App Store Connect API key for automatic signing with
   `xcodebuild -allowProvisioningUpdates`).
2. Runs `xcodebuild archive` then `-exportArchive` with an `ExportOptions.plist`.
3. Uploads with `xcrun altool`/`notarytool` or **fastlane pilot**.

Hand-rolled iOS signing in CI is the brittle part, which is why Path B is
recommended for a first release. If you want to go this route anyway, tell me and
I'll add the release workflow — you'll need these repo **Secrets**:
`APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`, `APPSTORE_API_PRIVATE_KEY`,
`BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `BUILD_PROVISION_PROFILE_BASE64`,
`KEYCHAIN_PASSWORD`.

---

## App icon & splash

Before submitting, generate real assets (Apple rejects the default icon):
```bash
# put a 1024x1024 PNG at celestial-daily/resources/icon.png
npm run assets
```

## Before you submit — checklist

- [ ] Unique bundle id set in `capacitor.config.json` (currently `com.celestialdaily.app`).
- [ ] App icon + splash generated.
- [ ] Privacy: the app stores journal notes only on-device (no tracking) — declare
      "Data Not Collected" in App Store Connect privacy.
- [ ] Screenshots for required device sizes.
- [ ] Since horoscopes are entertainment, keep the "for entertainment" framing in
      the description to avoid review pushback.
