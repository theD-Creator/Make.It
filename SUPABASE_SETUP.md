# Supabase für Make.It.

Die App verwendet Supabase Auth, Postgres und Storage. Im Browser wird ausschließlich die öffentliche Publishable Key genutzt. Ein Secret- oder Service-Role-Key gehört nie in das Frontend.

## Verbundenes Projekt

- Projekt: `snapgram`
- Ref: `iymxywnwxjziewjnfgto`
- Projekt-URL: `https://iymxywnwxjziewjnfgto.supabase.co`
- Frontend-Key: `sb_publishable_…` (liegt in `js/supabase.js` und ist für Browser-Apps vorgesehen)

## Datenbank

Die Einrichtung ist bereits auf das verbundene Supabase-Projekt angewendet. Das Skript `supabase_policies.sql` dokumentiert Tabellen, Auth-Trigger, RLS-Regeln und den Bild-Bucket. Öffentliche Rollen dürfen Profile und Posts lesen; Änderungen erfordern eine Supabase-Auth-Sitzung und sind auf das eigene Profil beschränkt. Nachrichten sind nur für Sender und Empfänger sichtbar.

## Anmeldung

Die Registrierung benötigt jetzt Vorname, Nachname, Nutzername, E-Mail-Adresse und Passwort. Supabase Auth verwaltet Passwörter und Sitzungen. Bei aktivierter E-Mail-Bestätigung muss der Bestätigungslink zur Web-App zurückführen.

Für GitHub Pages in Supabase unter **Authentication → URL Configuration** als Redirect URL eintragen:

`https://thed-creator.github.io/Make.It/`

Wenn E-Mail-Bestätigungen für alle Nutzer versendet werden sollen, in Supabase einen eigenen SMTP-Anbieter einrichten. Supabases Standard-Mailversand ist für produktive öffentliche Registrierungen begrenzt.

## Alte Konten

Vier ältere Profile und drei Posts waren bereits vorhanden und bleiben erhalten. Die alten Konten nutzten ein eigenes Passwort-Hash-Verfahren ohne Supabase Auth. Diese Passwörter werden nicht weiter zur Anmeldung verwendet. Neue Konten benötigen einen noch freien Nutzernamen; bestehende öffentliche Profile und Posts bleiben sichtbar.

## Bild- und Kontolöschung

Bilder werden im öffentlichen Bucket `snapgram-images` gespeichert. Uploads und Änderungen sind auf den eigenen Auth-Ordner beschränkt. Die Edge Function `delete-account` löscht auf ausdrückliche Nutzeraktion die zugehörigen Bilder, Posts, Nachrichten, Follower und das Auth-Konto.
