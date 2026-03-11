/**
 * Enterprise Certificate Engine
 * High-performance bulk certificate generator with error boundaries
 * 
 * @version 2.0.0
 * @author Enterprise Frontend Team
 */

// ============================================
// STATE MANAGEMENT
// ============================================

const AppState = {
    // Template
    template: null,
    templateDimensions: { width: 3508, height: 2480 }, // A4 @ 300dpi
    
    // Data
    names: [],
    inputMode: 'json', // 'json' or 'csv'
    
    // Positioning (percentage based)
    position: { x: 50, y: 50 },
    
    // Text Styling
    style: {
        fontFamily: "'Playfair Display', serif",
        fontSize: 72,
        color: '#1e293b',
        style: 'normal',
        weight: '400'
    },
    
    // Generation State
    isGenerating: false,
    shouldCancel: false,
    currentZip: null,
    failedEntries: []
};

// ============================================
// DOM ELEMENTS CACHE
// ============================================

const DOM = {
    // Template
    templateUpload: document.getElementById('templateUpload'),
    templateLabel: document.getElementById('templateLabel'),
    
    // Preview
    previewContainer: document.getElementById('previewContainer'),
    previewImage: document.getElementById('previewImage'),
    emptyState: document.getElementById('emptyState'),
    previewStatus: document.getElementById('previewStatus'),
    
    // Draggable Tag
    draggableTag: document.getElementById('draggableTag'),
    tagText: document.getElementById('tagText'),
    positionDisplay: document.getElementById('positionDisplay'),
    
    // Style Controls
    fontFamily: document.getElementById('fontFamily'),
    fontSize: document.getElementById('fontSize'),
    fontColor: document.getElementById('fontColor'),
    colorHex: document.getElementById('colorHex'),
    fontStyle: document.getElementById('fontStyle'),
    fontWeight: document.getElementById('fontWeight'),
    
    // Data Input
    jsonModeBtn: document.getElementById('jsonModeBtn'),
    csvModeBtn: document.getElementById('csvModeBtn'),
    dataInput: document.getElementById('dataInput'),
    dataCount: document.getElementById('dataCount'),
    csvUpload: document.getElementById('csvUpload'),
    
    // Actions
    generateBtn: document.getElementById('generateBtn'),
    
    // Progress Modal
    progressModal: document.getElementById('progressModal'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    progressPercent: document.getElementById('progressPercent'),
    progressDetail: document.getElementById('progressDetail'),
    currentName: document.getElementById('currentName'),
    cancelBtn: document.getElementById('cancelBtn'),
    doneBtn: document.getElementById('doneBtn'),
    
    // Offscreen Renderer
    offscreenRenderer: document.getElementById('offscreenRenderer'),
    offscreenName: document.getElementById('offscreenName')
};

// ============================================
// DRAG AND DROP FUNCTIONALITY
// ============================================

let isDragging = false;
let dragOffset = { x: 0, y: 0 };

/**
 * Initialize drag functionality for the name tag
 */
function initDrag() {
    DOM.draggableTag.addEventListener('mousedown', startDrag);
    DOM.draggableTag.addEventListener('touchstart', handleTouchStart, { passive: false });
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', stopDrag);
}

function startDrag(e) {
    isDragging = true;
    DOM.draggableTag.classList.add('dragging');
    
    const rect = DOM.draggableTag.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    dragOffset.x = clientX - rect.left - rect.width / 2;
    dragOffset.y = clientY - rect.top - rect.height / 2;
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    DOM.draggableTag.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    document.dispatchEvent(mouseEvent);
}

function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const containerRect = DOM.previewContainer.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    let x = ((clientX - dragOffset.x - containerRect.left) / containerRect.width) * 100;
    let y = ((clientY - dragOffset.y - containerRect.top) / containerRect.height) * 100;
    
    // Constrain to bounds
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    
    AppState.position.x = x;
    AppState.position.y = y;
    
    updateTagPosition();
}

function stopDrag() {
    isDragging = false;
    DOM.draggableTag.classList.remove('dragging');
}

/**
 * Update visual position of draggable tag and sync to offscreen renderer
 */
function updateTagPosition() {
    const x = AppState.position.x;
    const y = AppState.position.y;
    
    // Update preview
    DOM.draggableTag.style.left = `${x}%`;
    DOM.draggableTag.style.top = `${y}%`;
    DOM.positionDisplay.textContent = `${x.toFixed(1)}%, ${y.toFixed(1)}%`;
    
    // Sync offscreen renderer
    DOM.offscreenName.style.left = `${x}%`;
    DOM.offscreenName.style.top = `${y}%`;
}

// ============================================
// TEMPLATE HANDLING
// ============================================

