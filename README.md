# SnapGram

Web-App mit Feed, Kamera, Suche, Profil und DMs.

## Lokal starten

- `index.html` direkt im Browser öffnen

## APK Build (Android mit Capacitor)

### Voraussetzungen

- Node.js 20+
- Android Studio (inkl. SDK + Platform Tools)
- `JAVA_HOME` gesetzt (JDK 17 empfohlen)

### Setup

1. Im Projektordner:
   - `npm install`
2. Android-Projekt erzeugen:
   - `npx cap add android`
3. Assets synchronisieren:
   - `npm run cap:sync`

### Debug APK bauen

- `npm run apk:debug`

Danach liegt die APK hier:
- `D:\Snapgram\android\app\build\outputs\apk\debug\app-debug.apk`

### Release APK bauen

- `npm run apk:release`

Danach liegt die APK hier:
- `D:\Snapgram\android\app\build\outputs\apk\release\app-release.apk`

### Android Studio öffnen (optional)

- `npm run cap:open:android`
