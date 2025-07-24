/**
 * WeaselParts API Client
 * Kommunikation mit dem Backend
 */

// API-Basis-URL
const baseUrl = window.location.origin;

/**
 * Allgemeine API-Fehlerfunktion
 * @param {Response} response - Die Fetch-Response
 * @returns {Promise} - Resolves mit den Daten oder Rejects mit einem Fehler
 */
async function handleResponse(response) {
  const contentType = response.headers.get('content-type');
  
  // Prüfen, ob die Antwort JSON ist
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API-Fehler');
    }
    
    return data;
  } else {
    // Wenn keine JSON-Antwort erhalten wurde, werfen wir einen Fehler
    const text = await response.text();
    throw new Error(`Keine gültige JSON-Antwort (${response.status}): ${text.substring(0, 100)}...`);
  }
}

/**
 * API-Funktionen für WeaselParts
 */
const api = {
  /**
   * Holt alle Schränke
   * @returns {Promise<Array>} Liste aller Schränke
   */
  getCabinets: async function() {
    try {
      const response = await fetch(`${baseUrl}/api/schraenke`);
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Laden der Schränke:', error);
      throw error;
    }
  },
  
  /**
   * Erstellt einen neuen Schrank
   * @param {Object} data - Schrank-Daten (name)
   * @returns {Promise<Object>} Der erstellte Schrank
   */
  createCabinet: async function(data) {
    try {
      const response = await fetch(`${baseUrl}/api/schraenke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Erstellen des Schranks:', error);
      throw error;
    }
  },
  
  /**
   * Löscht einen Schrank
   * @param {number} id - ID des Schranks
   * @returns {Promise<Object>} Erfolgs-/Fehlermeldung
   */
  deleteCabinet: async function(id) {
    try {
      const response = await fetch(`${baseUrl}/api/schraenke/${id}`, {
        method: 'DELETE'
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Löschen des Schranks:', error);
      throw error;
    }
  },
  
  /**
   * Ruft den Inhalt eines Schranks ab
   * @param {number} id - ID des Schranks
   * @returns {Promise<Array>} Liste der Bauteile im Schrank
   */
  getCabinetContents: async function(id) {
    try {
      const response = await fetch(`${baseUrl}/api/schraenke/${id}/inhalt`);
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Laden des Schrankinhalts:', error);
      throw error;
    }
  },
  
  /**
   * Ruft ein Bauteil anhand des Barcodes ab
   * @param {string} barcode - Barcode des Bauteils
   * @returns {Promise<Object>} Bauteil-Daten
   */
  getComponent: async function(barcode) {
    try {
      const response = await fetch(`${baseUrl}/api/bauteil/${encodeURIComponent(barcode)}`);
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Laden des Bauteils:', error);
      throw error;
    }
  },
  
  /**
   * Ruft alle Bauteile ab
   * @returns {Promise<Array>} Liste aller Bauteile
   */
  getAllComponents: async function() {
    try {
      const response = await fetch(`${baseUrl}/api/bauteile`);
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Laden der Bauteile:', error);
      throw error;
    }
  },

  /**
   * Ruft alle Parts ab (Alias für getAllComponents)
   * @returns {Promise<Array>} Liste aller Parts/Bauteile
   */
  getAllParts: async function() {
    try {
      const response = await fetch(`${baseUrl}/api/parts`);
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Laden der Parts:', error);
      throw error;
    }
  },
  
  /**
   * Sucht nach Bauteilen
   * @param {string} query - Suchbegriff
   * @returns {Promise<Array>} Liste der gefundenen Bauteile
   */
  searchComponents: async function(query) {
    try {
      const response = await fetch(`${baseUrl}/api/bauteile/suche?q=${encodeURIComponent(query)}`);
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler bei der Suche nach Bauteilen:', error);
      throw error;
    }
  },
  
  /**
   * Erstellt ein neues Bauteil
   * @param {Object} data - Bauteil-Daten
   * @returns {Promise<Object>} Das erstellte Bauteil
   */
  createComponent: async function(data) {
    try {
      const response = await fetch(`${baseUrl}/api/bauteile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Erstellen des Bauteils:', error);
      throw error;
    }
  },
  
  /**
   * Aktualisiert ein Bauteil
   * @param {string} barcode - Barcode des Bauteils
   * @param {Object} data - Neue Bauteil-Daten
   * @returns {Promise<Object>} Das aktualisierte Bauteil
   */
  updateComponent: async function(barcode, data) {
    try {
      const response = await fetch(`${baseUrl}/api/bauteil/${encodeURIComponent(barcode)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Bauteils:', error);
      throw error;
    }
  },
  
  /**
   * Löscht ein Bauteil
   * @param {string} barcode - Barcode des Bauteils
   * @returns {Promise<Object>} Erfolgs-/Fehlermeldung
   */
  deleteComponent: async function(barcode) {
    try {
      const response = await fetch(`${baseUrl}/api/bauteil/${encodeURIComponent(barcode)}`, {
        method: 'DELETE'
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Löschen des Bauteils:', error);
      throw error;
    }
  },
  
  /**
   * Lagert ein Bauteil in einen Schrank ein
   * @param {string} barcode - Barcode des Bauteils
   * @param {number} cabinetId - ID des Schranks
   * @returns {Promise<Object>} Erfolgs-/Fehlermeldung
   */
  storeComponent: async function(barcode, cabinetId) {
    try {
      const response = await fetch(`${baseUrl}/api/bauteil/${encodeURIComponent(barcode)}/einlagern/${cabinetId}`, {
        method: 'POST'
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Einlagern des Bauteils:', error);
      throw error;
    }
  },
  
  /**
   * Lagert ein Bauteil aus einem Schrank aus
   * @param {string} barcode - Barcode des Bauteils
   * @returns {Promise<Object>} Erfolgs-/Fehlermeldung
   */
  removeComponent: async function(barcode) {
    try {
      const response = await fetch(`${baseUrl}/api/bauteil/${encodeURIComponent(barcode)}/auslagern`, {
        method: 'POST'
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Auslagern des Bauteils:', error);
      throw error;
    }
  },
  
  /**
   * Lädt ein Bild für ein Bauteil hoch
   * @param {string} barcode - Barcode des Bauteils
   * @param {File} imageFile - Das Bild als File-Objekt
   * @returns {Promise<Object>} Upload-Informationen
   */
  uploadComponentImage: async function(barcode, imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await fetch(`${baseUrl}/api/bauteil/${encodeURIComponent(barcode)}/bild`, {
        method: 'POST',
        body: formData
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Hochladen des Bildes:', error);
      throw error;
    }
  },
  
  /**
   * Führt einen einfachen API-Test durch
   * @returns {Promise<Object>} Antwort vom Server
   */
  testConnection: async function() {
    try {
      const response = await fetch(`${baseUrl}/api/test`);
      return handleResponse(response);
    } catch (error) {
      console.error('API-Verbindungstest fehlgeschlagen:', error);
      throw error;
    }
  },

  // === ACTIVITY RECORDS API ===

  /**
   * Holt alle Activity Records für ein Bauteil
   * @param {string} barcode - Barcode des Bauteils
   * @returns {Promise<Array>} Liste aller Activity Records
   */
  getActivityRecords: async function(barcode) {
    try {
      const response = await fetch(`${baseUrl}/api/bauteil/${encodeURIComponent(barcode)}/activities`);
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Laden der Activity Records:', error);
      throw error;
    }
  },

  /**
   * Erstellt einen neuen Activity Record
   * @param {string} barcode - Barcode des Bauteils
   * @param {Object} activityData - Activity Record Daten
   * @returns {Promise<Object>} Erstellter Activity Record
   */
  createActivityRecord: async function(barcode, activityData) {
    try {
      const response = await fetch(`${baseUrl}/api/bauteil/${encodeURIComponent(barcode)}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(activityData)
      });
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Erstellen des Activity Records:', error);
      throw error;
    }
  },

  /**
   * Aktualisiert einen Activity Record
   * @param {number} recordId - ID des Activity Records
   * @param {Object} activityData - Activity Record Daten
   * @returns {Promise<Object>} Aktualisierter Activity Record
   */
  updateActivityRecord: async function(recordId, activityData) {
    try {
      const response = await fetch(`${baseUrl}/api/activities/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(activityData)
      });
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Activity Records:', error);
      throw error;
    }
  },

  /**
   * Löscht einen Activity Record
   * @param {number} recordId - ID des Activity Records
   * @returns {Promise<Object>} Erfolgsmeldung
   */
  deleteActivityRecord: async function(recordId) {
    try {
      const response = await fetch(`${baseUrl}/api/activities/${recordId}`, {
        method: 'DELETE'
      });
      return handleResponse(response);
    } catch (error) {
      console.error('Fehler beim Löschen des Activity Records:', error);
      throw error;
    }
  }
};
