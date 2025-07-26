# WeaselParts - Development Workflow

## WICHTIGE REGELN FÜR CLAUDE CODE

### Entwicklungsumgebung
- **IMMER in `~/weaselparts` arbeiten** (lokale Entwicklung)
- **NIEMALS** `docker-compose.yml` oder `.env` Dateien ändern
- **NUR** Anwendungscode bearbeiten: `server.js`, `public/`, `package.json`, etc.

### Datenbank-Zugang
- **KEINE Datenbank-Verbindung** in lokaler Entwicklung
- Die Anwendung wird später auf Ubuntu-Server deployed
- **Datenbank läuft auf externem Server**: `129.247.232.14`
- Nur Mock-Daten oder Offline-Entwicklung möglich

### Deployment-Prozess
Nach Entwicklung in `~/weaselparts`:

1. **Code nach weaselparts-main kopieren:**
```bash
cd ~/weaselparts-main
cp ~/weaselparts/server.js ./
cp ~/weaselparts/package.json ./
cp -r ~/weaselparts/public ./
# NIEMALS: docker-compose.yml oder .env kopieren!
```

2. **Git Push:**
```bash
git add .
git commit -m "Beschreibung der Änderungen"
git push origin main
```

3. **Ubuntu-Server Update (manuell von Michael):**
```bash
# Das macht Michael selbst auf dem Ubuntu-Server:
cd ~/weaselparts
git pull origin main
docker-compose down
docker-compose up -d --build
```

## Repository-Struktur
- `~/weaselparts` → Lokale Entwicklung (Repository: weaselparts.git)
- `~/weaselparts-main` → Deployment (Repository: weaselparts2.git)
- Ubuntu-Server → Production (klont von weaselparts2.git)

## Zu vermeiden
- ❌ Direkte Datenbank-Verbindungen testen
- ❌ Docker-Konfiguration ändern
- ❌ .env Dateien bearbeiten
- ❌ Produktions-spezifische Einstellungen ändern

## Bei neuem Chat
Diese Datei zuerst lesen lassen!