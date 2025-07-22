// WeaselParts Server - MySQL Version
// Moderne Bauteile-Verwaltung mit Barcode-Scanner

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Express-Anwendung initialisieren
const app = express();

// MySQL-Verbindungspool mit deinen Datenbankdaten
let pool;

function createMySQLPool() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'mysql-backup',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'weaselparts',
    password: process.env.DB_PASSWORD || 'weaselparts_password',
    database: process.env.DB_DATABASE || 'weaselparts_local',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    charset: 'utf8mb4',
    ssl: false // Deaktiviert für lokale/interne Verbindungen
  });
  
  console.log('🔗 MySQL Pool erstellt für:', process.env.DB_HOST || 'mysql-backup');
  return pool;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Statische Dateien servieren
app.use(express.static(path.join(__dirname, 'public')));

// Logging für Debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Upload-Ordner erstellen falls nicht vorhanden
const uploadsDir = path.join(__dirname, 'public/uploads/components');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer für Datei-Uploads konfigurieren
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    const barcode = req.params.barcode || req.params.id;
    const extension = path.extname(file.originalname);
    cb(null, `${barcode}${extension}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function(req, file, cb) {
    // Nur Bilder erlauben
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien sind erlaubt!'), false);
    }
  }
});

async function initializeDatabase() {
  try {
    console.log('📊 Initialisiere MySQL-Datenbank...');
    
    if (!pool) {
      createMySQLPool();
    }
    
    // Test der Verbindung
    const connection = await pool.getConnection();
    console.log('✅ MySQL-Verbindung erfolgreich');
    connection.release();
    
    // Schränke-Tabelle erstellen
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS schraenke (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        standort VARCHAR(255),
        beschreibung TEXT,
        image_url LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabelle "schraenke" erstellt/geprüft');

    // Bauteile-Tabelle erstellen
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS bauteile (
        id INT AUTO_INCREMENT PRIMARY KEY,
        barcode VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        beschreibung TEXT,
        project VARCHAR(255),
        responsible_engineer VARCHAR(255),
        standard VARCHAR(255),
        schrank_id INT,
        menge INT DEFAULT 1,
        status VARCHAR(50) DEFAULT 'eingelagert',
        image_url LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bauteile_schrank_id (schrank_id),
        INDEX idx_bauteile_barcode (barcode),
        FOREIGN KEY (schrank_id) REFERENCES schraenke(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabelle "bauteile" erstellt/geprüft');
    
    // Activity Records Tabelle erstellen
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS activity_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bauteil_barcode VARCHAR(255) NOT NULL,
        entry_made_by VARCHAR(255),
        organisation VARCHAR(255),
        location VARCHAR(255),
        further_operators TEXT,
        activity_assy BOOLEAN DEFAULT FALSE,
        activity_disassy BOOLEAN DEFAULT FALSE,
        activity_test BOOLEAN DEFAULT FALSE,
        activity_shpf BOOLEAN DEFAULT FALSE,
        activity_insp BOOLEAN DEFAULT FALSE,
        activity_cln BOOLEAN DEFAULT FALSE,
        activity_smpl BOOLEAN DEFAULT FALSE,
        activity_cal BOOLEAN DEFAULT FALSE,
        activity_hndl BOOLEAN DEFAULT FALSE,
        activity_stor BOOLEAN DEFAULT FALSE,
        activity_de_stor BOOLEAN DEFAULT FALSE,
        procedure_number VARCHAR(255),
        date DATE,
        start_time TIME,
        end_time TIME,
        humidity_start DECIMAL(5,2),
        humidity_end DECIMAL(5,2),
        temperature_start DECIMAL(5,2),
        temperature_end DECIMAL(5,2),
        remarks TEXT,
        activity_description TEXT,
        reports TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_activity_bauteil_barcode (bauteil_barcode),
        INDEX idx_activity_date (date),
        FOREIGN KEY (bauteil_barcode) REFERENCES bauteile(barcode) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabelle "activity_records" erstellt/geprüft');
    
    // Index für Schränke
    await pool.execute(`
      CREATE INDEX IF NOT EXISTS idx_schraenke_name ON schraenke(name)
    `).catch(() => {}); // Ignoriere Fehler wenn Index bereits existiert
    
    // Spalte für Schrank-Bilder hinzufügen (falls nicht vorhanden)
    await pool.execute(`
      ALTER TABLE schraenke 
      ADD COLUMN IF NOT EXISTS image_url LONGTEXT
    `).catch(() => {
      // Ignoriere Fehler wenn Spalte bereits existiert
      console.log('Spalte image_url existiert bereits');
    });
    
    console.log('✅ MySQL-Datenbank erfolgreich initialisiert');
    
  } catch (error) {
    console.error('❌ Fehler bei der MySQL-Datenbank-Initialisierung:', error);
    throw error;
  }
}

// === API ENDPUNKTE ===

// Test-Endpunkt
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'WeaselParts MySQL API funktioniert!',
    timestamp: new Date().toISOString(),
    version: '2.0.0-mysql',
    database: 'MySQL auf ' + (process.env.DB_HOST || 'mysql-backup')
  });
});

// === SCHRANK-ENDPUNKTE ===

// Alle Schränke abrufen
app.get('/api/schraenke', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        s.*,
        COUNT(b.barcode) as component_count
      FROM schraenke s
      LEFT JOIN bauteile b ON s.id = b.schrank_id
      GROUP BY s.id
      ORDER BY s.name
    `);
    
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Schränke:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Laden der Schränke' });
  }
});

