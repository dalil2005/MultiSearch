// MultiSearch Extension
document.addEventListener('DOMContentLoaded', init);

// DOM Elements
const elements = {
    searchQuery: document.getElementById('searchQuery'),
    searchBtn: document.getElementById('searchBtn'),
    platformsList: document.getElementById('platformsList'),
    addPlatformBtn: document.getElementById('addPlatformBtn'),
    platformModal: document.getElementById('platformModal'),
    platformName: document.getElementById('platformName'),
    platformUrl: document.getElementById('platformUrl'),
    savePlatformBtn: document.getElementById('savePlatformBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    status: document.getElementById('status'),
    modalTitle: document.getElementById('modalTitle')
};

// Default platforms
const defaultPlatforms = [
    { id: '1', name: 'Google', url: 'https://www.google.com/search?q=QUERY', enabled: true },
    { id: '2', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=QUERY', enabled: true },
    { id: '3', name: 'Pinterest', url: 'https://www.pinterest.com/search/pins/?q=QUERY', enabled: true },
    { id: '4', name: 'GitHub', url: 'https://github.com/search?q=QUERY', enabled: true },
    { id: '5', name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Special:Search?search=QUERY', enabled: true }
];

let platforms = [];
let editingPlatformId = null;

// Initialize
async function init() {
    // Disable browser autocomplete completely
    elements.searchQuery.setAttribute('autocomplete', 'off');
    elements.searchQuery.setAttribute('autocorrect', 'off');
    elements.searchQuery.setAttribute('autocapitalize', 'off');
    elements.searchQuery.setAttribute('spellcheck', 'false');
    
    await loadPlatforms();
    setupEventListeners();
    renderPlatforms();
}

// Load platforms from storage
async function loadPlatforms() {
    try {
        const result = await chrome.storage.sync.get(['platforms']);
        if (result.platforms) {
            platforms = result.platforms;
        } else {
            platforms = defaultPlatforms;
            await savePlatforms();
        }
    } catch (error) {
        platforms = defaultPlatforms;
    }
}

// Save platforms to storage
async function savePlatforms() {
    await chrome.storage.sync.set({ platforms });
}

// Setup event listeners
function setupEventListeners() {
    // Search button
    elements.searchBtn.addEventListener('click', handleSearch);
    
    // Enter key in search
    elements.searchQuery.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    // Add platform button
    elements.addPlatformBtn.addEventListener('click', () => openModal());
    
    // Save platform
    elements.savePlatformBtn.addEventListener('click', savePlatform);
    
    // Cancel button
    elements.cancelBtn.addEventListener('click', closeModal);
    
    // Close modal on background click
    elements.platformModal.addEventListener('click', (e) => {
        if (e.target === elements.platformModal) closeModal();
    });
    
    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.platformModal.classList.contains('show')) {
            closeModal();
        }
    });
}

// Handle search
async function handleSearch() {
    const query = elements.searchQuery.value.trim();
    if (!query) {
        showStatus('Enter a search query', 'error');
        elements.searchQuery.focus();
        return;
    }

    const selectedPlatforms = platforms.filter(p => p.enabled);
    if (selectedPlatforms.length === 0) {
        showStatus('Select at least one platform', 'error');
        return;
    }

    // Show loading
    const originalText = elements.searchBtn.innerHTML;
    elements.searchBtn.innerHTML = 'Searching...';
    elements.searchBtn.disabled = true;

    try {
        for (const platform of selectedPlatforms) {
            const searchUrl = platform.url.replace('QUERY', encodeURIComponent(query));
            await chrome.tabs.create({ url: searchUrl, active: false });
        }
        
        showStatus(`Searching on ${selectedPlatforms.length} platform(s)`);
        elements.searchQuery.value = '';
        
    } catch (error) {
        showStatus('Error performing search', 'error');
    } finally {
        elements.searchBtn.innerHTML = originalText;
        elements.searchBtn.disabled = false;
    }
}

// Render platforms list
function renderPlatforms() {
    elements.platformsList.innerHTML = '';
    
    if (platforms.length === 0) {
        elements.platformsList.innerHTML = `
            <div class="empty-state">
                <p>No platforms added yet</p>
                <button class="add-first-btn" id="addFirstBtn">
                    ＋ Add Your First Platform
                </button>
            </div>
        `;
        document.getElementById('addFirstBtn').addEventListener('click', () => openModal());
        return;
    }
    
    platforms.forEach(platform => {
        const element = createPlatformElement(platform);
        elements.platformsList.appendChild(element);
    });
}

