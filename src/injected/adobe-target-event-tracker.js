(() => {
    'use strict';

    class AdobeTargetEventTracker {
        constructor() {
            this.isTracking = false;
            this.events = [];
            this.maxEvents = 100;
            this.floatingWindow = null;
            this.originalMethods = new Map();
            this.targetEventListeners = [];

            console.log('[Adobe Target Event Tracker] Initialized');
            this.init();
        }

        init() {
            this.setupMessageListener();
            this.createFloatingWindow();
        }

        setupMessageListener() {
            window.addEventListener('message', (event) => {
                if (event.data?.source !== 'ab-test-adobe-tracker') return;

                switch (event.data.action) {
                    case 'TOGGLE_TRACKING':
                        this.toggleTracking(event.data.enabled);
                        break;
                    case 'CLEAR_EVENTS':
                        this.clearEvents();
                        break;
                }
            });
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
        }

        startTracking() {
            console.log('[Adobe Target Event Tracker] Starting event tracking...');

            if (!window.adobe?.target && !window.AT) {
                console.warn('[Adobe Target Event Tracker] Adobe Target not found on page');
                this.addEvent({
                    type: 'error',
                    category: 'System',
                    name: 'Adobe Target Not Found',
                    details: { message: 'Adobe Target SDK not detected on this page' }
                });
                return;
            }

            // Intercept Adobe Target methods
            this.interceptAdobeTargetMethods();

            // Track initial state
            this.trackInitialState();

            // Listen to Adobe Target events
            this.setupAdobeTargetListeners();
        }

        stopTracking() {
            console.log('[Adobe Target Event Tracker] Stopping event tracking...');

            // Restore original methods
            this.restoreAdobeTargetMethods();

            // Remove event listeners
            this.targetEventListeners.forEach(listener => {
                document.removeEventListener(listener.event, listener.handler);
            });
            this.targetEventListeners = [];
        }

        interceptAdobeTargetMethods() {
            const targetObj = window.adobe?.target || window.AT;
            if (!targetObj) return;

            // Intercept getOffer
            if (targetObj.getOffer && !this.originalMethods.has('getOffer')) {
                this.originalMethods.set('getOffer', targetObj.getOffer);
                const tracker = this;

                targetObj.getOffer = function(options) {
                    tracker.trackTargetMethod('getOffer', options);
                    return tracker.originalMethods.get('getOffer').apply(this, arguments);
                };
            }

            // Intercept getOffers (at.js 2.x)
            if (targetObj.getOffers && !this.originalMethods.has('getOffers')) {
                this.originalMethods.set('getOffers', targetObj.getOffers);
                const tracker = this;

                targetObj.getOffers = function(options) {
                    tracker.trackTargetMethod('getOffers', options);
                    return tracker.originalMethods.get('getOffers').apply(this, arguments);
                };
            }

            // Intercept applyOffer
            if (targetObj.applyOffer && !this.originalMethods.has('applyOffer')) {
                this.originalMethods.set('applyOffer', targetObj.applyOffer);
                const tracker = this;

                targetObj.applyOffer = function(options) {
                    tracker.trackTargetMethod('applyOffer', options);
                    return tracker.originalMethods.get('applyOffer').apply(this, arguments);
                };
            }

            // Intercept applyOffers (at.js 2.x)
            if (targetObj.applyOffers && !this.originalMethods.has('applyOffers')) {
                this.originalMethods.set('applyOffers', targetObj.applyOffers);
                const tracker = this;

                targetObj.applyOffers = function(options) {
                    tracker.trackTargetMethod('applyOffers', options);
                    return tracker.originalMethods.get('applyOffers').apply(this, arguments);
                };
            }

            // Intercept trackEvent
            if (targetObj.trackEvent && !this.originalMethods.has('trackEvent')) {
                this.originalMethods.set('trackEvent', targetObj.trackEvent);
                const tracker = this;

                targetObj.trackEvent = function(options) {
                    tracker.trackTargetMethod('trackEvent', options);
                    return tracker.originalMethods.get('trackEvent').apply(this, arguments);
                };
            }

            // Intercept sendNotifications (at.js 2.x)
            if (targetObj.sendNotifications && !this.originalMethods.has('sendNotifications')) {
                this.originalMethods.set('sendNotifications', targetObj.sendNotifications);
                const tracker = this;

                targetObj.sendNotifications = function(options) {
                    tracker.trackTargetMethod('sendNotifications', options);
                    return tracker.originalMethods.get('sendNotifications').apply(this, arguments);
                };
            }
        }

        restoreAdobeTargetMethods() {
            const targetObj = window.adobe?.target || window.AT;
            if (!targetObj) return;

            this.originalMethods.forEach((original, method) => {
                targetObj[method] = original;
            });
            this.originalMethods.clear();
        }

        trackTargetMethod(method, options) {
            const eventData = {
                timestamp: new Date().toLocaleTimeString(),
                category: 'API Call',
                type: method,
                name: `adobe.target.${method}`,
                details: {}
            };

            switch (method) {
                case 'getOffer':
                case 'getOffers':
                    eventData.details = {
                        mbox: options.mbox,
                        params: options.params || {},
                        timeout: options.timeout,
                        success: 'function',
                        error: 'function'
                    };
                    break;

                case 'applyOffer':
                case 'applyOffers':
                    eventData.details = {
                        selector: options.selector,
                        offer: options.offer ? '[offer data]' : undefined,
                        responseTokens: options.responseTokens
                    };
                    break;

                case 'trackEvent':
                    eventData.details = {
                        mbox: options.mbox,
                        params: options.params || {},
                        type: options.type || 'mbox'
                    };
                    break;

                case 'sendNotifications':
                    eventData.details = {
                        request: options.request,
                        notifications: options.notifications?.length || 0
                    };
                    break;

                default:
                    eventData.details = this.sanitizeObject(options);
            }

            this.addEvent(eventData);
        }

        setupAdobeTargetListeners() {
            // Listen for Adobe Target custom events
            const events = [
                'at-request-start',
                'at-request-succeeded',
                'at-request-failed',
                'at-content-rendering-start',
                'at-content-rendering-succeeded',
                'at-content-rendering-failed',
                'at-library-loaded',
                'at-content-rendering-no-offers',
                'at-content-rendering-redirect'
            ];

            events.forEach(eventName => {
                const handler = (event) => {
                    this.trackTargetEvent(eventName, event.detail);
                };

                document.addEventListener(eventName, handler);
                this.targetEventListeners.push({ event: eventName, handler });
            });

            // Monitor Adobe Launch if present
            if (window._satellite) {
                this.monitorAdobeLaunch();
            }
        }

        monitorAdobeLaunch() {
            // Intercept _satellite.track
            if (window._satellite && window._satellite.track) {
                const originalTrack = window._satellite.track;
                const tracker = this;

                window._satellite.track = function(event, data) {
                    if (data && (data.mbox || data.target)) {
                        tracker.addEvent({
                            timestamp: new Date().toLocaleTimeString(),
                            type: 'launch',
                            category: 'Adobe Launch',
                            name: `_satellite.track: ${event}`,
                            details: {
                                event,
                                data: tracker.sanitizeObject(data)
                            }
                        });
                    }
                    return originalTrack.apply(this, arguments);
                };
            }
        }

        trackTargetEvent(eventName, detail) {
            const eventData = {
                timestamp: new Date().toLocaleTimeString(),
                type: 'event',
                category: 'Target Event',
                name: eventName.replace('at-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                details: {}
            };

            if (detail) {
                eventData.details = this.sanitizeObject(detail);
            }

            this.addEvent(eventData);
        }

        trackInitialState() {
            try {
                const targetObj = window.adobe?.target || window.AT;

                // Track global settings
                if (window.targetGlobalSettings) {
                    this.addEvent({
                        timestamp: new Date().toLocaleTimeString(),
                        type: 'state',
                        category: 'Initial State',
                        name: 'Global Settings',
                        details: this.sanitizeObject(window.targetGlobalSettings)
                    });
                }

                // Track page params
                if (window.targetPageParams || window.targetPageParamsAll) {
                    const pageParams = window.targetPageParams?.() || window.targetPageParamsAll?.() || {};
                    this.addEvent({
                        timestamp: new Date().toLocaleTimeString(),
                        type: 'state',
                        category: 'Initial State',
                        name: 'Page Parameters',
                        details: this.sanitizeObject(pageParams)
                    });
                }

                // Check for active offers
                if (targetObj && targetObj.getOffers) {
                    this.addEvent({
                        timestamp: new Date().toLocaleTimeString(),
                        type: 'state',
                        category: 'Initial State',
                        name: 'Adobe Target Loaded',
                        details: {
                            version: window.adobe?.target?.VERSION || 'Unknown',
                            libraryLoaded: true
                        }
                    });
                }
            } catch (e) {
                console.error('[Adobe Target Event Tracker] Error tracking initial state:', e);
            }
        }

        sanitizeObject(obj, depth = 0, maxDepth = 3) {
            if (depth > maxDepth) return '[Max depth reached]';
            if (obj === null || obj === undefined) return obj;
            if (typeof obj !== 'object') return obj;

            if (Array.isArray(obj)) {
                return obj.map(item => this.sanitizeObject(item, depth + 1, maxDepth));
            }

            const sanitized = {};
            for (const key in obj) {
                try {
                    if (obj.hasOwnProperty(key)) {
                        const value = obj[key];
                        if (typeof value === 'function') {
                            sanitized[key] = '[Function]';
                        } else if (typeof value === 'object' && value !== null) {
                            sanitized[key] = this.sanitizeObject(value, depth + 1, maxDepth);
                        } else {
                            sanitized[key] = value;
                        }
                    }
                } catch (e) {
                    sanitized[key] = '[Error accessing property]';
                }
            }
            return sanitized;
        }

        addEvent(eventData) {
            if (!this.isTracking) return;

            const event = {
                id: Date.now() + Math.random(),
                ...eventData
            };

            this.events.unshift(event);

            if (this.events.length > this.maxEvents) {
                this.events = this.events.slice(0, this.maxEvents);
            }

            this.updateFloatingWindow();
        }

        clearEvents() {
            this.events = [];
            this.updateFloatingWindow();
        }

        createFloatingWindow() {
            if (document.getElementById('adobe-target-event-tracker-window')) {
                this.floatingWindow = document.getElementById('adobe-target-event-tracker-window');
                return;
            }

            const container = document.createElement('div');
            container.id = 'adobe-target-event-tracker-window';
            container.className = 'adobe-event-tracker-window hidden';

            const header = document.createElement('div');
            header.className = 'adobe-event-tracker-header';
            header.innerHTML = `
        <span class="adobe-event-tracker-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 14L6 2L8 8L10 2L14 14M4 10H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Adobe Target Event Tracker
        </span>
        <button class="adobe-event-tracker-close" title="Close">×</button>
      `;

            const content = document.createElement('div');
            content.className = 'adobe-event-tracker-content';

            const eventsList = document.createElement('div');
            eventsList.className = 'adobe-event-tracker-list';
            content.appendChild(eventsList);

            const footer = document.createElement('div');
            footer.className = 'adobe-event-tracker-footer';
            footer.innerHTML = `
        <span class="adobe-event-tracker-count">0 events</span>
        <button class="adobe-event-tracker-clear">Clear All</button>
      `;

            container.appendChild(header);
            container.appendChild(content);
            container.appendChild(footer);

            document.body.appendChild(container);

            this.makeDraggable(container, header);

            header.querySelector('.adobe-event-tracker-close').addEventListener('click', () => {
                this.hideFloatingWindow();
                this.isTracking = false;
                this.stopTracking();
                window.postMessage({
                    source: 'ab-test-detector',
                    action: 'ADOBE_EVENT_TRACKING_STOPPED'
                }, '*');
            });

            footer.querySelector('.adobe-event-tracker-clear').addEventListener('click', () => {
                this.clearEvents();
            });

            this.floatingWindow = container;
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

            const list = this.floatingWindow.querySelector('.adobe-event-tracker-list');
            const count = this.floatingWindow.querySelector('.adobe-event-tracker-count');

            count.textContent = `${this.events.length} event${this.events.length !== 1 ? 's' : ''}`;

            list.innerHTML = this.events.map(event => {
                const categoryClass = event.category.toLowerCase().replace(/\s+/g, '-');
                const typeClass = event.type.toLowerCase().replace(/\s+/g, '-');

                return `
          <div class="adobe-event-item ${categoryClass} ${typeClass}">
            <div class="adobe-event-header">
              <span class="adobe-event-time">${event.timestamp}</span>
              <span class="adobe-event-category ${categoryClass}">${event.category}</span>
            </div>
            <div class="adobe-event-name">${event.name}</div>
            ${this.renderEventDetails(event)}
          </div>
        `;
            }).join('');
        }

        renderEventDetails(event) {
            if (!event.details || Object.keys(event.details).length === 0) {
                return '';
            }

            let detailsHtml = '<div class="adobe-event-details">';

            Object.entries(event.details).forEach(([key, value]) => {
                if (value === undefined || value === null) return;

                let displayValue = value;
                if (typeof value === 'object') {
                    displayValue = JSON.stringify(value, null, 2);
                }

                detailsHtml += `
          <div class="adobe-detail-row">
            <span class="adobe-detail-key">${key}:</span>
            <span class="adobe-detail-value">${displayValue}</span>
          </div>
        `;
            });

            detailsHtml += '</div>';
            return detailsHtml;
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
    }

    // Initialize tracker
    if (!window.__adobeTargetEventTracker) {
        window.__adobeTargetEventTracker = new AdobeTargetEventTracker();

        // Add styles
        if (!document.getElementById('adobe-target-event-tracker-styles')) {
            const style = document.createElement('style');
            style.id = 'adobe-target-event-tracker-styles';
            style.textContent = `
        .adobe-event-tracker-window {
          position: fixed;
          bottom: 20px;
          right: 20px;
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
        
        .adobe-event-tracker-window.hidden {
          opacity: 0;
          transform: translateY(20px);
          pointer-events: none;
        }
        
        .adobe-event-tracker-window.dragging {
          cursor: move;
          opacity: 0.95;
        }
        
        .adobe-event-tracker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: linear-gradient(135deg, #fa0f00 0%, #c4160b 100%);
          color: white;
          border-radius: 12px 12px 0 0;
          cursor: move;
          user-select: none;
        }
        
        .adobe-event-tracker-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 15px;
        }
        
        .adobe-event-tracker-close {
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
        
        .adobe-event-tracker-close:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        .adobe-event-tracker-content {
          flex: 1;
          overflow-y: auto;
          background: #f8f9fa;
        }
        
        .adobe-event-tracker-list {
          padding: 12px;
        }
        
        .adobe-event-item {
          background: white;
          border: 1px solid #e1e4e8;
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 10px;
          transition: all 0.2s ease;
        }
        
        .adobe-event-item:hover {
          transform: translateX(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: #fa0f00;
        }
        
        .adobe-event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .adobe-event-time {
          color: #666;
          font-size: 12px;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
        }
        
        .adobe-event-category {
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .adobe-event-category.api-call {
          background-color: #fee;
          color: #fa0f00;
        }
        
        .adobe-event-category.target-event {
          background-color: #fff0f0;
          color: #c4160b;
        }
        
        .adobe-event-category.initial-state {
          background-color: #e8f5e9;
          color: #388e3c;
        }
        
        .adobe-event-category.adobe-launch {
          background-color: #e3f2fd;
          color: #1976d2;
        }
        
        .adobe-event-category.system {
          background-color: #ffebee;
          color: #c62828;
        }
        
        .adobe-event-name {
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 8px;
          font-size: 14px;
        }
        
        .adobe-event-details {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #f0f0f0;
        }
        
        .adobe-detail-row {
          display: flex;
          align-items: flex-start;
          margin-bottom: 6px;
          font-size: 12px;
        }
        
        .adobe-detail-key {
          color: #666;
          margin-right: 8px;
          min-width: 80px;
          font-weight: 500;
        }
        
        .adobe-detail-value {
          color: #1a1a1a;
          flex: 1;
          word-break: break-word;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
          white-space: pre-wrap;
        }
        
        .adobe-event-item.getoffers .adobe-event-name,
        .adobe-event-item.getoffer .adobe-event-name {
          color: #1976d2;
        }
        
        .adobe-event-item.applyoffer .adobe-event-name,
        .adobe-event-item.applyoffers .adobe-event-name {
          color: #388e3c;
        }
        
        .adobe-event-item.trackevent .adobe-event-name {
          color: #f57c00;
        }
        
        .adobe-event-tracker-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          border-top: 1px solid #e1e4e8;
          background: white;
          border-radius: 0 0 12px 12px;
        }
        
        .adobe-event-tracker-count {
          font-size: 13px;
          color: #666;
          font-weight: 500;
        }
        
        .adobe-event-tracker-clear {
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
        
        .adobe-event-tracker-clear:hover {
          background-color: #c82333;
        }
        
        .adobe-event-tracker-list:empty::after {
          content: "No events captured yet. Interact with the page to see Adobe Target events.";
          display: block;
          text-align: center;
          padding: 40px 20px;
          color: #999;
          font-size: 13px;
          font-style: italic;
        }
      `;
            document.head.appendChild(style);
        }
    }
})();