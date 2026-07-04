# Miga — App Store / Google Play compliance checklist

## Both stores
- [x] App opens into real functionality (sign-in → Today), no marketing walls.
- [x] Account deletion inside the app (Profile → Delete account & data) — required
      by Apple 5.1.1(v) and Play User Data policy.
- [x] Medical disclaimer visible (onboarding + Profile → Privacy) — the app gives
      general nutrition info, not medical advice (Apple 1.4.1, Play Health apps).
- [x] Subscriptions via native IAP (RevenueCat). No external payment links for
      digital goods inside the app. Stripe reserved for a future web portal only.
- [x] Subscription legal copy on the paywall (`premium.legal`): price, renewal,
      cancellation terms.
- [ ] Store listing: privacy policy URL (host docs/privacy.md content publicly).
- [ ] Restore purchases visible on the paywall (implemented — verify in review).

## Apple specifics
- Privacy Nutrition Labels (App Store Connect): declares collection of
  Contact Info (email), Health & Fitness (nutrition, weight — linked to user,
  not for tracking), User Content (photos processed transiently, not stored),
  Purchases. "Data Used to Track You": none.
- `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` localized via
  `locales` (en/es) in app.config.ts.
- HealthKit (when enabled): `NSHealthShareUsageDescription` /
  `NSHealthUpdateUsageDescription` already localized; HealthKit data must never
  be used for advertising (Apple 5.1.3) — see privacy.md, we don't.
- Sign in with Apple offered because third-party login (Google) exists (4.8).
- Encryption: `usesNonExemptEncryption=false` (standard HTTPS only).

## Google Play specifics
- Data safety form mirrors the Apple labels; mark health data as not shared.
- Health Connect (when enabled) requires the Health apps declaration form and
  a public privacy policy describing health data use.
- Account deletion URL also required in the Data safety section — can point to
  a web page describing the in-app flow.

## EU specifics
- GDPR: see privacy.md (lawful bases, erasure, export, processors/DPAs).
- DSA trader status: complete the trader declaration in both consoles before
  charging EU users.
- Prices shown by RevenueCat include VAT (store-handled).