/**
 * Handle template image upload
 */
DOM.templateUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const dataUrl = await readFileAsDataURL(file);
        AppState.template = dataUrl;
        
        // Load image to get dimensions
        const img = new Image();
        img.onload = () => {
            AppState.templateDimensions = {
                width: img.naturalWidth,
                height: img.naturalHeight
            };
            
            // Setup preview
            DOM.previewImage.src = dataUrl;
            DOM.previewContainer.style.display = 'inline-block';
            DOM.emptyState.style.display = 'none';
            
            // Setup offscreen renderer with exact dimensions
            DOM.offscreenRenderer.style.backgroundImage = `url(${dataUrl})`;
            DOM.offscreenRenderer.style.width = `${img.naturalWidth}px`;
            DOM.offscreenRenderer.style.height = `${img.naturalHeight}px`;
            
            // Update upload label
            updateTemplateLabel(file, img);
            
            // Update status
            updateStatus('Template loaded • Drag tag to position', 'success');
            
            validateForm();
        };
        img.src = dataUrl;
        
    } catch (error) {
        showError('Failed to load template: ' + error.message);
    }
});

function updateTemplateLabel(file, img) {
    DOM.templateLabel.classList.add('border-accent-primary', 'bg-dark-700');
    DOM.templateLabel.innerHTML = `
        <svg class="w-8 h-8 text-accent-primary mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="text-sm text-white font-medium">${escapeHtml(file.name)}</span>
        <span class="text-xs text-slate-400 mt-1">${(file.size / 1024 / 1024).toFixed(2)} MB • ${img.naturalWidth}×${img.naturalHeight}</span>
    `;
}

// ============================================
// STYLE CONTROLS
// ============================================

/**
 * Update text styling across preview and offscreen renderer
 */
function updateStyle() {
    // Update state
    AppState.style.fontFamily = DOM.fontFamily.value;
    AppState.style.fontSize = parseInt(DOM.fontSize.value) || 72;
    AppState.style.color = DOM.fontColor.value;
    AppState.style.style = DOM.fontStyle.value;
    AppState.style.weight = DOM.fontWeight.value;
    
    // Scale font size for preview (40% of actual for viewport fit)
    const previewSize = Math.min(AppState.style.fontSize * 0.4, 48);
    
    // Update preview tag
    DOM.tagText.style.fontFamily = AppState.style.fontFamily;
    DOM.tagText.style.fontSize = `${previewSize}px`;
    DOM.tagText.style.color = AppState.style.color;
    DOM.tagText.style.fontStyle = AppState.style.style;
    DOM.tagText.style.fontWeight = AppState.style.weight;
    
    // Update offscreen renderer
    DOM.offscreenName.style.fontFamily = AppState.style.fontFamily;
    DOM.offscreenName.style.fontSize = `${AppState.style.fontSize}px`;
    DOM.offscreenName.style.color = AppState.style.color;
    DOM.offscreenName.style.fontStyle = AppState.style.style;
    DOM.offscreenName.style.fontWeight = AppState.style.weight;
    
    // Sync color inputs
    DOM.colorHex.value = AppState.style.color;
}

// Style control event listeners
DOM.fontFamily.addEventListener('change', updateStyle);
DOM.fontSize.addEventListener('input', updateStyle);
DOM.fontColor.addEventListener('input', updateStyle);
DOM.colorHex.addEventListener('input', (e) => {
    DOM.fontColor.value = e.target.value;
    updateStyle();
});
DOM.fontStyle.addEventListener('change', updateStyle);
DOM.fontWeight.addEventListener('change', updateStyle);

// ============================================
// DATA INPUT HANDLING
// ============================================

// Mode switching
DOM.jsonModeBtn.addEventListener('click', () => setInputMode('json'));
DOM.csvModeBtn.addEventListener('click', () => setInputMode('csv'));

function setInputMode(mode) {
    AppState.inputMode = mode;
    
    if (mode === 'json') {
        DOM.jsonModeBtn.classList.add('bg-accent-primary', 'text-white');
        DOM.jsonModeBtn.classList.remove('bg-dark-600', 'text-slate-300');
        DOM.csvModeBtn.classList.remove('bg-accent-primary', 'text-white');
        DOM.csvModeBtn.classList.add('bg-dark-600', 'text-slate-300');
        DOM.dataInput.placeholder = '[{"name": "Lee Uttam"}, {"name": "លី ឧត្តម"}, {"name": "John Smith"}]';
    } else {
        DOM.csvModeBtn.classList.add('bg-accent-primary', 'text-white');
        DOM.csvModeBtn.classList.remove('bg-dark-600', 'text-slate-300');
        DOM.jsonModeBtn.classList.remove('bg-accent-primary', 'text-white');
        DOM.jsonModeBtn.classList.add('bg-dark-600', 'text-slate-300');
        DOM.dataInput.placeholder = 'name\nLee Uttam\nលី ឧត្តម\nJohn Smith';
    }
    
    parseData();
}

