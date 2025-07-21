# WeaselParts Docker Deployment

Diese Anleitung zeigt, wie Sie WeaselParts mit Docker auf Ubuntu (oder anderen Linux-Distributionen) zum Laufen bringen.

## Voraussetzungen

1. **Docker installieren**:
   ```bash
   # Update system
   sudo apt update
   sudo apt upgrade -y

   # Install Docker
   sudo apt install -y docker.io
   sudo systemctl start docker
   sudo systemctl enable docker

   # Add user to docker group (optional, to run docker without sudo)
   sudo usermod -aG docker $USER
   # Nach diesem Befehl einmal abmelden und wieder anmelden
   ```

2. **Docker Compose installieren**:
   ```bash
   # Install Docker Compose
   sudo apt install -y docker-compose
   ```

3. **Git installieren** (falls nicht vorhanden):
   ```bash
   sudo apt install -y git
   ```

## Deployment

1. **Repository klonen**:
   ```bash
   git clone https://github.com/michaelwrasmann/weaselparts.git
   cd weaselparts
   ```

2. **Docker Container starten**:
   ```bash
   # Container im Hintergrund starten
   docker-compose up -d
   ```

3. **Status prüfen**:
   ```bash
   # Container-Status anzeigen
   docker-compose ps
   
   # Logs anzeigen
   docker-compose logs -f app
   ```

4. **Anwendung öffnen**:
   - Öffnen Sie einen Browser und gehen Sie zu: `http://localhost:3000`
   - Die API ist unter `http://localhost:3000/api/test` testbar

## Nützliche Befehle

### Container-Verwaltung
```bash
# Container stoppen
docker-compose down

# Container neu starten
docker-compose restart

# Container stoppen und Volumes löschen (ACHTUNG: Alle Daten gehen verloren!)
docker-compose down -v
```

### Logs und Debugging
```bash
# Alle Logs anzeigen
docker-compose logs

# Nur App-Logs anzeigen
docker-compose logs app

# Nur Datenbank-Logs anzeigen
docker-compose logs postgres

# Live-Logs verfolgen
docker-compose logs -f app
```

### Datenbank-Zugriff
```bash
# PostgreSQL-Container öffnen
docker-compose exec postgres psql -U weaselparts -d weaselparts

# Backup erstellen
docker-compose exec postgres pg_dump -U weaselparts weaselparts > backup.sql

# Backup wiederherstellen
docker-compose exec -T postgres psql -U weaselparts -d weaselparts < backup.sql
```

## Konfiguration

### Ports anpassen
Falls Port 3000 bereits verwendet wird, können Sie ihn in der `docker-compose.yml` ändern:
```yaml
ports:
  - "8080:3000"  # Beispiel: localhost:8080 statt localhost:3000
```

### Datenbank-Passwort ändern
In der `docker-compose.yml` können Sie das Datenbank-Passwort ändern:
```yaml
environment:
  POSTGRES_PASSWORD: ihr_neues_passwort
```
Vergessen Sie nicht, auch die `DATABASE_URL` entsprechend anzupassen.

## Fehlerbehebung

### Container startet nicht
```bash
# Container-Status prüfen
docker-compose ps

# Logs überprüfen
docker-compose logs app
docker-compose logs postgres
```

### Datenbank-Verbindungsfehler
```bash
# PostgreSQL-Container-Health prüfen
docker-compose exec postgres pg_isready -U weaselparts -d weaselparts

# Container neu starten
docker-compose restart postgres
docker-compose restart app
```

### Port bereits verwendet
```bash
# Prüfen, welcher Prozess Port 3000 verwendet
sudo netstat -tulnp | grep 3000

# Oder mit ss
sudo ss -tulnp | grep 3000
```

### Komplett neu starten
```bash
# Alle Container stoppen und entfernen
docker-compose down

# Images neu bauen
docker-compose build --no-cache

# Container starten
docker-compose up -d
```

## Systemanforderungen

- **RAM**: Mindestens 1GB verfügbar
- **Speicherplatz**: Mindestens 2GB für Images und Datenbank
- **Netzwerk**: Port 3000 und 5432 müssen verfügbar sein

## Sicherheitshinweise

- Für Produktionsumgebungen sollten Sie:
  - Ein stärkeres Datenbank-Passwort verwenden
  - SSL/TLS konfigurieren
  - Firewall-Regeln einrichten
  - Regelmäßige Backups erstellen

## Updates

```bash
# Neuste Version vom Repository holen
git pull origin main

# Container neu starten
docker-compose down
docker-compose up -d --build
```