// Create platform element
function createPlatformElement(platform) {
    const div = document.createElement('div');
    div.className = 'platform-item';
    
    div.innerHTML = `
        <input 
            type="checkbox" 
            class="platform-checkbox" 
            id="check-${platform.id}"
            ${platform.enabled ? 'checked' : ''}
        >
        <div class="platform-info">
            <div class="platform-name">${escapeHtml(platform.name)}</div>
            <div class="platform-url" title="${escapeHtml(platform.url)}">
                ${truncateUrl(platform.url, 40)}
            </div>
        </div>
        <div class="platform-actions">
            <button class="edit-btn" title="Edit">✏️</button>
            <button class="delete-btn" title="Delete">🗑️</button>
        </div>
    `;
    
    // Add event listeners
    const checkbox = div.querySelector('.platform-checkbox');
    const editBtn = div.querySelector('.edit-btn');
    const deleteBtn = div.querySelector('.delete-btn');
    
    checkbox.addEventListener('change', () => {
        platform.enabled = checkbox.checked;
        savePlatforms();
    });
    
    editBtn.addEventListener('click', () => {
        openModal(platform);
    });
    
    deleteBtn.addEventListener('click', () => {
        deletePlatform(platform.id);
    });
    
    return div;
}

// Open modal
function openModal(platform = null) {
    if (platform) {
        // Edit mode
        editingPlatformId = platform.id;
        elements.modalTitle.textContent = 'Edit Platform';
        elements.platformName.value = platform.name;
        elements.platformUrl.value = platform.url;
    } else {
        // Add mode
        editingPlatformId = null;
        elements.modalTitle.textContent = 'Add Platform';
        elements.platformName.value = '';
        elements.platformUrl.value = '';
    }
    
    elements.platformModal.classList.add('show');
    elements.platformName.focus();
}

// Close modal
function closeModal() {
    elements.platformModal.classList.remove('show');
    editingPlatformId = null;
}

// Save platform
async function savePlatform() {
    const name = elements.platformName.value.trim();
    const url = elements.platformUrl.value.trim();
    
    // Validation
    if (!name) {
        showStatus('Enter platform name', 'error');
        elements.platformName.focus();
        return;
    }
    
    if (!url) {
        showStatus('Enter search URL', 'error');
        elements.platformUrl.focus();
        return;
    }
    
    if (!url.includes('QUERY')) {
        showStatus('URL must include QUERY placeholder', 'error');
        elements.platformUrl.focus();
        return;
    }
    
    if (!isValidUrl(url)) {
        showStatus('Enter a valid URL', 'error');
        elements.platformUrl.focus();
        return;
    }
    
    if (editingPlatformId) {
        // Update existing
        const index = platforms.findIndex(p => p.id === editingPlatformId);
        if (index !== -1) {
            platforms[index] = { ...platforms[index], name, url };
        }
    } else {
        // Add new
        platforms.push({
            id: Date.now().toString(),
            name,
            url,
            enabled: true
        });
    }
    
    await savePlatforms();
    renderPlatforms();
    closeModal();
    showStatus(`Platform ${editingPlatformId ? 'updated' : 'added'}`);
}

// Delete platform
async function deletePlatform(platformId) {
    if (!confirm('Delete this platform?')) return;
    
    platforms = platforms.filter(p => p.id !== platformId);
    await savePlatforms();
    renderPlatforms();
    showStatus('Platform deleted');
}

// Show status message
function showStatus(message, type = 'success') {
    elements.status.textContent = message;
    elements.status.className = 'status';
    
    if (type === 'error') {
        elements.status.style.background = '#ff6b6b';
    } else {
        elements.status.style.background = '#00a958';
    }
    
    elements.status.classList.add('show');
    
    setTimeout(() => {
        elements.status.classList.remove('show');
    }, 3000);
}

// Helper functions
function isValidUrl(string) {
    try {
        const testUrl = string.replace('QUERY', 'test');
        new URL(testUrl);
        return true;
    } catch {
        return false;
    }
}

function truncateUrl(url, maxLength) {
    return url.length > maxLength ? url.substring(0, maxLength - 3) + '...' : url;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}