// Neuen Schrank erstellen
app.post('/api/schraenke', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    
    if (name.trim().length < 2) {
      return res.status(400).json({ error: 'Name muss mindestens 2 Zeichen lang sein' });
    }
    
    // Prüfen, ob Schrank bereits existiert
    const [existing] = await pool.execute('SELECT id FROM schraenke WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ein Schrank mit diesem Namen existiert bereits' });
    }
    
    // Schrank erstellen
    const [result] = await pool.execute(
      'INSERT INTO schraenke (name) VALUES (?)',
      [name.trim()]
    );
    
    // Erstellten Schrank zurückgeben
    const [newCabinet] = await pool.execute(
      'SELECT * FROM schraenke WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newCabinet[0]);
  } catch (error) {
    console.error('Fehler beim Erstellen des Schranks:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Erstellen des Schranks' });
  }
});

// Schrank aktualisieren (Name und optional Bild)
app.put('/api/schraenke/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Ungültige Schrank-ID' });
    }
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    
    if (name.trim().length < 2) {
      return res.status(400).json({ error: 'Name muss mindestens 2 Zeichen lang sein' });
    }
    
    // Prüfen, ob Schrank existiert
    const [existing] = await pool.execute('SELECT * FROM schraenke WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Schrank nicht gefunden' });
    }
    
    // Prüfen, ob Name bereits verwendet wird (außer vom aktuellen Schrank)
    const [nameCheck] = await pool.execute('SELECT id FROM schraenke WHERE name = ? AND id != ?', [name.trim(), id]);
    if (nameCheck.length > 0) {
      return res.status(400).json({ error: 'Ein Schrank mit diesem Namen existiert bereits' });
    }
    
    // Schrank aktualisieren
    await pool.execute(
      'UPDATE schraenke SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name.trim(), id]
    );
    
    // Aktualisierten Schrank zurückgeben
    const [updated] = await pool.execute('SELECT * FROM schraenke WHERE id = ?', [id]);
    
    res.json({
      message: 'Schrank erfolgreich aktualisiert',
      cabinet: updated[0]
    });
    
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Schranks:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Aktualisieren des Schranks' });
  }
});

