// WeaselParts Server - MySQL Version
// Moderne Bauteile-Verwaltung mit Barcode-Scanner

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const pdfParse = require('pdf-parse');
const { PDFDocument: PDFLib, rgb } = require('pdf-lib');

// PostgreSQL für Temperatur/Feuchtigkeit
const { Pool } = require('pg');
require('dotenv').config();

// Express-Anwendung initialisieren
const app = express();

// Entwicklungsmodus erkennen
const isDevelopment = process.env.NODE_ENV !== 'production';

// Mock-Daten für lokale Entwicklung
const mockSensorData = {
  temperature: { 
    timedate: new Date().toISOString(), 
    temperature: 21.7 + (Math.random() * 2 - 1) // 20.7 - 22.7°C
  },
  humidity: { 
    timedate: new Date().toISOString(), 
    humidity: 65.2 + (Math.random() * 10 - 5) // 60.2 - 70.2%
  }
};

// PostgreSQL-Konfiguration (nur in Produktion)
let pgPool = null;

// PostgreSQL initialisieren
async function initializePostgreSQL() {
  if (!isDevelopment && process.env.POSTGRES_HOST) {
    const pgConfig = {
      host: process.env.POSTGRES_HOST || '129.247.232.65',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_NAME || 'fms01',
      user: process.env.POSTGRES_USER || 'monitor',
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.POSTGRES_SSL === 'true' ? true : false,
      connectionTimeoutMillis: 5000,
      query_timeout: 5000
    };
    
    try {
      pgPool = new Pool(pgConfig);
      console.log('🌡️ PostgreSQL-Pool für Sensordaten erstellt');
      console.log('📊 PostgreSQL-Konfiguration:', {
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        user: pgConfig.user,
        hasPassword: !!pgConfig.password
      });
      
      // Verbindung testen
      const testResult = await pgPool.query('SELECT NOW()');
      console.log('✅ PostgreSQL-Verbindung erfolgreich:', testResult.rows[0].now);
      
      // Tabellen prüfen - erweiterte Suche
      const tablesCheck = await pgPool.query(`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name LIKE '%temp%' 
           OR table_name LIKE '%rh%' 
           OR table_name LIKE '%ssa%'
        ORDER BY table_schema, table_name
      `);
      console.log('📋 Gefundene Tabellen:', tablesCheck.rows.map(r => `${r.table_schema}.${r.table_name}`));
      
      // Zusätzlich: Alle Tabellen in der Datenbank anzeigen
      const allTablesCheck = await pgPool.query(`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name
        LIMIT 20
      `);
      console.log('📊 Alle verfügbaren Tabellen (erste 20):', allTablesCheck.rows.map(r => `${r.table_schema}.${r.table_name}`));
      
    } catch (error) {
      console.log('⚠️ PostgreSQL nicht verfügbar - verwende Mock-Daten');
      console.error('❌ PostgreSQL-Fehler:', error.message);
      pgPool = null;
    }
  } else {
    console.log('🔧 Entwicklungsmodus - Mock-Sensordaten werden verwendet');
  }
}

// PostgreSQL beim Start initialisieren
initializePostgreSQL();

// Helper-Funktion für Standort-Namen
function getLocationName(location) {
  const locationNames = {
    'ssa': 'Jarvis-Ecke',
    'int_up': 'Am Telefon',
    'int_low': 'Empore'
  };
  return locationNames[location] || `Standort ${location}`;
}

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
const icdUploadsDir = path.join(__dirname, 'public/uploads/icd');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(icdUploadsDir)) {
  fs.mkdirSync(icdUploadsDir, { recursive: true });
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

// PDF-Upload für ICD konfigurieren
const icdPdfStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, icdUploadsDir);
  },
  filename: function(req, file, cb) {
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `icd_${timestamp}${extension}`);
  }
});

const uploadPdf = multer({
  storage: icdPdfStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit für PDFs
  },
  fileFilter: function(req, file, cb) {
    // Nur PDFs erlauben
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF-Dateien sind erlaubt!'), false);
    }
  }
});

// =============================================================================
// EMPLOYEES & PROJECTS API SETUP
// =============================================================================

async function setupEmployeesProjectsAPI() {
  console.log('📋 Initialisiere Employees & Projects API...');
  
  try {
    // Check if table exists and get its structure
    const [tableInfo] = await pool.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees'
    `);
    
    const existingColumns = tableInfo.map(row => row.COLUMN_NAME);
    const hasOldStructure = existingColumns.includes('name') && !existingColumns.includes('nachname');
    
    if (hasOldStructure) {
      console.log('📋 Migriere Employees-Tabelle zu neuer Struktur...');
      
      // Add new columns
      await pool.execute(`ALTER TABLE employees ADD COLUMN nachname VARCHAR(50)`);
      await pool.execute(`ALTER TABLE employees ADD COLUMN vorname VARCHAR(50)`);
      
      // Migrate existing data
      const [existingEmployees] = await pool.execute(`SELECT id, name FROM employees WHERE name IS NOT NULL`);
      
      for (const employee of existingEmployees) {
        const nameParts = employee.name.split(',').map(part => part.trim());
        if (nameParts.length === 2) {
          await pool.execute(`
            UPDATE employees SET nachname = ?, vorname = ? WHERE id = ?
          `, [nameParts[0], nameParts[1], employee.id]);
        } else {
          // Fallback: ganzer Name als Nachname
          await pool.execute(`
            UPDATE employees SET nachname = ?, vorname = 'N/A' WHERE id = ?
          `, [employee.name, employee.id]);
        }
      }
      
      console.log('✅ Migration der Employees-Tabelle abgeschlossen');
    } else {
      // Create table with new structure if it doesn't exist
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS employees (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nachname VARCHAR(50) NOT NULL,
          vorname VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_name (nachname, vorname)
        )
      `);
    }
    
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Employees & Projects Tabellen initialisiert');
  } catch (error) {
    console.error('❌ Fehler beim Initialisieren der Employees & Projects Tabellen:', error);
  }
}

// Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    console.log('📋 Lade alle Mitarbeiter...');
    
    const [rows] = await pool.execute(
      'SELECT id, nachname, vorname, created_at FROM employees WHERE nachname IS NOT NULL AND vorname IS NOT NULL ORDER BY nachname ASC, vorname ASC'
    );
    
    // Format names as "Nachname, Vorname" for frontend
    const formattedRows = rows.map(row => ({
      ...row,
      displayName: `${row.nachname || ''}, ${row.vorname || ''}`.replace(/^,\s*|,\s*$/g, '') || 'Unbekannt'
    }));
    
    console.log(`✅ ${rows.length} Mitarbeiter geladen`);
    res.json(formattedRows);
  } catch (error) {
    console.error('❌ Fehler beim Laden der Mitarbeiter:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Mitarbeiter' });
  }
});