/**
 * Parse input data (JSON or CSV)
 */
function parseData() {
    const raw = DOM.dataInput.value.trim();
    
    if (!raw) {
        AppState.names = [];
        updateStats();
        validateForm();
        return;
    }
    
    try {
        if (AppState.inputMode === 'json') {
            const parsed = JSON.parse(raw);
            AppState.names = Array.isArray(parsed) 
                ? parsed.map(item => item.name || item).filter(n => n && String(n).trim())
                : [];
        } else {
            // Simple CSV/line parsing
            AppState.names = raw.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#') && line !== 'name' && line !== 'Name');
        }
        
        updateStats();
        validateForm();
        
    } catch (error) {
        AppState.names = [];
        updateStats();
        validateForm();
    }
}

DOM.dataInput.addEventListener('input', parseData);

// CSV File Upload
DOM.csvUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
        complete: (results) => {
            const names = results.data
                .flat()
                .map(n => String(n).trim())
                .filter(n => n && n.toLowerCase() !== 'name');
            
            DOM.dataInput.value = AppState.inputMode === 'json' 
                ? JSON.stringify(names.map(n => ({ name: n })), null, 2)
                : names.join('\n');
            
            parseData();
        },
        error: (err) => showError('CSV parsing error: ' + err.message)
    });
});

function updateStats() {
    const count = AppState.names.length;
    DOM.dataCount.textContent = `${count} entr${count === 1 ? 'y' : 'ies'}`;
    
    if (count > 0) {
        DOM.dataCount.classList.add('bg-accent-success/20', 'text-accent-success');
        DOM.dataCount.classList.remove('bg-accent-primary/20', 'text-accent-primary');
    } else {
        DOM.dataCount.classList.remove('bg-accent-success/20', 'text-accent-success');
        DOM.dataCount.classList.add('bg-accent-primary/20', 'text-accent-primary');
    }
}

function validateForm() {
    const isValid = AppState.template && AppState.names.length > 0;
    DOM.generateBtn.disabled = !isValid;
    
    if (isValid) {
        updateStatus(`${AppState.names.length} certificates ready`, 'ready');
    }
}

// ============================================
// GENERATION ENGINE
// ============================================

/**
 * Main generation function with error boundaries
 */
async function generateCertificates() {
    if (AppState.isGenerating) return;
    
    // Reset state
    AppState.isGenerating = true;
    AppState.shouldCancel = false;
    AppState.failedEntries = [];
    
    showProgressModal();
    
    const zip = new JSZip();
    const folder = zip.folder('certificates');
    const total = AppState.names.length;
    
    // Configure offscreen renderer
    DOM.offscreenRenderer.style.backgroundSize = 'cover';
    DOM.offscreenRenderer.style.backgroundPosition = 'center';
    DOM.offscreenRenderer.style.backgroundRepeat = 'no-repeat';
    
    // Process each name
    for (let i = 0; i < total; i++) {
        if (AppState.shouldCancel) break;
        
        const name = AppState.names[i];
        const safeFilename = sanitizeFilename(name);
        
        // Update progress UI
        updateProgress(i + 1, total, name);
        
        try {
            await generateSingleCertificate(name, folder, safeFilename);
        } catch (error) {
            console.error(`Failed to generate for ${name}:`, error);
            AppState.failedEntries.push({ name, error: error.message });
            // Continue with next - Error Boundary in action
        }
        
        // Yield to main thread every 3 items to prevent freezing
        if (i % 3 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    
    // Complete
    await completeGeneration(zip, total);
}

/**
 * Generate a single certificate image
 */
async function generateSingleCertificate(name, folder, filename) {
    // Update offscreen text
    DOM.offscreenName.textContent = name;
    
    // Wait for font to load (critical for Khmer)
    await document.fonts.ready;
    
    // Small delay for render stability
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Capture at 3x scale (Retina/print quality)
    const canvas = await html2canvas(DOM.offscreenRenderer, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        width: AppState.templateDimensions.width,
        height: AppState.templateDimensions.height,
        onclone: (clonedDoc) => {
            const clonedName = clonedDoc.getElementById('offscreenName');
            if (clonedName) {
                clonedName.style.fontFamily = AppState.style.fontFamily;
            }
        }
    });
    
    // Convert to blob
    const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Canvas to Blob failed'));
        }, 'image/png', 1.0);
    });
    
    // Add to ZIP
    folder.file(`Certificate_${filename}.png`, blob);
}