// Schrank löschen
app.delete('/api/schraenke/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Ungültige Schrank-ID' });
    }
    
    // Prüfen, ob Schrank existiert
    const [cabinet] = await pool.execute('SELECT * FROM schraenke WHERE id = ?', [id]);
    if (cabinet.length === 0) {
      return res.status(404).json({ error: 'Schrank nicht gefunden' });
    }
    
    // Alle Bauteile aus diesem Schrank auslagern
    await pool.execute('UPDATE bauteile SET schrank_id = NULL WHERE schrank_id = ?', [id]);
    
    // Schrank löschen
    await pool.execute('DELETE FROM schraenke WHERE id = ?', [id]);
    
    res.json({ 
      message: 'Schrank erfolgreich gelöscht',
      deletedCabinet: cabinet[0]
    });
  } catch (error) {
    console.error('Fehler beim Löschen des Schranks:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Löschen des Schranks' });
  }
});

// Bild für Schrank hochladen
app.post('/api/schraenke/:id/bild', upload.single('image'), async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Ungültige Schrank-ID' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Kein Bild hochgeladen' });
  }

  try {
    // Prüfen, ob Schrank existiert
    const [existing] = await pool.execute('SELECT * FROM schraenke WHERE id = ?', [id]);
    if (existing.length === 0) {
      // Lösche die hochgeladene Datei
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Schrank nicht gefunden' });
    }

    // Bild als Base64 konvertieren
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
    
    // Base64-Bild in der Datenbank speichern
    await pool.execute(
      'UPDATE schraenke SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [base64Image, id]
    );

    // Lösche die temporäre Datei nach dem Speichern in der DB
    fs.unlinkSync(req.file.path);

    // Aktualisierten Schrank zurückgeben
    const [updated] = await pool.execute('SELECT * FROM schraenke WHERE id = ?', [id]);

    res.json({ 
      message: 'Bild erfolgreich hochgeladen',
      image_url: base64Image,
      cabinet: updated[0]
    });
    
  } catch (error) {
    console.error('Fehler beim Hochladen des Schrank-Bildes:', error);
    
    // Lösche die hochgeladene Datei bei Fehler
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Fehler beim Löschen der temporären Datei:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Interner Serverfehler beim Hochladen des Bildes' });
  }
});

// Inhalt eines Schranks abrufen
app.get('/api/schraenke/:id/inhalt', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Ungültige Schrank-ID' });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM bauteile WHERE schrank_id = ? ORDER BY name, barcode',
      [id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen des Schrankinhalts:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Laden des Schrankinhalts' });
  }
});

// === BAUTEIL-ENDPUNKTE ===

// Bauteil nach Barcode abrufen
app.get('/api/bauteil/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode ist erforderlich' });
    }
    
    const [rows] = await pool.execute(`
      SELECT b.*, 
             s.name as schrank_name, 
             s.id as schrank_id,
             b.name as equipment_name,
             b.standard as identification_number
      FROM bauteile b 
      LEFT JOIN schraenke s ON b.schrank_id = s.id 
      WHERE b.barcode = ?
    `, [barcode]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Bauteil nicht gefunden' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Bauteils:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Laden des Bauteils' });
  }
});