// Add new employee
app.post('/api/employees', async (req, res) => {
  try {
    const { nachname, vorname } = req.body;
    
    if (!nachname || !nachname.trim() || !vorname || !vorname.trim()) {
      return res.status(400).json({ error: 'Nachname und Vorname sind erforderlich' });
    }
    
    const trimmedNachname = nachname.trim();
    const trimmedVorname = vorname.trim();
    
    // Check if employee already exists
    const [existingEmployee] = await pool.execute(
      'SELECT id FROM employees WHERE LOWER(nachname) = LOWER(?) AND LOWER(vorname) = LOWER(?)',
      [trimmedNachname, trimmedVorname]
    );
    
    if (existingEmployee.length > 0) {
      return res.status(400).json({ error: 'Mitarbeiter existiert bereits' });
    }
    
    console.log(`📋 Füge neuen Mitarbeiter hinzu: ${trimmedNachname}, ${trimmedVorname}`);
    
    const [result] = await pool.execute(
      'INSERT INTO employees (nachname, vorname) VALUES (?, ?)',
      [trimmedNachname, trimmedVorname]
    );
    
    const [newEmployee] = await pool.execute(
      'SELECT id, nachname, vorname, created_at FROM employees WHERE id = ?',
      [result.insertId]
    );
    
    const employeeWithDisplayName = {
      ...newEmployee[0],
      displayName: `${newEmployee[0].nachname}, ${newEmployee[0].vorname}`
    };
    
    console.log(`✅ Mitarbeiter "${trimmedNachname}, ${trimmedVorname}" erfolgreich hinzugefügt`);
    res.status(201).json(employeeWithDisplayName);
  } catch (error) {
    console.error('❌ Fehler beim Hinzufügen des Mitarbeiters:', error);
    res.status(500).json({ error: 'Fehler beim Speichern des Mitarbeiters' });
  }
});

// Delete employee
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📋 Lösche Mitarbeiter mit ID: ${id}`);
    
    const [employee] = await pool.execute(
      'SELECT nachname, vorname FROM employees WHERE id = ?',
      [id]
    );
    
    if (employee.length === 0) {
      return res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
    }
    
    await pool.execute('DELETE FROM employees WHERE id = ?', [id]);
    
    console.log(`✅ Mitarbeiter "${employee[0].nachname}, ${employee[0].vorname}" erfolgreich gelöscht`);
    res.json({ message: 'Mitarbeiter erfolgreich gelöscht' });
  } catch (error) {
    console.error('❌ Fehler beim Löschen des Mitarbeiters:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Mitarbeiters' });
  }
});

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    console.log('📋 Lade alle Projekte...');
    
    const [rows] = await pool.execute(
      'SELECT id, name, created_at FROM projects ORDER BY name ASC'
    );
    
    console.log(`✅ ${rows.length} Projekte geladen`);
    res.json(rows);
  } catch (error) {
    console.error('❌ Fehler beim Laden der Projekte:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Projekte' });
  }
});

// Add new project
app.post('/api/projects', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Projektname ist erforderlich' });
    }
    
    const trimmedName = name.trim();
    
    // Check if project already exists
    const [existingProject] = await pool.execute(
      'SELECT id FROM projects WHERE LOWER(name) = LOWER(?)',
      [trimmedName]
    );
    
    if (existingProject.length > 0) {
      return res.status(400).json({ error: 'Projekt existiert bereits' });
    }
    
    console.log(`📋 Füge neues Projekt hinzu: ${trimmedName}`);
    
    const [result] = await pool.execute(
      'INSERT INTO projects (name) VALUES (?)',
      [trimmedName]
    );
    
    const [newProject] = await pool.execute(
      'SELECT id, name, created_at FROM projects WHERE id = ?',
      [result.insertId]
    );
    
    console.log(`✅ Projekt "${trimmedName}" erfolgreich hinzugefügt`);
    res.status(201).json(newProject[0]);
  } catch (error) {
    console.error('❌ Fehler beim Hinzufügen des Projekts:', error);
    res.status(500).json({ error: 'Fehler beim Speichern des Projekts' });
  }
});

// Delete project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📋 Lösche Projekt mit ID: ${id}`);
    
    const [project] = await pool.execute(
      'SELECT name FROM projects WHERE id = ?',
      [id]
    );
    
    if (project.length === 0) {
      return res.status(404).json({ error: 'Projekt nicht gefunden' });
    }
    
    await pool.execute('DELETE FROM projects WHERE id = ?', [id]);
    
    console.log(`✅ Projekt "${project[0].name}" erfolgreich gelöscht`);
    res.json({ message: 'Projekt erfolgreich gelöscht' });
  } catch (error) {
    console.error('❌ Fehler beim Löschen des Projekts:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Projekts' });
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
    
    // ICD-Einträge Tabelle erstellen
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS icd_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        question_1 TEXT,
        question_2 TEXT,
        question_3 TEXT,
        question_4 TEXT,
        pdf_filename VARCHAR(255),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_icd_customer_name (customer_name),
        INDEX idx_icd_upload_date (upload_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabelle "icd_entries" erstellt/geprüft');
    
    // Spalte question_4 hinzufügen falls sie noch nicht existiert
    try {
      await pool.execute(`
        ALTER TABLE icd_entries 
        ADD COLUMN question_4 TEXT
      `);
      console.log('✅ Spalte "question_4" hinzugefügt');
    } catch (alterError) {
      if (alterError.message.includes('Duplicate column')) {
        console.log('Spalte question_4 existiert bereits');
      } else {
        console.log('Info: question_4 Spalten-Update:', alterError.message);
      }
    }
    
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
// Alias für /api/bauteile - für Kompatibilität mit Frontend
app.get('/api/parts', async (req, res) => {
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
    console.error('Fehler beim Abrufen der Bauteile (parts):', error);
    res.status(500).json({ error: 'Datenbankfehler beim Abrufen der Bauteile' });
  }
});

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
// === ICD API ENDPUNKTE ===

// Alle ICD-Einträge abrufen
app.get('/api/icd', async (req, res) => {
  try {
    console.log('📋 API /api/icd aufgerufen - Lade ICD-Einträge...');
    
    if (!pool) {
      console.error('❌ Kein Datenbankpool verfügbar');
      return res.status(500).json({ error: 'Datenbankverbindung nicht verfügbar' });
    }
    
    const [rows] = await pool.execute(`
      SELECT * FROM icd_entries 
      ORDER BY upload_date DESC
    `);
    
    console.log(`✅ ${rows.length} ICD-Einträge gefunden`);
    res.json(rows);
    
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der ICD-Einträge:', error);
    
    // Prüfen ob Tabelle existiert
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('⚠️ ICD-Tabelle existiert nicht, erstelle sie...');
      try {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS icd_entries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_name VARCHAR(255) NOT NULL,
            question_1 TEXT,
            question_2 TEXT,
            question_3 TEXT,
            pdf_filename VARCHAR(255),
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_icd_customer_name (customer_name),
            INDEX idx_icd_upload_date (upload_date)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ ICD-Tabelle erstellt');
        
        // Nochmal versuchen
        const [rows] = await pool.execute(`
          SELECT * FROM icd_entries 
          ORDER BY upload_date DESC
        `);
        return res.json(rows);
        
      } catch (createError) {
        console.error('❌ Fehler beim Erstellen der ICD-Tabelle:', createError);
        return res.status(500).json({ error: 'Fehler beim Erstellen der Datenbanktabelle' });
      }
    }
    
    res.status(500).json({ error: `Fehler beim Abrufen der ICD-Einträge: ${error.message}` });
  }
});

