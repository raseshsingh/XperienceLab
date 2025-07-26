(() => {
    'use strict';

    class BaseEventTracker {
        constructor(platform, config) {
            this.platform = platform;
            this.platformName = config.platformName;
            this.sourceId = config.sourceId;
            this.headerColor = config.headerColor;
            this.icon = config.icon;

            this.isTracking = false;
            this.events = [];
            this.maxEvents = 100;
            this.floatingWindow = null;
            this.capturedEvents = [];
            this.windowId = `${platform}-event-tracker-window`;
            this.storageKey = `__${platform}EventTrackerState`;

            console.log(`[${this.platformName} Event Tracker] Initializing...`);

            // Load persisted state
            this.loadPersistedState();

            // Check for auto-start
            this.checkAutoStart();

            // Initialize
            this.init();
        }

        async checkAutoStart() {
            try {
                // Check if auto-open is enabled in preferences
                const prefs = await this.getPreferences();
                const autoOpenEnabled = prefs?.autoOpenEventTracker || false;

                console.log(`[${this.platformName} Event Tracker] Auto-open enabled:`, autoOpenEnabled);

                if (autoOpenEnabled) {
                    // Wait a bit for platform detection
                    setTimeout(() => {
                        // Check if the current platform matches
                        if (this.isPlatformActive()) {
                            console.log(`[${this.platformName} Event Tracker] Auto-starting tracker`);
                            this.startCapturing();
                            this.showFloatingWindow();
                        }
                    }, 1000);
                }
            } catch (error) {
                console.error(`[${this.platformName} Event Tracker] Error checking auto-start:`, error);
            }
        }

        async getPreferences() {
            return new Promise((resolve) => {
                // Try to get preferences from storage
                const checkStorage = () => {
                    const stored = localStorage.getItem('__abTestDebuggerPrefs');
                    if (stored) {
                        try {
                            return resolve(JSON.parse(stored));
                        } catch (e) {
                            // Invalid JSON
                        }
                    }
                    return null;
                };

                // First try localStorage
                const prefs = checkStorage();
                if (prefs) return;

                // Listen for preferences from content script
                const listener = (event) => {
                    if (event.data?.source === 'ab-test-preferences') {
                        window.removeEventListener('message', listener);
                        localStorage.setItem('__abTestDebuggerPrefs', JSON.stringify(event.data.preferences));
                        resolve(event.data.preferences);
                    }
                };

                window.addEventListener('message', listener);

                // Request preferences
                window.postMessage({
                    source: 'ab-test-request-preferences',
                    platform: this.platform
                }, '*');

                // Timeout after 2 seconds
                setTimeout(() => {
                    window.removeEventListener('message', listener);
                    resolve({});
                }, 2000);
            });
        }

        isPlatformActive() {
            // Override in subclasses
            return false;
        }

        loadPersistedState() {
            try {
                const saved = sessionStorage.getItem(this.storageKey);
                if (saved) {
                    const state = JSON.parse(saved);
                    this.events = state.events || [];
                    this.isTracking = state.isTracking || false;
                    console.log(`[${this.platformName} Event Tracker] Loaded ${this.events.length} persisted events`);
                }
            } catch (error) {
                console.error(`[${this.platformName} Event Tracker] Error loading persisted state:`, error);
            }
        }

        saveState() {
            try {
                const state = {
                    events: this.events.slice(0, this.maxEvents),
                    isTracking: this.isTracking,
                    timestamp: Date.now()
                };
                sessionStorage.setItem(this.storageKey, JSON.stringify(state));
            } catch (error) {
                console.error(`[${this.platformName} Event Tracker] Error saving state:`, error);
            }
        }

        init() {
            this.setupMessageListener();

            // Check if window already exists
            const existingWindow = document.getElementById(this.windowId);
            if (existingWindow) {
                console.log(`[${this.platformName} Event Tracker] Found existing window, reusing it`);
                this.floatingWindow = existingWindow;

                // Re-attach event listeners
                this.attachWindowListeners();

                // Update the window with persisted events
                if (this.events.length > 0) {
                    this.updateFloatingWindow();
                }

                // If tracking was active, show the window
                if (this.isTracking) {
                    this.showFloatingWindow();
                }
            } else {
                this.createFloatingWindow();
            }
        }

        setupMessageListener() {
            window.addEventListener('message', (event) => {
                if (event.data?.source !== this.sourceId) return;

                console.log(`[${this.platformName} Event Tracker] Received message:`, event.data);

                switch (event.data.action) {
                    case 'TOGGLE_TRACKING':
                        // Check if already in the desired state
                        if (event.data.enabled === this.isTracking && this.floatingWindow && !this.floatingWindow.classList.contains('hidden')) {
                            console.log(`[${this.platformName} Event Tracker] Already in desired state, skipping toggle`);
                            return;
                        }
                        this.toggleTracking(event.data.enabled);
                        break;

                    case 'CLEAR_EVENTS':
                        this.clearEvents();
                        break;

                    case 'GET_STATE':
                        this.sendState();
                        break;
                }
            });
        }

        sendState() {
            window.postMessage({
                source: 'ab-test-tracker-state',
                platform: this.platform,
                isTracking: this.isTracking,
                eventCount: this.events.length
            }, '*');
        }

        startCapturing() {
            this.isTracking = true;
            this.startPlatformTracking();
            this.saveState();
        }

        toggleTracking(enabled) {
            this.isTracking = enabled;

            if (enabled) {
                this.startTracking();
                this.showFloatingWindow();
            } else {
                this.stopTracking();
                this.hideFloatingWindow();
            }

            this.saveState();
        }

        startTracking() {
            console.log(`[${this.platformName} Event Tracker] Starting event tracking...`);
            this.startPlatformTracking();
        }

        stopTracking() {
            console.log(`[${this.platformName} Event Tracker] Stopping event tracking...`);
            this.stopPlatformTracking();
        }

        // Override these in subclasses
        startPlatformTracking() {}
        stopPlatformTracking() {}

        addEvent(eventData) {
            if (!this.isTracking) return;

            const event = {
                id: Date.now() + Math.random(),
                timestamp: new Date().toLocaleTimeString(),
                ...eventData
            };

            this.events.unshift(event);

            if (this.events.length > this.maxEvents) {
                this.events = this.events.slice(0, this.maxEvents);
            }

            this.updateFloatingWindow();
            this.saveState();
        }

        clearEvents() {
            this.events = [];
            this.updateFloatingWindow();
            this.saveState();
        }

        createFloatingWindow() {
            const container = document.createElement('div');
            container.id = this.windowId;
            container.className = `event-tracker-window hidden`;
            container.dataset.platform = this.platform;

            const header = document.createElement('div');
            header.className = 'event-tracker-header';
            header.style.background = this.headerColor;
            header.innerHTML = `
        <span class="event-tracker-title">
          ${this.icon}
          ${this.platformName} Event Tracker
        </span>
        <button class="event-tracker-close" title="Close">×</button>
      `;

            const content = document.createElement('div');
            content.className = 'event-tracker-content';

            const eventsList = document.createElement('div');
            eventsList.className = 'event-tracker-list';
            content.appendChild(eventsList);

            const footer = document.createElement('div');
            footer.className = 'event-tracker-footer';
            footer.innerHTML = `
        <span class="event-tracker-count">0 events</span>
        <button class="event-tracker-clear">Clear All</button>
      `;

            container.appendChild(header);
            container.appendChild(content);
            container.appendChild(footer);

            document.body.appendChild(container);

            this.floatingWindow = container;
            this.makeDraggable(container, header);
            this.attachWindowListeners();

            // Add base styles if not already added
            this.addBaseStyles();
        }

        attachWindowListeners() {
            const header = this.floatingWindow.querySelector('.event-tracker-header');
            const footer = this.floatingWindow.querySelector('.event-tracker-footer');

            header.querySelector('.event-tracker-close').onclick = () => {
                this.hideFloatingWindow();
                this.isTracking = false;
                this.stopTracking();
                this.saveState();

                window.postMessage({
                    source: 'ab-test-detector',
                    action: `${this.platform.toUpperCase()}_EVENT_TRACKING_STOPPED`
                }, '*');
            };

            footer.querySelector('.event-tracker-clear').onclick = () => {
                this.clearEvents();
            };
        }

        makeDraggable(element, handle) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

            handle.onmousedown = dragMouseDown;

            function dragMouseDown(e) {
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
                element.classList.add('dragging');
            }

            function elementDrag(e) {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;

                const newTop = element.offsetTop - pos2;
                const newLeft = element.offsetLeft - pos1;

                const maxX = window.innerWidth - element.offsetWidth;
                const maxY = window.innerHeight - element.offsetHeight;

                element.style.top = Math.min(Math.max(0, newTop), maxY) + "px";
                element.style.left = Math.min(Math.max(0, newLeft), maxX) + "px";
            }

            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
                element.classList.remove('dragging');
            }
        }

        updateFloatingWindow() {
            if (!this.floatingWindow) return;

            const list = this.floatingWindow.querySelector('.event-tracker-list');
            const count = this.floatingWindow.querySelector('.event-tracker-count');

            count.textContent = `${this.events.length} event${this.events.length !== 1 ? 's' : ''}`;

            list.innerHTML = this.events.map(event => this.renderEvent(event)).join('');
        }

        renderEvent(event) {
            // Override in subclasses for custom rendering
            return `
        <div class="event-item">
          <div class="event-header">
            <span class="event-time">${event.timestamp}</span>
            <span class="event-category">${event.category || 'Event'}</span>
          </div>
          <div class="event-name">${event.name || 'Unknown Event'}</div>
        </div>
      `;
        }

        showFloatingWindow() {
            if (this.floatingWindow) {
                this.floatingWindow.classList.remove('hidden');
            }
        }

        hideFloatingWindow() {
            if (this.floatingWindow) {
                this.floatingWindow.classList.add('hidden');
            }
        }

        addBaseStyles() {
            if (document.getElementById('event-tracker-base-styles')) return;

            const style = document.createElement('style');
            style.id = 'event-tracker-base-styles';
            style.textContent = `
        .event-tracker-window {
          position: fixed;
          bottom: 20px;
          width: 420px;
          max-height: 600px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          z-index: 999999;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        
        .event-tracker-window[data-platform="optimizely"] { right: 20px; }
        .event-tracker-window[data-platform="vwo"] { left: 20px; }
        .event-tracker-window[data-platform="adobe"] { right: 20px; bottom: 80px; }
        
        .event-tracker-window.hidden {
          opacity: 0;
          transform: translateY(20px);
          pointer-events: none;
        }
        
        .event-tracker-window.dragging {
          cursor: move;
          opacity: 0.95;
        }
        
        .event-tracker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          color: white;
          border-radius: 12px 12px 0 0;
          cursor: move;
          user-select: none;
        }
        
        .event-tracker-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 15px;
        }
        
        .event-tracker-close {
          background: none;
          border: none;
          color: white;
          font-size: 28px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: background-color 0.2s ease;
          line-height: 1;
        }
        
        .event-tracker-close:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        .event-tracker-content {
          flex: 1;
          overflow-y: auto;
          background: #f8f9fa;
        }
        
        .event-tracker-list {
          padding: 12px;
        }
        
        .event-item {
          background: white;
          border: 1px solid #e1e4e8;
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 10px;
          transition: all 0.2s ease;
        }
        
        .event-tracker-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          border-top: 1px solid #e1e4e8;
          background: white;
          border-radius: 0 0 12px 12px;
        }
        
        .event-tracker-count {
          font-size: 13px;
          color: #666;
          font-weight: 500;
        }
        
        .event-tracker-clear {
          padding: 8px 16px;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .event-tracker-clear:hover {
          background-color: #c82333;
        }
      `;
            document.head.appendChild(style);
        }
    }

    // Export to global scope
    window.BaseEventTracker = BaseEventTracker;
})();