// Alle Bauteile abrufen
app.get('/api/bauteile', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT b.*, 
             s.name as schrank_name,
             b.name as equipment_name,
             b.standard as identification_number
      FROM bauteile b 
      LEFT JOIN schraenke s ON b.schrank_id = s.id 
      ORDER BY b.name, b.barcode
    `);
    
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Bauteile:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Laden der Bauteile' });
  }
});

// Bauteile suchen
app.get('/api/bauteile/suche', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Suchbegriff ist erforderlich' });
    }
    
    if (q.trim().length < 2) {
      return res.status(400).json({ error: 'Suchbegriff muss mindestens 2 Zeichen lang sein' });
    }
    
    const searchTerm = `%${q.trim()}%`;
    
    const [rows] = await pool.execute(`
      SELECT b.*, 
             s.name as schrank_name,
             b.name as equipment_name,
             b.standard as identification_number
      FROM bauteile b 
      LEFT JOIN schraenke s ON b.schrank_id = s.id 
      WHERE b.barcode LIKE ? 
         OR b.name LIKE ? 
         OR b.beschreibung LIKE ? 
         OR b.project LIKE ? 
         OR b.responsible_engineer LIKE ?
         OR b.standard LIKE ?
      ORDER BY 
        CASE 
          WHEN b.barcode LIKE ? THEN 1
          WHEN b.name LIKE ? THEN 2
          ELSE 3
        END,
        b.name, b.barcode
      LIMIT 100
    `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);
    
    res.json(rows);
  } catch (error) {
    console.error('Fehler bei der Suche nach Bauteilen:', error);
    res.status(500).json({ error: 'Datenbankfehler bei der Suche' });
  }
});

// Neues Bauteil erstellen
app.post('/api/bauteile', async (req, res) => {
  try {
    const { 
      barcode, 
      name, 
      beschreibung, 
      project, 
      responsible_engineer,
      equipment_name,
      identification_number
    } = req.body;
    
    // Validierung
    if (!barcode || barcode.trim().length === 0) {
      return res.status(400).json({ error: 'Barcode ist erforderlich' });
    }
    
    if (!project || project.trim().length === 0) {
      return res.status(400).json({ error: 'Projekt ist erforderlich' });
    }
    
    if (!responsible_engineer || responsible_engineer.trim().length === 0) {
      return res.status(400).json({ error: 'Verantwortlicher ist erforderlich' });
    }
    
    if (!equipment_name || equipment_name.trim().length === 0) {
      return res.status(400).json({ error: 'Gerätebezeichnung ist erforderlich' });
    }
    
    // Prüfen, ob Bauteil bereits existiert
    const [existing] = await pool.execute('SELECT barcode FROM bauteile WHERE barcode = ?', [barcode.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ein Bauteil mit diesem Barcode existiert bereits' });
    }
    
    // Bauteil erstellen
    const [result] = await pool.execute(
      `INSERT INTO bauteile (barcode, name, beschreibung, project, responsible_engineer, standard) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        barcode.trim(), 
        equipment_name?.trim() || null, 
        beschreibung?.trim() || null, 
        project.trim(), 
        responsible_engineer.trim(), 
        identification_number?.trim() || null
      ]
    );
    
    // Erstelltes Bauteil zurückgeben
    const [newComponent] = await pool.execute(
      'SELECT *, name as equipment_name, standard as identification_number FROM bauteile WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newComponent[0]);
  } catch (error) {
    console.error('Fehler beim Erstellen des Bauteils:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Erstellen des Bauteils' });
  }
});

// Bauteil aktualisieren
app.put('/api/bauteil/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const { 
      name, 
      beschreibung, 
      project, 
      responsible_engineer,
      equipment_name,
      identification_number
    } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode ist erforderlich' });
    }
    
    // Validierung
    if (!project || project.trim().length === 0) {
      return res.status(400).json({ error: 'Projekt ist erforderlich' });
    }
    
    if (!responsible_engineer || responsible_engineer.trim().length === 0) {
      return res.status(400).json({ error: 'Verantwortlicher ist erforderlich' });
    }
    
    if (!equipment_name || equipment_name.trim().length === 0) {
      return res.status(400).json({ error: 'Gerätebezeichnung ist erforderlich' });
    }
    
    // Bauteil aktualisieren
    const [result] = await pool.execute(
      `UPDATE bauteile 
       SET name = ?, 
           beschreibung = ?, 
           project = ?, 
           responsible_engineer = ?,
           standard = ?
       WHERE barcode = ?`,
      [
        equipment_name?.trim() || null, 
        beschreibung?.trim() || null, 
        project.trim(), 
        responsible_engineer.trim(), 
        identification_number?.trim() || null, 
        barcode
      ]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bauteil nicht gefunden' });
    }
    
    // Aktualisiertes Bauteil zurückgeben
    const [updatedComponent] = await pool.execute(
      'SELECT *, name as equipment_name, standard as identification_number FROM bauteile WHERE barcode = ?',
      [barcode]
    );
    
    res.json(updatedComponent[0]);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Bauteils:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Aktualisieren des Bauteils' });
  }
});