// Neuen ICD-Eintrag erstellen
app.post('/api/icd', async (req, res) => {
  try {
    const { customer_name, question_1, question_2, question_3 } = req.body;
    
    if (!customer_name) {
      return res.status(400).json({ error: 'Kundenname ist erforderlich' });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO icd_entries (customer_name, question_1, question_2, question_3)
      VALUES (?, ?, ?, ?)
    `, [customer_name, question_1, question_2, question_3]);
    
    res.json({ 
      id: result.insertId,
      message: 'ICD-Eintrag erfolgreich erstellt'
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des ICD-Eintrags:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des ICD-Eintrags' });
  }
});

// ICD-Eintrag aktualisieren
app.put('/api/icd/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, question_1, question_2, question_3 } = req.body;
    
    await pool.execute(`
      UPDATE icd_entries 
      SET customer_name = ?, question_1 = ?, question_2 = ?, question_3 = ?
      WHERE id = ?
    `, [customer_name, question_1, question_2, question_3, id]);
    
    res.json({ message: 'ICD-Eintrag erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des ICD-Eintrags:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des ICD-Eintrags' });
  }
});

// ICD-Eintrag löschen
app.delete('/api/icd/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('DELETE FROM icd_entries WHERE id = ?', [id]);
    
    res.json({ message: 'ICD-Eintrag erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des ICD-Eintrags:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des ICD-Eintrags' });
  }
});

// PDF-Download für ICD-Fragebogen (mit echten Formularfeldern)
app.get('/api/icd/download-pdf', async (req, res) => {
  try {
    console.log('📄 Erstelle PDF mit Formularfeldern...');
    
    // Erstelle PDF mit pdf-lib für echte Formularfelder
    const pdfDoc = await PDFLib.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const form = pdfDoc.getForm();
    
    const { width, height } = page.getSize();
    
    // Standard-Fonts
    const helveticaFont = await pdfDoc.embedFont('Helvetica');
    const helveticaBoldFont = await pdfDoc.embedFont('Helvetica-Bold');
    
    // === HEADER SECTION ===
    // Titel mit schönerer Gestaltung
    page.drawText('WeaselParts', {
      x: 50,
      y: height - 60,
      size: 18,
      font: helveticaBoldFont,
      color: rgb(0.2, 0.4, 0.8), // Blau
    });
    
    page.drawText('Interface Control Document (ICD)', {
      x: 50,
      y: height - 85,
      size: 14,
      font: helveticaBoldFont,
    });
    
    // Trennlinie
    page.drawLine({
      start: { x: 50, y: height - 100 },
      end: { x: width - 50, y: height - 100 },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    
    // === KUNDENINFO SECTION ===
    let currentY = height - 140;
    
    page.drawText('Kundeninformation', {
      x: 50,
      y: currentY,
      size: 12,
      font: helveticaBoldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    currentY -= 25;
    page.drawText('Kundenname:', {
      x: 70,
      y: currentY,
      size: 12,
      font: helveticaFont,
    });
    
    const customerNameField = form.createTextField('customer_name');
    customerNameField.setText(''); 
    customerNameField.addToPage(page, {
      x: 150,
      y: currentY - 5,
      width: 300,
      height: 16,
      borderColor: rgb(0.5, 0.5, 0.5),
      borderWidth: 0.5,
      backgroundColor: rgb(0.98, 0.98, 0.98),
    });
    
    // === FRAGEN SECTION ===
    currentY -= 50;
    
    page.drawText('Fragebogen', {
      x: 50,
      y: currentY,
      size: 12,
      font: helveticaBoldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    // Frage 1
    currentY -= 30;
    page.drawText('1. Subsystem-Name:', {
      x: 70,
      y: currentY,
      size: 12,
      font: helveticaBoldFont,
    });
    
    currentY -= 20;
    const answer1Field = form.createTextField('question_1');
    answer1Field.setText('');
    answer1Field.enableMultiline();
    // Font size will be controlled by PDF viewer
    answer1Field.addToPage(page, {
      x: 70,
      y: currentY - 40,
      width: 450,
      height: 35,
      borderColor: rgb(0.5, 0.5, 0.5),
      borderWidth: 0.5,
      backgroundColor: rgb(0.98, 0.98, 0.98),
    });
    
    // Frage 2
    currentY -= 80;
    page.drawText('2. Mechanical Interface Information:', {
      x: 70,
      y: currentY,
      size: 12,
      font: helveticaBoldFont,
    });
    
    currentY -= 20;
    const answer2Field = form.createTextField('question_2');
    answer2Field.setText('');
    answer2Field.enableMultiline();
    // Font size will be controlled by PDF viewer
    answer2Field.addToPage(page, {
      x: 70,
      y: currentY - 40,
      width: 450,
      height: 35,
      borderColor: rgb(0.5, 0.5, 0.5),
      borderWidth: 0.5,
      backgroundColor: rgb(0.98, 0.98, 0.98),
    });
    
    // Frage 3
    currentY -= 80;
    page.drawText('3. Electrical Interface Information:', {
      x: 70,
      y: currentY,
      size: 12,
      font: helveticaBoldFont,
    });
    
    currentY -= 20;
    const answer3Field = form.createTextField('question_3');
    answer3Field.setText('');
    answer3Field.enableMultiline();
    // Font size will be controlled by PDF viewer
    answer3Field.addToPage(page, {
      x: 70,
      y: currentY - 40,
      width: 450,
      height: 35,
      borderColor: rgb(0.5, 0.5, 0.5),
      borderWidth: 0.5,
      backgroundColor: rgb(0.98, 0.98, 0.98),
    });
    
    // Frage 4 (neu hinzugefügt)
    currentY -= 80;
    page.drawText('4. Thermal Interface Information:', {
      x: 70,
      y: currentY,
      size: 12,
      font: helveticaBoldFont,
    });
    
    currentY -= 20;
    const answer4Field = form.createTextField('question_4');
    answer4Field.setText('');
    answer4Field.enableMultiline();
    // Font size will be controlled by PDF viewer
    answer4Field.addToPage(page, {
      x: 70,
      y: currentY - 40,
      width: 450,
      height: 35,
      borderColor: rgb(0.5, 0.5, 0.5),
      borderWidth: 0.5,
      backgroundColor: rgb(0.98, 0.98, 0.98),
    });

    // === FOOTER SECTION ===
    currentY -= 100;
    
    // Foxit-Hinweis
    page.drawText('WICHTIG: Verwenden Sie Foxit PDF Reader zum Ausfüllen dieses Formulars!', {
      x: 50,
      y: currentY,
      size: 12,
      font: helveticaBoldFont,
      color: rgb(0.8, 0.2, 0.2), // Rot
    });
    
    currentY -= 20;
    // Trennlinie
    page.drawLine({
      start: { x: 50, y: currentY },
      end: { x: width - 50, y: currentY },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    
    currentY -= 10;
    page.drawText('Anweisungen:', {
      x: 50,
      y: currentY,
      size: 12,
      font: helveticaBoldFont,
    });
    
    page.drawText('1. Verwenden Sie Foxit PDF Reader (nicht den Browser)', {
      x: 70,
      y: currentY - 15,
      size: 10,
      font: helveticaFont,
    });
    
    page.drawText('2. Füllen Sie alle 4 Interface-Information-Felder aus', {
      x: 70,
      y: currentY - 30,
      font: helveticaFont,
      size: 10,
    });
    
    page.drawText('3. Speichern Sie das PDF nach dem Ausfüllen', {
      x: 70,
      y: currentY - 45,
      size: 10,
      font: helveticaFont,
    });
    
    page.drawText('4. Laden Sie es über die WeaselParts ICD-Seite hoch', {
      x: 70,
      y: currentY - 60,
      size: 10,
      font: helveticaFont,
    });
    
    page.drawText('© WeaselParts - Interface Control Document', {
      x: 50,
      y: 40,
      size: 7,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    // PDF serialisieren
    const pdfBytes = await pdfDoc.save();
    
    // Response headers setzen
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="ICD_Fragebogen.pdf"');
    res.setHeader('Content-Length', pdfBytes.length);
    
    // PDF senden
    res.end(Buffer.from(pdfBytes));
    
    console.log('✅ PDF mit verbessertem Design erstellt');
    
  } catch (error) {
    console.error('❌ Fehler bei PDF-Generierung:', error);
    res.status(500).json({ error: 'Fehler bei der PDF-Generierung' });
  }
});

// PDF-Upload und Parser für ICD
app.post('/api/icd/upload-pdf', uploadPdf.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine PDF-Datei hochgeladen' });
    }
    
    console.log('📄 PDF-Upload gestartet:', req.file.filename);
    console.log('📁 Dateigröße:', req.file.size, 'Bytes');
    console.log('🖥️ User-Agent:', req.headers['user-agent'] || 'Unbekannt');
    console.log('🔧 MIME-Type:', req.file.mimetype);
    console.log('📂 Original Name:', req.file.originalname);
    console.log('🕐 Upload Zeit:', new Date().toISOString());
    
    const filePath = req.file.path;
    
    // Robustere Datei-Behandlung für Windows
    let dataBuffer;
    try {
      dataBuffer = fs.readFileSync(filePath);
      console.log('✅ PDF-Datei erfolgreich gelesen, Größe:', dataBuffer.length, 'Bytes');
      
      // Überprüfe PDF-Header
      const pdfHeader = dataBuffer.slice(0, 8).toString('ascii');
      console.log('📋 PDF-Header:', pdfHeader);
      
      if (!pdfHeader.startsWith('%PDF-')) {
        throw new Error('Ungültiges PDF-Format - kein PDF-Header gefunden');
      }
      
    } catch (fileError) {
      console.error('❌ Fehler beim Lesen der PDF-Datei:', fileError);
      return res.status(400).json({ 
        error: 'PDF-Datei konnte nicht gelesen werden. Möglicherweise ist die Datei beschädigt.',
        details: process.env.NODE_ENV === 'development' ? fileError.message : undefined
      });
    }
    
    let customerName = 'Unbekannt';
    let answer1 = '';
    let answer2 = '';
    let answer3 = '';
    let answer4 = '';
    
    // Strategie 1: Versuche PDF-Formularfelder zu lesen (Mac-Style)
    try {
      console.log('🔍 Versuche Formularfelder zu lesen...');
      const pdfDoc = await PDFLib.load(dataBuffer);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      console.log(`📋 ${fields.length} Formularfelder gefunden`);
      console.log(`📝 Alle Feldnamen: ${fields.map(f => f.getName()).join(', ')}`);
      
      fields.forEach((field, index) => {
        const name = field.getName();
        console.log(`📝 Feld ${index}: ${name} (Type: ${field.constructor.name})`);
        
        try {
          let value = '';
          
          // Verschiedene Feldtypen unterstützen (inkl. Firefox Windows)
          if (field.constructor.name === 'PDFTextField') {
            value = field.getText() || '';
            
            // Firefox Windows: Versuche auch Alternative-Methoden
            if (!value && typeof field.getPartialName === 'function') {
              try {
                const partialName = field.getPartialName();
                console.log(`  🔄 Firefox-Fallback für Feld: ${partialName}`);
              } catch (e) {}
            }
            
            // Firefox Windows: Prüfe annotations
            if (!value && field.acroField && field.acroField.getDefaultValue) {
              try {
                value = field.acroField.getDefaultValue() || '';
              } catch (e) {}
            }
            
          } else if (field.constructor.name === 'PDFTextBoxField') {
            value = field.getText() || '';
          } else if (typeof field.getValue === 'function') {
            value = field.getValue() || '';
          } else if (typeof field.getDefaultValue === 'function') {
            value = field.getDefaultValue() || '';
          }
          
          // Firefox Windows: Zusätzliche Wert-Extraktions-Versuche
          if (!value && field.ref) {
            try {
              // Direkte Annotation-Referenz prüfen
              const pdfRef = field.ref;
              const annotation = pdfDoc.context.lookup(pdfRef);
              if (annotation && annotation.get && annotation.get('V')) {
                const rawValue = annotation.get('V');
                if (typeof rawValue === 'string') {
                  value = rawValue;
                  console.log(`  ✅ Firefox-Annotation-Wert: ${value.substring(0, 50)}`);
                } else if (rawValue && rawValue.decodeText) {
                  value = rawValue.decodeText();
                  console.log(`  ✅ Firefox-Decoded-Wert: ${value.substring(0, 50)}`);
                }
              }
            } catch (annotationError) {
              console.log(`  ⚠️ Annotation-Fehler für ${name}:`, annotationError.message);
            }
          }
          
          console.log(`  Wert: "${value}"`);
          
          if (value && value.trim()) {
            // Erweiterte Feldname-Erkennung
            const lowerName = name.toLowerCase();
            const cleanValue = value.trim();
            
            // Kunde/Name-Felder
            if (lowerName.includes('kunde') || 
                lowerName.includes('name') || 
                lowerName.includes('customer') ||
                name === 'customer_name') {
              customerName = cleanValue;
              console.log(`  ✅ Kundenname erkannt: ${cleanValue}`);
            }
            // Frage 1
            else if (lowerName.includes('frage1') || 
                     lowerName.includes('question1') || 
                     lowerName.includes('frage_1') ||
                     lowerName.includes('question_1') ||
                     name === 'question_1') {
              answer1 = cleanValue;
              console.log(`  ✅ Antwort 1 erkannt: ${cleanValue.substring(0, 50)}...`);
            }
            // Frage 2
            else if (lowerName.includes('frage2') || 
                     lowerName.includes('question2') || 
                     lowerName.includes('frage_2') ||
                     lowerName.includes('question_2') ||
                     name === 'question_2') {
              answer2 = cleanValue;
              console.log(`  ✅ Antwort 2 erkannt: ${cleanValue.substring(0, 50)}...`);
            }
            // Frage 3
            else if (lowerName.includes('frage3') || 
                     lowerName.includes('question3') || 
                     lowerName.includes('frage_3') ||
                     lowerName.includes('question_3') ||
                     name === 'question_3') {
              answer3 = cleanValue;
              console.log(`  ✅ Antwort 3 erkannt: ${cleanValue.substring(0, 50)}...`);
            }
            // Frage 4
            else if (lowerName.includes('frage4') || 
                     lowerName.includes('question4') || 
                     lowerName.includes('frage_4') ||
                     lowerName.includes('question_4') ||
                     name === 'question_4') {
              answer4 = cleanValue;
              console.log(`  ✅ Antwort 4 erkannt: ${cleanValue.substring(0, 50)}...`);
            }
            // Fallback: Numerische Reihenfolge für unbenannte Felder
            else if (index === 0 && !customerName) {
              customerName = cleanValue;
              console.log(`  ✅ Kundenname via Index erkannt: ${cleanValue}`);
            } else if (index === 1 && !answer1) {
              answer1 = cleanValue;
              console.log(`  ✅ Antwort 1 via Index erkannt: ${cleanValue.substring(0, 50)}...`);
            } else if (index === 2 && !answer2) {
              answer2 = cleanValue;
              console.log(`  ✅ Antwort 2 via Index erkannt: ${cleanValue.substring(0, 50)}...`);
            } else if (index === 3 && !answer3) {
              answer3 = cleanValue;
              console.log(`  ✅ Antwort 3 via Index erkannt: ${cleanValue.substring(0, 50)}...`);
            } else if (index === 4 && !answer4) {
              answer4 = cleanValue;
              console.log(`  ✅ Antwort 4 via Index erkannt: ${cleanValue.substring(0, 50)}...`);
            } else {
              console.log(`  ⚠️ Unbekanntes Feld: "${name}" = "${cleanValue.substring(0, 50)}..."`);
            }
          }
          
        } catch (fieldError) {
          console.log(`⚠️ Fehler beim Lesen des Felds ${name}:`, fieldError.message);
        }
      });
      
      console.log('✅ Formularfelder gelesen:', { customerName, answer1: answer1.substring(0, 50), answer2: answer2.substring(0, 50), answer3: answer3.substring(0, 50), answer4: answer4.substring(0, 50) });
      
    } catch (formError) {
      console.log('⚠️ Keine Formularfelder gefunden, versuche Text-Extraktion:', formError.message);
      
      // Strategie 2: Fallback auf Text-Extraktion mit Windows-Unterstützung
      try {
        console.log('🔄 Starte Text-Extraktion...');
        
        // Mehrere Optionen für bessere Windows-Kompatibilität
        const parseOptions = {
          max: 0, // Keine Begrenzung der Seiten
          version: 'v1.10.100', // Explicit version für Konsistenz
          // Encoding-Unterstützung für Windows
          normalizeWhitespace: true,
          disableCombineTextItems: false
        };
        
        const data = await pdfParse(dataBuffer, parseOptions);
        const text = data.text;
        
        console.log('📄 Text-Extraktion erfolgreich, Länge:', text.length, 'Zeichen');
        console.log('📄 Extrahierter Text (Beginn):', text.substring(0, 200) + '...');
        
        // Prüfung auf typische Windows-Encoding-Probleme
        if (text.includes('â€™') || text.includes('Ã¤') || text.includes('Ã¼')) {
          console.log('⚠️ Mögliches Encoding-Problem erkannt');
        }
        
        // Kundenname extrahieren
        const customerMatch = text.match(/Kundenname:\\s*([^\\n_]+)/i);
        if (customerMatch && customerMatch[1].trim()) {
          customerName = customerMatch[1].trim();
        }
        
        // Erweiterte Antworten-Extraktion für verschiedene PDF-Formate (inkl. Firefox Windows)
        const extractAnswer = (text, questionNumber) => {
          const patterns = [
            // Original-Muster
            new RegExp(`Frage ${questionNumber}:.*?Antwort:\\s*([^\\n]*(?:\\n[^\\n]*)*?)(?=Frage|$)`, 'i'),
            new RegExp(`${questionNumber}\\..*?([\\s\\S]*?)(?=\\d+\\.|$)`, 'i'),
            new RegExp(`Frage ${questionNumber}.*?([\\s\\S]*?)(?=Frage|$)`, 'i'),
            
            // Browser-PDF Muster
            new RegExp(`${questionNumber}\\. .*?\\n\\s*([\\s\\S]*?)(?=\\d+\\.|$)`, 'i'),
            new RegExp(`Question ${questionNumber}.*?\\n\\s*([\\s\\S]*?)(?=Question|$)`, 'i'),
            
            // Firefox Windows spezifische Muster
            new RegExp(`${questionNumber}\\)\\s*([\\s\\S]*?)(?=\\d+\\)|$)`, 'i'), // "1) Antwort"
            new RegExp(`\\b${questionNumber}\\b[^\\n]*\\n\\s*([^\\n]*(?:\\n[^\\d]*)*?)(?=\\b\\d+\\b|$)`, 'gi'), // Nummerierte Listen
            new RegExp(`${questionNumber}[\\s\\S]{0,20}?:\\s*([\\s\\S]*?)(?=\\d+[\\s\\S]{0,20}?:|$)`, 'i'), // "1: Antwort"
            
            // Noch flexiblere Muster für Browser-bearbeitete PDFs
            new RegExp(`(?:Frage|Question)\\s*${questionNumber}[^\\n]*\\n([\\s\\S]*?)(?=(?:Frage|Question)\\s*\\d+|$)`, 'i'),
            new RegExp(`${questionNumber}[^\\n]*?(?:Produkte|Service|Verbesserungen)[^\\n]*\\n([\\s\\S]*?)(?=\\d+\\.|$)`, 'i'),
            
            // Firefox Windows: Text zwischen Nummern ohne spezielle Marker
            new RegExp(`\\b${questionNumber}\\b[\\s\\S]{0,50}?([a-zA-ZäöüÄÖÜß][\\s\\S]*?)(?=\\b(?:${questionNumber + 1}|${questionNumber === 4 ? 'Ende|Anweisungen' : questionNumber + 1}|Kundenname)\\b|$)`, 'i'),
          ];
          
          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              let answer = match[1].trim()
                .replace(/_{3,}/g, '')  // Unterstriche entfernen
                .replace(/\n\s*\n/g, '\n')  // Doppelte Zeilenumbrüche
                .replace(/^\s*[\-\*\•]\s*/, '')  // Aufzählungszeichen am Anfang
                .trim();
              
              if (answer.length > 5) {  // Mindestens 5 Zeichen für gültige Antwort
                return answer;
              }
            }
          }
          return '';
        };
        
        if (!answer1) answer1 = extractAnswer(text, 1);
        if (!answer2) answer2 = extractAnswer(text, 2);
        if (!answer3) answer3 = extractAnswer(text, 3);
        if (!answer4) answer4 = extractAnswer(text, 4);
        
        console.log('✅ Text-Extraktion abgeschlossen');
      } catch (textError) {
        console.error('❌ Text-Extraktion fehlgeschlagen:', textError);
        console.error('❌ Text-Fehler Details:', {
          message: textError.message,
          stack: textError.stack?.substring(0, 200)
        });
        
        // Letzter Versuch: Binäre Suche nach Text-Patterns (Firefox Windows)
        try {
          console.log('🔄 Versuche binäre Pattern-Erkennung für Firefox Windows...');
          
          // Mehrere Encoding-Versuche für Windows Firefox
          const encodings = ['latin1', 'utf8', 'ascii', 'binary'];
          
          for (const encoding of encodings) {
            try {
              const bufferString = dataBuffer.toString(encoding);
              
              // Firefox Windows: Suche nach Input-Werten in PDF-Stream
              const inputPatterns = [
                /\/V\s*\(([^)]{3,})\)/g,  // Standard PDF-Werte
                /\/FT\s*\/Tx[^(]*\(([^)]{3,})\)/g,  // Text-Felder
                /BT[^ET]*\(([^)]{5,})\)[^ET]*ET/g,  // Text-Objekte
                />\s*([a-zA-ZäöüÄÖÜß][^<]{10,})\s*</g  // XML-ähnliche Struktur
              ];
              
              let foundValues = [];
              inputPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(bufferString)) !== null) {
                  const value = match[1].trim();
                  if (value.length > 3 && !value.match(/^[0-9\s.]+$/) && !foundValues.includes(value)) {
                    foundValues.push(value);
                  }
                }
              });
              
              if (foundValues.length > 0) {
                console.log(`📝 Firefox ${encoding} Text-Fragmente:`, foundValues.slice(0, 5).map(v => v.substring(0, 50)));
                
                // Versuche intelligente Zuordnung der gefundenen Werte
                if (foundValues.length >= 1 && !customerName) {
                  customerName = foundValues[0];
                  console.log(`  ✅ Firefox-Binär Kundenname: ${customerName}`);
                }
                if (foundValues.length >= 2 && !answer1) {
                  answer1 = foundValues[1];
                  console.log(`  ✅ Firefox-Binär Antwort 1: ${answer1.substring(0, 50)}`);
                }
                if (foundValues.length >= 3 && !answer2) {
                  answer2 = foundValues[2];
                  console.log(`  ✅ Firefox-Binär Antwort 2: ${answer2.substring(0, 50)}`);
                }
                if (foundValues.length >= 4 && !answer3) {
                  answer3 = foundValues[3];
                  console.log(`  ✅ Firefox-Binär Antwort 3: ${answer3.substring(0, 50)}`);
                }
                if (foundValues.length >= 5 && !answer4) {
                  answer4 = foundValues[4];
                  console.log(`  ✅ Firefox-Binär Antwort 4: ${answer4.substring(0, 50)}`);
                }
                
                if (foundValues.length > 0) break; // Erfolgreich, stoppe weitere Encoding-Versuche
              }
            } catch (encodingError) {
              console.log(`⚠️ Encoding ${encoding} fehlgeschlagen:`, encodingError.message);
            }
          }
        } catch (binaryError) {
          console.error('❌ Auch Firefox-binäre Pattern-Erkennung fehlgeschlagen:', binaryError.message);
        }
      }
    }
    
    // Erweiterte Validierung mit Windows-spezifischen Hinweisen
    if (customerName === 'Unbekannt' && !answer1 && !answer2 && !answer3 && !answer4) {
      const userAgent = req.headers['user-agent'] || '';
      const isWindows = userAgent.includes('Windows');
      
      let errorMessage = 'Keine verwertbaren Daten im PDF gefunden. ';
      const isFirefox = userAgent.includes('Firefox');
      
      errorMessage += 'Verwenden Sie FOXIT PDF READER zum Ausfüllen des Formulars. ';
      
      if (isWindows && isFirefox) {
        errorMessage += 'Firefox Windows: Nach dem Ausfüllen STRG+S drücken und gespeicherte Datei hochladen.';
      } else if (isWindows) {
        errorMessage += 'Windows: Foxit PDF Reader herunterladen, PDF öffnen, ausfüllen und speichern.';
      } else {
        errorMessage += 'Foxit PDF Reader verwenden und nach dem Ausfüllen speichern.';
      }
      
      return res.status(400).json({ 
        error: errorMessage,
        platform: isWindows ? 'Windows' : 'Other',
        suggestions: [
          'Foxit PDF Reader herunterladen und installieren',
          'PDF mit Foxit Reader öffnen (nicht im Browser)',
          'Alle 4 Interface-Information-Felder ausfüllen',
          'Datei speichern und die gespeicherte Datei hochladen',
          'NICHT den Browser-PDF-Viewer verwenden'
        ]
      });
    }
    
    console.log('💾 Speichere in Datenbank:', { customerName, hasAnswer1: !!answer1, hasAnswer2: !!answer2, hasAnswer3: !!answer3, hasAnswer4: !!answer4 });
    
    // In Datenbank speichern
    const [result] = await pool.execute(`
      INSERT INTO icd_entries (customer_name, question_1, question_2, question_3, question_4, pdf_filename)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [customerName, answer1, answer2, answer3, answer4, req.file.filename]);
    
    res.json({
      id: result.insertId,
      customer_name: customerName,
      question_1: answer1,
      question_2: answer2,
      question_3: answer3,
      pdf_filename: req.file.filename,
      message: 'PDF erfolgreich verarbeitet und gespeichert'
    });
    
  } catch (error) {
    console.error('❌ Fehler beim PDF-Upload:', error);
    console.error('❌ Error Stack:', error.stack);
    console.error('❌ Error Details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    
    // Datei-Info für Debug
    if (req.file) {
      console.error('📄 Fehlgeschlagene Datei:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      });
    }
    
    // Temporäre Datei löschen
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Temporäre Datei gelöscht:', req.file.path);
      } catch (unlinkError) {
        console.error('❌ Fehler beim Löschen der temporären Datei:', unlinkError);
      }
    }
    
    const userAgent = req.headers['user-agent'] || '';
    const isWindows = userAgent.includes('Windows');
    const isFirefox = userAgent.includes('Firefox');
    
    let errorMessage = 'Fehler beim Verarbeiten der PDF. ';
    
    if (isWindows && isFirefox) {
      errorMessage += 'Firefox Windows: Versuchen Sie, nach dem Ausfüllen STRG+S zu drücken und die gespeicherte Datei hochzuladen (nicht den Browser-Tab).';
    } else if (error.message && error.message.includes('PDF')) {
      errorMessage += 'Möglicherweise ist die PDF-Datei beschädigt oder wurde nicht korrekt gespeichert.';
    } else {
      errorMessage += 'Bitte versuchen Sie es erneut oder verwenden Sie ein anderes PDF-Programm.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      platform: isWindows ? 'Windows' : 'Other',
      browser: isFirefox ? 'Firefox' : 'Other'
    });
  }
});

