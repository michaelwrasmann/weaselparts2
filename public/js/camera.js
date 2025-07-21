/**
 * WeaselParts - Camera Module
 * Webcam-Funktionalität für Bauteilfotos
 */

class WeaselCamera {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.context = null;
    this.isActive = false;
    this.currentTab = 'upload';
    this.capturedImageData = null;
    
    // Kamera-Einstellungen
    this.constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment' // Rückkamera bevorzugen
      },
      audio: false
    };
    
    this.init();
  }
  
  init() {
    console.log('🎥 WeaselCamera initialisiert');
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Tab-Wechsel
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        this.switchTab(e.target.dataset.tab);
      }
    });
    
    // Kamera-Buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('camera-btn') || e.target.closest('.camera-btn')) {
        const btn = e.target.classList.contains('camera-btn') ? e.target : e.target.closest('.camera-btn');
        this.handleCameraButton(btn);
      }
    });
    
    // Cleanup bei Page Unload
    window.addEventListener('beforeunload', () => {
      this.stopCamera();
    });
  }
  
  switchTab(tabName) {
    console.log('📑 Wechsle zu Tab:', tabName);
    this.currentTab = tabName;
    
    // Tab-Buttons aktualisieren
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });
    
    // Tab-Inhalte aktualisieren
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      }
    });
    
    // Bei Wechsel weg von Kamera → Stream stoppen
    if (tabName !== 'camera' && this.isActive) {
      this.stopCamera();
    }
  }
  
  async handleCameraButton(button) {
    const action = button.dataset.action;
    
    switch (action) {
      case 'start':
        await this.startCamera();
        break;
      case 'capture':
        this.capturePhoto();
        break;
      case 'stop':
        this.stopCamera();
        break;
      case 'switch':
        await this.switchCamera();
        break;
    }
  }
  
  async startCamera() {
    console.log('📷 Starte Kamera...');
    
    try {
      this.updateCameraStatus('Initialisiere Kamera...', false);
      this.setButtonStates({ start: false, capture: false, stop: false });
      
      // Prüfen ob Browser MediaDevices unterstützt
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Dein Browser unterstützt keine Kamera-Funktionen');
      }
      
      // Video-Element finden oder erstellen
      this.video = document.getElementById('camera-video');
      if (!this.video) {
        throw new Error('Kamera-Video-Element nicht gefunden');
      }
      
      // Canvas für Screenshots erstellen
      this.setupCanvas();
      
      // Kamera-Stream anfordern
      this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);
      
      // Stream mit Video-Element verbinden
      this.video.srcObject = this.stream;
      this.video.play();
      
      // Warten bis Video bereit ist
      await new Promise((resolve) => {
        this.video.onloadedmetadata = resolve;
      });
      
      this.isActive = true;
      this.updateCameraStatus('Kamera aktiv', true);
      this.setButtonStates({ start: false, capture: true, stop: true });
      
      console.log('✅ Kamera erfolgreich gestartet');
      showMessage('Kamera gestartet! Jetzt kannst du Fotos aufnehmen.', 'success');
      
    } catch (error) {
      console.error('❌ Kamera-Fehler:', error);
      this.handleCameraError(error);
    }
  }
  
  async stopCamera() {
    console.log('🛑 Stoppe Kamera...');
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('🔌 Track gestoppt:', track.kind);
      });
      this.stream = null;
    }
    
    if (this.video) {
      this.video.srcObject = null;
    }
    
    this.isActive = false;
    this.updateCameraStatus('Kamera gestoppt', false);
    this.setButtonStates({ start: true, capture: false, stop: false });
    
    console.log('✅ Kamera gestoppt');
  }
  
  capturePhoto() {
    if (!this.isActive || !this.video || !this.canvas) {
      showMessage('Kamera ist nicht aktiv', 'error');
      return;
    }
    
    console.log('📸 Nehme Foto auf...');
    
    try {
      // Canvas-Größe an Video anpassen
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      
      // Video-Frame auf Canvas zeichnen
      this.context.drawImage(this.video, 0, 0);
      
      // Als Data-URL konvertieren
      const imageDataUrl = this.canvas.toDataURL('image/jpeg', 0.8);
      this.capturedImageData = imageDataUrl;
      
      // Foto als Blob für Upload vorbereiten
      this.canvas.toBlob((blob) => {
        this.processCapturedPhoto(blob, imageDataUrl);
      }, 'image/jpeg', 0.8);
      
      console.log('✅ Foto aufgenommen');
      showMessage('Foto aufgenommen! 📸', 'success');
      
    } catch (error) {
      console.error('❌ Foto-Aufnahme fehlgeschlagen:', error);
      showMessage('Fehler beim Aufnehmen des Fotos', 'error');
    }
  }
  
  processCapturedPhoto(blob, dataUrl) {
    // Vorschau anzeigen
    this.displayPhotoPreview(dataUrl, 'Kamera-Foto');
    
    // File-Input mit Foto-Blob füllen
    this.createFileFromBlob(blob);
    
    // Zur Upload-Tab wechseln um Vorschau zu zeigen
    this.switchTab('upload');
  }
  
  createFileFromBlob(blob) {
    try {
      // Neuen File erstellen
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `camera-photo-${timestamp}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      
      // File-Input aktualisieren
      const fileInput = document.getElementById('component-image');
      if (fileInput) {
        // DataTransfer für File-Input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        
        // Change-Event auslösen
        const changeEvent = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(changeEvent);
      }
      
      console.log('📁 File erstellt:', filename, 'Größe:', Math.round(blob.size / 1024), 'KB');
      
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Datei:', error);
    }
  }
  
  displayPhotoPreview(dataUrl, filename) {
    const preview = document.getElementById('image-preview');
    if (!preview) return;
    
    preview.innerHTML = `
      <div class="preview-container">
        <img src="${dataUrl}" alt="Kamera-Foto" class="preview-image">
        <div class="preview-info">
          <span class="file-name">${filename}</span>
          <button type="button" class="remove-image" onclick="weaselCamera.removePhoto()">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }
  
  removePhoto() {
    console.log('🗑️ Entferne Foto...');
    
    const fileInput = document.getElementById('component-image');
    const preview = document.getElementById('image-preview');
    
    if (fileInput) fileInput.value = '';
    if (preview) preview.innerHTML = '';
    
    this.capturedImageData = null;
    
    console.log('✅ Foto entfernt');
  }
  
  async switchCamera() {
    if (!this.isActive) return;
    
    console.log('🔄 Wechsle Kamera...');
    
    try {
      // Aktuelle Kamera-Ausrichtung ermitteln
      const currentFacingMode = this.constraints.video.facingMode;
      
      // Zwischen Front- und Rückkamera wechseln
      this.constraints.video.facingMode = 
        currentFacingMode === 'environment' ? 'user' : 'environment';
      
      // Kamera neu starten
      await this.stopCamera();
      await this.startCamera();
      
      const newMode = this.constraints.video.facingMode === 'environment' ? 'Rückkamera' : 'Frontkamera';
      showMessage(`Zu ${newMode} gewechselt`, 'info');
      
    } catch (error) {
      console.error('❌ Kamera-Wechsel fehlgeschlagen:', error);
      showMessage('Kamera-Wechsel fehlgeschlagen', 'error');
      
      // Fallback: ursprüngliche Kamera wieder starten
      this.constraints.video.facingMode = 'environment';
      await this.startCamera();
    }
  }
  
  setupCanvas() {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d');
    }
  }
  
  updateCameraStatus(message, isActive) {
    const statusElement = document.querySelector('.camera-status');
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.classList.toggle('active', isActive);
  }
  
  setButtonStates(states) {
    Object.entries(states).forEach(([action, enabled]) => {
      const button = document.querySelector(`[data-action="${action}"]`);
      if (button) {
        button.disabled = !enabled;
      }
    });
  }
  
  handleCameraError(error) {
    let errorMessage = 'Unbekannter Kamera-Fehler';
    let userMessage = 'Fehler beim Zugriff auf die Kamera';
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = 'Kamera-Zugriff wurde verweigert';
      userMessage = 'Bitte erlaube den Kamera-Zugriff in deinem Browser';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMessage = 'Keine Kamera gefunden';
      userMessage = 'Es wurde keine Kamera an diesem Gerät gefunden';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMessage = 'Kamera bereits in Verwendung';
      userMessage = 'Die Kamera wird bereits von einer anderen Anwendung verwendet';
    } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
      errorMessage = 'Kamera-Einstellungen nicht unterstützt';
      userMessage = 'Die gewünschten Kamera-Einstellungen werden nicht unterstützt';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'Browser unterstützt keine Kamera';
      userMessage = 'Dein Browser unterstützt keine Kamera-Funktionen';
    } else if (error.message) {
      errorMessage = error.message;
      userMessage = error.message;
    }
    
    console.error('🚫 Kamera-Fehler:', errorMessage);
    
    this.displayCameraError(userMessage);
    this.updateCameraStatus('Fehler', false);
    this.setButtonStates({ start: true, capture: false, stop: false });
    
    showMessage(userMessage, 'error');
  }
  
  displayCameraError(message) {
    const cameraPreview = document.querySelector('.camera-preview');
    if (!cameraPreview) return;
    
    cameraPreview.innerHTML = `
      <div class="camera-error">
        <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <h4>Kamera-Fehler</h4>
        <p>${message}</p>
        <button class="btn secondary" onclick="weaselCamera.startCamera()">
          Erneut versuchen
        </button>
      </div>
    `;
  }
  
  // Utility-Methoden
  async getAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      console.log('📹 Verfügbare Kameras:', cameras.length);
      return cameras;
    } catch (error) {
      console.error('❌ Fehler beim Ermitteln der Kameras:', error);
      return [];
    }
  }
  
  getCameraCapabilities() {
    if (!this.stream) return null;
    
    const track = this.stream.getVideoTracks()[0];
    if (!track) return null;
    
    return track.getCapabilities();
  }
  
  getCurrentCameraSettings() {
    if (!this.stream) return null;
    
    const track = this.stream.getVideoTracks()[0];
    if (!track) return null;
    
    return track.getSettings();
  }
  
  // Debugging
  logCameraInfo() {
    console.log('🔍 Kamera-Info:');
    console.log('  - Aktiv:', this.isActive);
    console.log('  - Stream:', !!this.stream);
    console.log('  - Video:', !!this.video);
    console.log('  - Canvas:', !!this.canvas);
    
    if (this.isActive) {
      const settings = this.getCurrentCameraSettings();
      console.log('  - Einstellungen:', settings);
      
      const capabilities = this.getCameraCapabilities();
      console.log('  - Fähigkeiten:', capabilities);
    }
  }
}

// Globale Instanz erstellen
let weaselCamera = null;

// Initialisierung
document.addEventListener('DOMContentLoaded', function() {
  if (document.querySelector('.image-upload-container')) {
    weaselCamera = new WeaselCamera();
    console.log('🎥 WeaselCamera global verfügbar');
  }
});

// Cleanup bei Page Unload
window.addEventListener('beforeunload', function() {
  if (weaselCamera) {
    weaselCamera.stopCamera();
  }
});

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WeaselCamera;
}