// Bauteil löschen
app.delete('/api/bauteil/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode ist erforderlich' });
    }
    
    // Bauteil löschen
    const [result] = await pool.execute('DELETE FROM bauteile WHERE barcode = ?', [barcode]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bauteil nicht gefunden' });
    }
    
    res.json({ 
      message: 'Bauteil erfolgreich gelöscht',
      deletedBarcode: barcode
    });
  } catch (error) {
    console.error('Fehler beim Löschen des Bauteils:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Löschen des Bauteils' });
  }
});

// Bauteil in Schrank einlagern
app.post('/api/bauteil/:barcode/einlagern/:schrankId', async (req, res) => {
  try {
    const { barcode, schrankId } = req.params;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode ist erforderlich' });
    }
    
    if (!schrankId || isNaN(schrankId)) {
      return res.status(400).json({ error: 'Ungültige Schrank-ID' });
    }
    
    // Prüfen, ob Bauteil existiert
    const [component] = await pool.execute('SELECT * FROM bauteile WHERE barcode = ?', [barcode]);
    if (component.length === 0) {
      return res.status(404).json({ error: 'Bauteil nicht gefunden' });
    }
    
    // Prüfen, ob Schrank existiert
    const [cabinet] = await pool.execute('SELECT * FROM schraenke WHERE id = ?', [schrankId]);
    if (cabinet.length === 0) {
      return res.status(404).json({ error: 'Schrank nicht gefunden' });
    }
    
    const previousSchrank = component[0].schrank_id;
    
    // Bauteil einlagern
    await pool.execute(
      'UPDATE bauteile SET schrank_id = ? WHERE barcode = ?',
      [schrankId, barcode]
    );
    
    // Automatischen Activity Record für STOR erstellen
    try {
      await pool.execute(`
        INSERT INTO activity_records (
          bauteil_barcode, activity_stor, date, created_at
        ) VALUES (?, TRUE, CURDATE(), NOW())
      `, [barcode]);
      console.log(`✅ STOR Activity Record erstellt für Bauteil ${barcode}`);
    } catch (activityError) {
      console.warn(`⚠️ Fehler beim Erstellen des STOR Activity Records für ${barcode}:`, activityError);
    }
    
    res.json({ 
      message: 'Bauteil erfolgreich eingelagert',
      previousSchrank: previousSchrank,
      newSchrank: parseInt(schrankId)
    });
  } catch (error) {
    console.error('Fehler beim Einlagern des Bauteils:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Einlagern des Bauteils' });
  }
});

// Bauteil aus Schrank auslagern
app.post('/api/bauteil/:barcode/auslagern', async (req, res) => {
  try {
    const { barcode } = req.params;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode ist erforderlich' });
    }
    
    // Prüfen, ob Bauteil existiert
    const [component] = await pool.execute('SELECT * FROM bauteile WHERE barcode = ?', [barcode]);
    if (component.length === 0) {
      return res.status(404).json({ error: 'Bauteil nicht gefunden' });
    }
    
    const previousSchrank = component[0].schrank_id;
    
    // Bauteil auslagern
    await pool.execute(
      'UPDATE bauteile SET schrank_id = NULL WHERE barcode = ?',
      [barcode]
    );
    
    // Automatischen Activity Record für DE-STOR erstellen
    try {
      await pool.execute(`
        INSERT INTO activity_records (
          bauteil_barcode, activity_de_stor, date, created_at
        ) VALUES (?, TRUE, CURDATE(), NOW())
      `, [barcode]);
      console.log(`✅ DE-STOR Activity Record erstellt für Bauteil ${barcode}`);
    } catch (activityError) {
      console.warn(`⚠️ Fehler beim Erstellen des DE-STOR Activity Records für ${barcode}:`, activityError);
    }
    
    res.json({ 
      message: 'Bauteil erfolgreich ausgelagert',
      previousSchrank: previousSchrank
    });
  } catch (error) {
    console.error('Fehler beim Auslagern des Bauteils:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Auslagern des Bauteils' });
  }
});