// =====================================================
// PostgreSQL Sensor-Daten API
// =====================================================

// Aktuelle Sensor-Werte mit Standort-Parameter
app.get('/api/sensors/current/:location?', async (req, res) => {
  const location = req.params.location || 'ssa'; // Standard: ssa
  try {
    if (isDevelopment || !pgPool) {
      // Mock-Daten im Entwicklungsmodus
      res.json({
        temperature: {
          timedate: new Date().toISOString(),
          temperature: Math.round((21.7 + (Math.random() * 2 - 1)) * 10) / 10
        },
        humidity: {
          timedate: new Date().toISOString(),
          humidity: Math.round((65.2 + (Math.random() * 10 - 5)) * 10) / 10
        },
        timestamp: new Date(),
        source: 'mock'
      });
      return;
    }

    // Echte Daten aus PostgreSQL
    console.log(`🌡️ Abfrage aktueller Sensordaten für Standort: ${location}`);
    
    // Dynamische Tabellenauswahl basierend auf Standort
    const tempTable = `fms01.temp_${location}`;
    const humidityTable = `fms01.rh_${location}`;
    
    // Temperatur-Abfrage mit dynamischem Standort - hole ersten NICHT-NULL Wert
    const tempResult = await pgPool.query(`
      SELECT 
        "timedate" AS "time", 
        "Value" AS "temperature"
      FROM ${tempTable} 
      WHERE "Value" IS NOT NULL
      ORDER BY "timedate" DESC
      LIMIT 1
    `);
    
    // Luftfeuchtigkeit-Abfrage mit dynamischem Standort - hole ersten NICHT-NULL Wert
    const humidityResult = await pgPool.query(`
      SELECT 
        "timedate" AS "time", 
        "Value" AS "humidity" 
      FROM ${humidityTable} 
      WHERE "Value" IS NOT NULL
      ORDER BY "timedate" DESC
      LIMIT 1
    `);
    
    // Debug-Logging der Ergebnisse
    console.log('📊 Temperatur-Ergebnis:', tempResult.rows[0]);
    console.log('📊 Luftfeuchtigkeit-Ergebnis:', humidityResult.rows[0]);
    
    // Daten aufbereiten
    const tempData = tempResult.rows[0] ? {
      timedate: tempResult.rows[0].time,
      temperature: parseFloat(tempResult.rows[0].temperature)
    } : null;
    
    const humidityData = humidityResult.rows[0] ? {
      timedate: humidityResult.rows[0].time,
      humidity: parseFloat(humidityResult.rows[0].humidity)
    } : null;
    
    // Fehlerbehandlung wenn keine Daten
    if (!tempData || !humidityData) {
      console.warn('⚠️ Keine Sensordaten in der Datenbank gefunden');
      return res.json({
        temperature: tempData || { timedate: new Date().toISOString(), temperature: null },
        humidity: humidityData || { timedate: new Date().toISOString(), humidity: null },
        timestamp: new Date(),
        source: 'database',
        warning: 'Teilweise keine Daten verfügbar'
      });
    }
    
    res.json({
      temperature: tempData,
      humidity: humidityData,
      timestamp: new Date(),
      source: 'database',
      location: location,
      locationName: getLocationName(location)
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Sensordaten:', error);
    console.error('❌ Error Details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    
    // Detaillierte Fehlerbehandlung
    let errorMessage = 'Datenbankfehler';
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Keine Verbindung zur PostgreSQL-Datenbank';
    } else if (error.code === '42P01') {
      errorMessage = 'Tabelle nicht gefunden';
    } else if (error.code === '42703') {
      errorMessage = 'Spalte nicht gefunden';
    }
    
    res.status(500).json({
      temperature: {
        timedate: new Date().toISOString(),
        temperature: null
      },
      humidity: {
        timedate: new Date().toISOString(),
        humidity: null
      },
      timestamp: new Date(),
      source: 'error',
      error: true,
      errorMessage: errorMessage,
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verfügbare Sensor-Standorte
app.get('/api/sensors/locations', (req, res) => {
  try {
    const locations = [
      { id: 'ssa', name: 'Jarvis-Ecke', tables: ['temp_ssa', 'rh_ssa'] },
      { id: 'int_up', name: 'Am Telefon', tables: ['temp_int_up', 'rh_int_up'] },
      { id: 'int_low', name: 'Empore', tables: ['temp_int_low', 'rh_int_low'] }
    ];
    res.json(locations);
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Standorte:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Standorte' });
  }
});

// Historische Sensor-Daten
app.get('/api/sensors/history/:hours', async (req, res) => {
  const hours = parseInt(req.params.hours) || 24;
  
  try {
    if (isDevelopment || !pgPool) {
      // Mock-Daten für Historie
      const mockHistory = [];
      const now = new Date();
      for (let i = 0; i < hours * 4; i++) { // Alle 15 Minuten ein Datenpunkt
        const time = new Date(now.getTime() - (i * 15 * 60 * 1000));
        mockHistory.push({
          timedate: time.toISOString(),
          temperature: 21.7 + Math.sin(i / 10) * 2,
          humidity: 65.2 + Math.cos(i / 10) * 5
        });
      }
      res.json({
        temperature: mockHistory,
        humidity: mockHistory,
        source: 'mock'
      });
      return;
    }

    // Echte Daten aus PostgreSQL - filtere NULL und ungültige Werte
    const tempData = await pgPool.query(`
      SELECT "timedate", "Value" as temperature
      FROM fms01.temp_ssa 
      WHERE "timedate" >= NOW() - INTERVAL '${hours} hours'
        AND "Value" IS NOT NULL
      ORDER BY "timedate" ASC
    `);
    
    const humidityData = await pgPool.query(`
      SELECT "timedate", "Value" as humidity
      FROM fms01.rh_ssa 
      WHERE "timedate" >= NOW() - INTERVAL '${hours} hours'
        AND "Value" IS NOT NULL
      ORDER BY "timedate" ASC
    `);
    
    res.json({
      temperature: tempData.rows,
      humidity: humidityData.rows,
      source: 'database'
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der historischen Daten:', error);
    res.status(500).json({ error: 'Fehler beim Laden der historischen Daten' });
  }
});

// Sensor-Historie für spezifischen Standort und Zeitbereich
app.get('/api/sensors/history/:location/:hours', async (req, res) => {
  const { location, hours } = req.params;
  
  try {
    // Validierung
    const validLocations = ['ssa', 'int_up', 'int_low'];
    if (!validLocations.includes(location)) {
      return res.status(400).json({ error: 'Ungültiger Standort' });
    }
    
    const hoursNum = parseInt(hours);
    if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 8760) {
      return res.status(400).json({ error: 'Ungültige Stundenzahl' });
    }
    
    // Überprüfe ob PostgreSQL verfügbar ist
    if (!pgPool) {
      console.log('⚠️ PostgreSQL nicht verfügbar, verwende Mock-Daten');
      const mockHistory = [];
      const now = new Date();
      for (let i = 0; i < hoursNum * 4; i++) { // Alle 15 Minuten ein Datenpunkt
        const time = new Date(now.getTime() - i * 15 * 60 * 1000);
        mockHistory.push({
          timedate: time.toISOString(),
          temperature: 20 + Math.sin(i / 10) * 5 + Math.random() * 2,
          humidity: 50 + Math.sin(i / 8) * 10 + Math.random() * 5
        });
      }
      res.json({
        temperature: mockHistory.map(d => ({ timedate: d.timedate, temperature: d.temperature })),
        humidity: mockHistory.map(d => ({ timedate: d.timedate, humidity: d.humidity })),
        source: 'mock'
      });
      return;
    }

    // Dynamische Tabellenauswahl
    const tempTable = `fms01.temp_${location}`;
    const humidityTable = `fms01.rh_${location}`;
    
    // Echte Daten aus PostgreSQL
    const tempData = await pgPool.query(`
      SELECT "timedate", "Value" as temperature
      FROM ${tempTable}
      WHERE "timedate" >= NOW() - INTERVAL '${hoursNum} hours'
        AND "Value" IS NOT NULL
      ORDER BY "timedate" ASC
    `);
    
    const humidityData = await pgPool.query(`
      SELECT "timedate", "Value" as humidity
      FROM ${humidityTable}
      WHERE "timedate" >= NOW() - INTERVAL '${hoursNum} hours'
        AND "Value" IS NOT NULL
      ORDER BY "timedate" ASC
    `);
    
    res.json({
      temperature: tempData.rows,
      humidity: humidityData.rows,
      source: 'database',
      location: getLocationName(location)
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Sensor-Historie:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Sensor-Historie' });
  }
});

// 6-Monats-Umgebungsdaten für Bauteil
app.get('/api/bauteil/:barcode/environmental-history', async (req, res) => {
  const { barcode } = req.params;
  
  try {
    // Erstmal prüfen ob das Bauteil existiert
    const [componentCheck] = await pool.execute('SELECT id FROM bauteile WHERE barcode = ?', [barcode]);
    if (componentCheck.length === 0) {
      return res.status(404).json({ error: 'Bauteil nicht gefunden' });
    }

    // Debug logging
    console.log('🔍 Environmental history request debug:');
    console.log('  - isDevelopment:', isDevelopment);
    console.log('  - pgPool exists:', !!pgPool);
    console.log('  - NODE_ENV:', process.env.NODE_ENV);
    console.log('  - POSTGRES_HOST:', process.env.POSTGRES_HOST);
    
    // Prüfe ob PostgreSQL verfügbar ist
    if (!pgPool) {
      console.log('❌ PostgreSQL nicht verfügbar - keine Umgebungsdaten');
      return res.json({
        timeline: [],
        period: '6 Monate',
        dataPoints: 0,
        source: 'no_data',
        message: 'Keine Umgebungsdaten verfügbar'
      });
    }

    console.log('🌡️ Querying PostgreSQL for environmental history...');

    // Echte Timeline-Daten aus PostgreSQL - 6 Monate mit 5-Tage-Aggregation
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // 5-Tage-Intervalle für Temperatur-Daten - filtere NULL und ungültige Werte
    const tempTimeline = await pgPool.query(`
      SELECT 
        DATE_TRUNC('day', "timedate") - (EXTRACT(DOY FROM "timedate")::int % 5) * INTERVAL '1 day' as period_start,
        AVG("Value") as avg_temperature
      FROM fms01.temp_ssa 
      WHERE "timedate" >= $1
        AND "Value" IS NOT NULL
      GROUP BY period_start
      ORDER BY period_start ASC
    `, [sixMonthsAgo]);
    
    // 5-Tage-Intervalle für Feuchtigkeits-Daten - filtere NULL und ungültige Werte
    const humidityTimeline = await pgPool.query(`
      SELECT 
        DATE_TRUNC('day', "timedate") - (EXTRACT(DOY FROM "timedate")::int % 5) * INTERVAL '1 day' as period_start,
        AVG("Value") as avg_humidity
      FROM fms01.rh_ssa 
      WHERE "timedate" >= $1
        AND "Value" IS NOT NULL
      GROUP BY period_start
      ORDER BY period_start ASC
    `, [sixMonthsAgo]);
    
    // Timeline-Daten kombinieren
    const timeline = [];
    const tempMap = new Map();
    const humidityMap = new Map();
    
    // Temperatur-Daten in Map speichern
    tempTimeline.rows.forEach(row => {
      const period = row.period_start.toISOString().split('T')[0];
      tempMap.set(period, Math.round(row.avg_temperature * 10) / 10);
    });
    
    // Feuchtigkeits-Daten in Map speichern
    humidityTimeline.rows.forEach(row => {
      const period = row.period_start.toISOString().split('T')[0];
      humidityMap.set(period, Math.round(row.avg_humidity * 10) / 10);
    });
    
    // Alle Perioden sammeln und kombinieren
    const allPeriods = new Set([...tempMap.keys(), ...humidityMap.keys()]);
    
    for (const period of [...allPeriods].sort()) {
      timeline.push({
        date: period,
        temperature: tempMap.get(period) || null,
        humidity: humidityMap.get(period) || null
      });
    }
    
    res.json({
      timeline: timeline,
      period: '6 Monate',
      dataPoints: timeline.length,
      source: 'database'
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der 6-Monats-Umgebungsdaten:', error);
    console.log('🔄 Fallback to mock data due to PostgreSQL error');
    
    // Fallback zu Mock-Timeline-Daten bei PostgreSQL-Fehler (5-Tage-Intervalle)
    const fallbackTimeline = [];
    const now = new Date();
    
    for (let i = 0; i < 36; i++) { // 36 * 5 Tage = 180 Tage ≈ 6 Monate
      const daysAgo = new Date(now.getTime() - (i * 5 * 24 * 60 * 60 * 1000));
      const baseTemp = 22 + Math.sin(i / 8) * 4;
      const baseHumidity = 65 + Math.cos(i / 6) * 10;
      
      fallbackTimeline.unshift({
        date: daysAgo.toISOString().split('T')[0],
        temperature: Math.round((baseTemp + (Math.random() - 0.5) * 2) * 10) / 10,
        humidity: Math.round((baseHumidity + (Math.random() - 0.5) * 5) * 10) / 10
      });
    }
    
    const fallbackData = {
      timeline: fallbackTimeline,
      period: '6 Monate',
      dataPoints: fallbackTimeline.length,
      source: 'fallback',
      error: true
    };
    res.json(fallbackData);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Server wird heruntergefahren...');
  if (pool) {
    await pool.end();
  }
  if (pgPool) {
    await pgPool.end();
    console.log('🌡️ PostgreSQL-Verbindung geschlossen');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Server wird heruntergefahren...');
  if (pool) {
    await pool.end();
  }
  if (pgPool) {
    await pgPool.end();
    console.log('🌡️ PostgreSQL-Verbindung geschlossen');
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
    
    // Employees & Projects API Endpoints hinzufügen
    await setupEmployeesProjectsAPI();
    
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