/**
 * Update progress UI
 */
function updateProgress(current, total, name) {
    const percent = Math.round((current / total) * 100);
    
    DOM.progressBar.style.width = `${percent}%`;
    DOM.progressText.textContent = `${current} of ${total}`;
    DOM.progressPercent.textContent = `${percent}%`;
    DOM.currentName.textContent = name;
    DOM.progressDetail.textContent = `Rendering with html2canvas at 3x scale...`;
}

/**
 * Complete generation and show download
 */
async function completeGeneration(zip, total) {
    AppState.isGenerating = false;
    AppState.currentZip = zip;
    
    if (AppState.shouldCancel) {
        hideProgressModal();
        return;
    }
    
    // Update UI for completion
    const failedCount = AppState.failedEntries.length;
    
    if (failedCount > 0) {
        DOM.progressDetail.textContent = `Completed with ${failedCount} errors`;
        DOM.progressDetail.classList.add('text-accent-warning');
    } else {
        DOM.progressDetail.textContent = 'All certificates generated successfully!';
        DOM.progressDetail.classList.add('text-accent-success');
    }
    
    DOM.cancelBtn.style.display = 'none';
    DOM.doneBtn.style.display = 'flex';
    
    // Reset progress bar
    DOM.progressBar.style.width = '0%';
}

/**
 * Download generated ZIP file
 */
async function downloadZip() {
    if (!AppState.currentZip) return;
    
    DOM.progressDetail.textContent = 'Compressing ZIP archive...';
    
    try {
        const content = await AppState.currentZip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        }, (metadata) => {
            DOM.progressBar.style.width = `${metadata.percent}%`;
        });
        
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `Certificates_Batch_${timestamp}_${AppState.names.length}.zip`;
        
        saveAs(content, filename);
        
        hideProgressModal();
        
        // Show error report if any failed
        if (AppState.failedEntries.length > 0) {
            const successCount = AppState.names.length - AppState.failedEntries.length;
            alert(
                `Generation Complete!\n\n` +
                `✓ Success: ${successCount}\n` +
                `✗ Failed: ${AppState.failedEntries.length}\n\n` +
                `Failed entries:\n${AppState.failedEntries.map(e => `• ${e.name}`).join('\n')}`
            );
        }
        
    } catch (error) {
        showError('Failed to create ZIP: ' + error.message);
    }
}

// ============================================
// UI HELPERS
// ============================================

function showProgressModal() {
    DOM.progressModal.classList.remove('hidden');
    DOM.progressModal.classList.add('flex');
    DOM.cancelBtn.style.display = 'block';
    DOM.doneBtn.style.display = 'none';
    DOM.progressDetail.classList.remove('text-accent-success', 'text-accent-warning');
}

function hideProgressModal() {
    DOM.progressModal.classList.add('hidden');
    DOM.progressModal.classList.remove('flex');
}

function updateStatus(message, type) {
    DOM.previewStatus.textContent = message;
    DOM.previewStatus.className = 'text-xs px-2 py-1 rounded-full border';
    
    if (type === 'success') {
        DOM.previewStatus.classList.add('bg-accent-primary/20', 'text-accent-primary', 'border-accent-primary/30');
    } else if (type === 'ready') {
        DOM.previewStatus.classList.add('bg-accent-success/20', 'text-accent-success', 'border-accent-success/30');
    } else {
        DOM.previewStatus.classList.add('bg-dark-700', 'text-slate-400', 'border-dark-500');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Read file as Data URL
 */
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * Sanitize filename for filesystem safety
 */
function sanitizeFilename(name) {
    return String(name)
        .replace(/[^a-zA-Z0-9\u1780-\u17FF]/g, '_') // Allow alphanumeric and Khmer
        .replace(/_+/g, '_')
        .substring(0, 100); // Limit length
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show error message
 */
function showError(message) {
    console.error(message);
    alert('Error: ' + message);
}

// ============================================
// EVENT LISTENERS
// ============================================

DOM.generateBtn.addEventListener('click', generateCertificates);
DOM.cancelBtn.addEventListener('click', () => {
    AppState.shouldCancel = true;
    DOM.progressDetail.textContent = 'Cancelling...';
});
DOM.doneBtn.addEventListener('click', downloadZip);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+Enter to generate
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !DOM.generateBtn.disabled) {
        e.preventDefault();
        generateCertificates();
    }
    
    // Escape to cancel
    if (e.key === 'Escape' && AppState.isGenerating) {
        AppState.shouldCancel = true;
    }
});

// ============================================
// INITIALIZATION
// ============================================

function init() {
    initDrag();
    updateStyle();
    updateTagPosition();
    console.log('🎓 Enterprise Certificate Engine initialized');
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}