// Bild für Bauteil hochladen
app.post('/api/bauteil/:barcode/bild', upload.single('image'), async (req, res) => {
  const { barcode } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'Kein Bild hochgeladen' });
  }

  try {
    // Bild als Base64 konvertieren
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
    
    // Base64-Bild in der Datenbank speichern
    const [result] = await pool.execute(
      'UPDATE bauteile SET image_url = ? WHERE barcode = ?',
      [base64Image, barcode]
    );

    if (result.affectedRows === 0) {
      // Lösche die hochgeladene Datei
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Bauteil nicht gefunden' });
    }

    // Lösche die temporäre Datei nach dem Speichern in der DB
    fs.unlinkSync(req.file.path);

    // Aktualisiertes Bauteil zurückgeben
    const [updatedComponent] = await pool.execute(
      'SELECT * FROM bauteile WHERE barcode = ?',
      [barcode]
    );

    res.json({ 
      message: 'Bild erfolgreich hochgeladen',
      image_url: base64Image,
      bauteil: updatedComponent[0]
    });
  } catch (error) {
    console.error('Fehler beim Hochladen des Bildes:', error);
    // Lösche die hochgeladene Datei bei Fehler
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Fehler beim Löschen der temporären Datei:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Interner Serverfehler beim Hochladen des Bildes' });
  }
});

// === ACTIVITY RECORDS ENDPUNKTE ===

// Alle Activity Records für ein Bauteil abrufen
app.get('/api/bauteil/:barcode/activities', async (req, res) => {
  try {
    const { barcode } = req.params;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode ist erforderlich' });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM activity_records WHERE bauteil_barcode = ? ORDER BY date DESC, created_at DESC',
      [barcode]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Activity Records:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Laden der Activity Records' });
  }
});

// Neuen Activity Record erstellen
app.post('/api/bauteil/:barcode/activities', async (req, res) => {
  try {
    const { barcode } = req.params;
    const {
      entry_made_by,
      organisation,
      location,
      further_operators,
      activity_assy,
      activity_disassy,
      activity_test,
      activity_shpf,
      activity_insp,
      activity_cln,
      activity_smpl,
      activity_cal,
      activity_hndl,
      activity_stor,
      activity_de_stor,
      procedure_number,
      date,
      start_time,
      end_time,
      humidity_start,
      humidity_end,
      temperature_start,
      temperature_end,
      remarks,
      activity_description,
      reports
    } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode ist erforderlich' });
    }
    
    // Prüfen, ob Bauteil existiert
    const [component] = await pool.execute('SELECT barcode FROM bauteile WHERE barcode = ?', [barcode]);
    if (component.length === 0) {
      return res.status(404).json({ error: 'Bauteil nicht gefunden' });
    }
    
    // Activity Record erstellen
    const [result] = await pool.execute(`
      INSERT INTO activity_records (
        bauteil_barcode, entry_made_by, organisation, location, further_operators,
        activity_assy, activity_disassy, activity_test, activity_shpf, activity_insp,
        activity_cln, activity_smpl, activity_cal, activity_hndl, activity_stor, activity_de_stor,
        procedure_number, date, start_time, end_time,
        humidity_start, humidity_end, temperature_start, temperature_end,
        remarks, activity_description, reports
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      barcode, entry_made_by, organisation, location, further_operators,
      activity_assy || false, activity_disassy || false, activity_test || false, 
      activity_shpf || false, activity_insp || false, activity_cln || false, 
      activity_smpl || false, activity_cal || false, activity_hndl || false, 
      activity_stor || false, activity_de_stor || false,
      procedure_number, 
      date || null, 
      start_time || null, 
      end_time || null,
      humidity_start || null, 
      humidity_end || null, 
      temperature_start || null, 
      temperature_end || null,
      remarks, activity_description, reports
    ]);
    
    // Erstellten Activity Record zurückgeben
    const [newRecord] = await pool.execute(
      'SELECT * FROM activity_records WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newRecord[0]);
  } catch (error) {
    console.error('Fehler beim Erstellen des Activity Records:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Erstellen des Activity Records' });
  }
});

// Activity Record aktualisieren
app.put('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      entry_made_by,
      organisation,
      location,
      further_operators,
      activity_assy,
      activity_disassy,
      activity_test,
      activity_shpf,
      activity_insp,
      activity_cln,
      activity_smpl,
      activity_cal,
      activity_hndl,
      activity_stor,
      activity_de_stor,
      procedure_number,
      date,
      start_time,
      end_time,
      humidity_start,
      humidity_end,
      temperature_start,
      temperature_end,
      remarks,
      activity_description,
      reports
    } = req.body;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Ungültige Activity Record ID' });
    }
    
    // Activity Record aktualisieren
    const [result] = await pool.execute(`
      UPDATE activity_records SET
        entry_made_by = ?, organisation = ?, location = ?, further_operators = ?,
        activity_assy = ?, activity_disassy = ?, activity_test = ?, activity_shpf = ?, 
        activity_insp = ?, activity_cln = ?, activity_smpl = ?, activity_cal = ?, 
        activity_hndl = ?, activity_stor = ?, activity_de_stor = ?,
        procedure_number = ?, date = ?, start_time = ?, end_time = ?,
        humidity_start = ?, humidity_end = ?, temperature_start = ?, temperature_end = ?,
        remarks = ?, activity_description = ?, reports = ?
      WHERE id = ?
    `, [
      entry_made_by, organisation, location, further_operators,
      activity_assy || false, activity_disassy || false, activity_test || false, 
      activity_shpf || false, activity_insp || false, activity_cln || false, 
      activity_smpl || false, activity_cal || false, activity_hndl || false, 
      activity_stor || false, activity_de_stor || false,
      procedure_number, 
      date || null, 
      start_time || null, 
      end_time || null,
      humidity_start || null, 
      humidity_end || null, 
      temperature_start || null, 
      temperature_end || null,
      remarks, activity_description, reports, id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Activity Record nicht gefunden' });
    }
    
    // Aktualisierten Activity Record zurückgeben
    const [updated] = await pool.execute('SELECT * FROM activity_records WHERE id = ?', [id]);
    
    res.json(updated[0]);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Activity Records:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Aktualisieren des Activity Records' });
  }
});

// Activity Record löschen
app.delete('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Ungültige Activity Record ID' });
    }
    
    // Activity Record löschen
    const [result] = await pool.execute('DELETE FROM activity_records WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Activity Record nicht gefunden' });
    }
    
    res.json({ 
      message: 'Activity Record erfolgreich gelöscht',
      deletedId: parseInt(id)
    });
  } catch (error) {
    console.error('Fehler beim Löschen des Activity Records:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Löschen des Activity Records' });
  }
});

// === STATISTIK-ENDPUNKTE ===

// Dashboard-Statistiken
app.get('/api/statistiken', async (req, res) => {
  try {
    // Gesamtanzahl Schränke
    const [totalCabinetsResult] = await pool.execute('SELECT COUNT(*) as count FROM schraenke');
    const totalCabinets = parseInt(totalCabinetsResult[0].count);
    
    // Gesamtanzahl Bauteile
    const [totalComponentsResult] = await pool.execute('SELECT COUNT(*) as count FROM bauteile');
    const totalComponents = parseInt(totalComponentsResult[0].count);
    
    // Eingelagerte Bauteile
    const [storedComponentsResult] = await pool.execute('SELECT COUNT(*) as count FROM bauteile WHERE schrank_id IS NOT NULL');
    const storedComponents = parseInt(storedComponentsResult[0].count);
    
    // Nicht eingelagerte Bauteile
    const unstoredComponents = totalComponents - storedComponents;
    
    // Leere Schränke
    const [emptyCabinetsResult] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM schraenke s 
      WHERE NOT EXISTS (
        SELECT 1 FROM bauteile b WHERE b.schrank_id = s.id
      )
    `);
    const emptyCabinets = parseInt(emptyCabinetsResult[0].count);
    
    // Top 5 Projekte
    const [topProjectsResult] = await pool.execute(`
      SELECT project as project_name, COUNT(*) as count 
      FROM bauteile 
      WHERE project IS NOT NULL 
      GROUP BY project 
      ORDER BY count DESC 
      LIMIT 5
    `);
    
    // Auslastung der Schränke
    const [cabinetUtilizationResult] = await pool.execute(`
      SELECT s.name, COUNT(b.barcode) as component_count 
      FROM schraenke s 
      LEFT JOIN bauteile b ON s.id = b.schrank_id 
      GROUP BY s.id, s.name 
      ORDER BY component_count DESC
    `);
    
    res.json({
      totalCabinets,
      totalComponents,
      storedComponents,
      unstoredComponents,
      emptyCabinets,
      topProjects: topProjectsResult,
      cabinetUtilization: cabinetUtilizationResult
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Statistiken:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Laden der Statistiken' });
  }
});

// Debug-Endpoint zum Prüfen der Tabellenstruktur
app.get('/api/debug/table-structure', async (req, res) => {
  try {
    const [result] = await pool.execute(`
      SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type, 
             IS_NULLABLE as is_nullable, COLUMN_DEFAULT as column_default
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bauteile'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_DATABASE || 'test']);
    
    res.json({
      columns: result,
      message: 'MySQL-Tabellenstruktur für bauteile'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Migration-Endpunkt zum Hinzufügen der image_url Spalte für Schränke
app.get('/api/migrate/add-cabinet-image', async (req, res) => {
  try {
    // Spalte für Schrank-Bilder hinzufügen
    await pool.execute(`
      ALTER TABLE schraenke 
      ADD COLUMN IF NOT EXISTS image_url LONGTEXT
    `).catch(() => {
      // Ignoriere Fehler wenn Spalte bereits existiert
      console.log('Spalte image_url existiert bereits oder Fehler beim Hinzufügen');
    });
    
    res.json({ 
      message: 'Datenbank-Migration erfolgreich: image_url Spalte hinzugefügt',
      status: 'success'
    });
    
  } catch (error) {
    console.error('Fehler bei der Datenbank-Migration:', error);
    res.status(500).json({ error: 'Fehler bei der Datenbank-Migration' });
  }
});

// Fehlerbehandlung für Datei-Uploads
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Datei ist zu groß (Maximum: 5MB)' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unerwartetes Dateifeld' });
    }
  }
  
  if (error.message && error.message.includes('Nur Bilddateien')) {
    return res.status(400).json({ error: error.message });
  }
  
  console.error('Unerwarteter Fehler:', error);
  res.status(500).json({ error: 'Interner Serverfehler' });
});

// Fallback für alle anderen Routen - Client-Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Server wird heruntergefahren...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Server wird heruntergefahren...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

// Server starten
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // MySQL-Pool initialisieren
    createMySQLPool();
    
    // Datenbank initialisieren
    await initializeDatabase();
    
    // Server starten
    app.listen(PORT, () => {
      console.log('🐾 =======================================');
      console.log('🚀 WeaselParts Server erfolgreich gestartet!');
      console.log(`📡 Server läuft auf Port ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🗄️  MySQL-Datenbank: ${process.env.DB_HOST || 'mysql-backup'}:${process.env.DB_PORT || 3306}`);
      console.log(`📊 Datenbank: ${process.env.DB_DATABASE || 'weaselparts_local'}`);
      console.log('🐾 =======================================');
      console.log('📝 API-Endpunkte:');
      console.log('   GET  /api/test                        - API-Test');
      console.log('   GET  /api/schraenke                   - Alle Schränke');
      console.log('   POST /api/schraenke                   - Neuer Schrank');
      console.log('   PUT  /api/schraenke/:id               - Schrank aktualisieren');
      console.log('   POST /api/schraenke/:id/bild          - Schrank-Bild hochladen');
      console.log('   GET  /api/bauteile                    - Alle Bauteile');
      console.log('   POST /api/bauteile                    - Neues Bauteil');
      console.log('   GET  /api/bauteil/:barcode            - Bauteil-Details');
      console.log('   POST /api/bauteil/:barcode/bild       - Bild hochladen');
      console.log('🐾 =======================================');
    });
  } catch (error) {
    console.error('❌ Fehler beim Starten des Servers:', error);
    process.exit(1);
  }
}

startServer();
