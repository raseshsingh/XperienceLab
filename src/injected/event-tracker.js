(() => {
    'use strict';

    class OptimizelyEventTracker {
        constructor() {
            this.isTracking = false;
            this.events = [];
            this.maxEvents = 100;
            this.floatingWindow = null;
            this.originalOptimizelyPush = null;
            this.notificationListeners = [];
            this.isIntercepting = false; // Flag to prevent double interception

            console.log('[Optimizely Event Tracker] Initialized');
            this.init();
        }

        init() {
            this.setupMessageListener();
            this.createFloatingWindow();
        }

        setupMessageListener() {
            window.addEventListener('message', (event) => {
                if (event.data?.source !== 'ab-test-event-tracker') return;

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
            console.log('[Optimizely Event Tracker] Starting event tracking...');

            if (!window.optimizely) {
                console.warn('[Optimizely Event Tracker] Optimizely not found on page');
                this.addEvent({
                    type: 'error',
                    category: 'System',
                    name: 'Optimizely Not Found',
                    details: { message: 'Optimizely SDK not detected on this page' }
                });
                return;
            }

            // Intercept optimizely.push() calls
            this.interceptOptimizelyPush();

            // Listen to Optimizely notification center
            this.setupNotificationListeners();

            // Track initial page state
            this.trackInitialState();
        }

        stopTracking() {
            console.log('[Optimizely Event Tracker] Stopping event tracking...');

            // Restore original push method
            this.restoreOptimizelyPush();

            // Remove notification listeners
            this.notificationListeners.forEach(id => {
                try {
                    window.optimizely?.notificationCenter?.removeNotificationListener?.(id);
                } catch (e) {
                    console.error('[Optimizely Event Tracker] Error removing listener:', e);
                }
            });
            this.notificationListeners = [];
        }

        interceptOptimizelyPush() {
            if (!window.optimizely || !window.optimizely.push || this.isIntercepting) {
                return;
            }

            // Store the original push method only if we haven't already
            if (!this.originalOptimizelyPush) {
                this.originalOptimizelyPush = window.optimizely.push;
            }

            // Mark that we're intercepting
            this.isIntercepting = true;

            // Create our interceptor function
            const tracker = this;
            window.optimizely.push = function(...args) {
                // Process each argument for tracking
                args.forEach(command => {
                    if (command && typeof command === 'object') {
                        tracker.trackOptimizelyCommand(command);
                    } else if (typeof command === 'string') {
                        // Handle string commands
                        tracker.trackOptimizelyCommand({ type: 'raw', value: command });
                    }
                });

                // Call the original method with proper context
                return tracker.originalOptimizelyPush.apply(window.optimizely, args);
            };

            console.log('[Optimizely Event Tracker] Push method intercepted');
        }

        restoreOptimizelyPush() {
            if (this.originalOptimizelyPush && window.optimizely && this.isIntercepting) {
                window.optimizely.push = this.originalOptimizelyPush;
                this.isIntercepting = false;
                console.log('[Optimizely Event Tracker] Push method restored');
            }
        }

        trackOptimizelyCommand(command) {
            const eventData = {
                timestamp: new Date().toLocaleTimeString(),
                category: 'API Call',
                raw: command
            };

            // Handle string commands
            if (command.type === 'raw') {
                eventData.type = 'raw';
                eventData.name = 'Raw Command';
                eventData.details = { command: command.value };
                this.addEvent(eventData);
                return;
            }

            switch (command.type) {
                case 'page':
                    eventData.type = 'page';
                    eventData.name = 'Page Activation';
                    eventData.details = {
                        pageName: command.pageName || 'unnamed',
                        tags: command.tags || {}
                    };
                    break;

                case 'event':
                    eventData.type = 'event';
                    eventData.name = command.eventName || 'Custom Event';
                    eventData.details = {
                        eventName: command.eventName,
                        tags: command.tags || {},
                        revenue: command.revenue,
                        value: command.value
                    };
                    break;

                case 'addListener':
                    eventData.type = 'listener';
                    eventData.name = 'Add Listener';
                    eventData.details = {
                        filter: command.filter,
                        handler: 'function'
                    };
                    break;

                case 'bucketVisitor':
                    eventData.type = 'bucket';
                    eventData.name = 'Force Bucket';
                    eventData.details = {
                        experimentId: command.experimentId,
                        variationId: command.variationId
                    };
                    break;

                case 'activate':
                case 'activatePage':
                    eventData.type = 'activate';
                    eventData.name = 'Activate Experiments';
                    eventData.details = {
                        pageId: command.pageId
                    };
                    break;

                case 'sendEvents':
                    eventData.type = 'send';
                    eventData.name = 'Send Events';
                    eventData.details = {};
                    break;

                case 'disable':
                    eventData.type = 'disable';
                    eventData.name = 'Disable Optimizely';
                    eventData.details = {
                        scope: command.scope || 'all'
                    };
                    break;

                default:
                    eventData.type = command.type || 'unknown';
                    eventData.name = `Unknown Command: ${command.type || 'undefined'}`;
                    eventData.details = command;
            }

            this.addEvent(eventData);
        }

        setupNotificationListeners() {
            const notificationCenter = window.optimizely?.notificationCenter;
            if (!notificationCenter || !notificationCenter.addNotificationListener) {
                console.log('[Optimizely Event Tracker] Notification center not available');
                return;
            }

            // Listen for various Optimizely events
            const eventTypes = [
                'OPTIMIZELY:ACTIVATED',
                'OPTIMIZELY:DECISION',
                'OPTIMIZELY:EVENT',
                'OPTIMIZELY:LOG',
                'OPTIMIZELY:CONFIG_UPDATE',
                'OPTIMIZELY:TRACK'
            ];

            eventTypes.forEach(eventType => {
                try {
                    const listenerId = notificationCenter.addNotificationListener(
                        eventType,
                        (notification) => {
                            this.trackNotificationEvent(eventType, notification);
                        }
                    );

                    if (listenerId) {
                        this.notificationListeners.push(listenerId);
                    }
                } catch (e) {
                    console.log(`[Optimizely Event Tracker] Could not listen to ${eventType}:`, e.message);
                }
            });
        }

        trackNotificationEvent(eventType, notification) {
            const eventData = {
                timestamp: new Date().toLocaleTimeString(),
                type: 'notification',
                category: 'Notification',
                name: this.formatEventType(eventType),
                details: {}
            };

            try {
                switch (eventType) {
                    case 'OPTIMIZELY:ACTIVATED':
                        eventData.details = {
                            experiment: notification.experiment,
                            variation: notification.variation,
                            userId: notification.userId
                        };
                        break;

                    case 'OPTIMIZELY:DECISION':
                        eventData.details = {
                            type: notification.type,
                            userId: notification.userId,
                            attributes: notification.attributes,
                            decisionInfo: notification.decisionInfo
                        };
                        break;

                    case 'OPTIMIZELY:EVENT':
                        eventData.details = {
                            eventKey: notification.eventKey,
                            userId: notification.userId,
                            attributes: notification.attributes,
                            eventTags: notification.eventTags,
                            logEvent: notification.logEvent
                        };
                        break;

                    case 'OPTIMIZELY:TRACK':
                        eventData.details = {
                            eventKey: notification.eventKey,
                            userId: notification.userId,
                            revenue: notification.revenue,
                            value: notification.value,
                            eventTags: notification.eventTags
                        };
                        break;

                    default:
                        eventData.details = this.sanitizeObject(notification);
                }
            } catch (e) {
                eventData.details = { error: 'Failed to process notification data' };
            }

            this.addEvent(eventData);
        }

        // Sanitize objects to prevent circular references
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

        trackInitialState() {
            try {
                const state = window.optimizely.get('state');
                const data = window.optimizely.get('data');

                if (state && data) {
                    // Track active experiments
                    const activeExperiments = state.getActiveExperimentIds() || [];
                    const variationMap = state.getVariationMap() || {};

                    activeExperiments.forEach(expId => {
                        const experiment = data.experiments?.[expId];
                        if (experiment) {
                            this.addEvent({
                                timestamp: new Date().toLocaleTimeString(),
                                type: 'state',
                                category: 'Initial State',
                                name: 'Active Experiment',
                                details: {
                                    experimentId: expId,
                                    experimentName: experiment.name,
                                    variationId: variationMap[expId],
                                    status: 'active'
                                }
                            });
                        }
                    });

                    // Track active pages
                    const activePages = state.getActivePageIds?.() || [];
                    activePages.forEach(pageId => {
                        const page = data.pages?.[pageId];
                        if (page) {
                            this.addEvent({
                                timestamp: new Date().toLocaleTimeString(),
                                type: 'state',
                                category: 'Initial State',
                                name: 'Active Page',
                                details: {
                                    pageId: pageId,
                                    pageName: page.name || pageId,
                                    url: page.conditions?.length > 0 ? page.conditions[0].value : 'unknown'
                                }
                            });
                        }
                    });
                }
            } catch (e) {
                console.error('[Optimizely Event Tracker] Error tracking initial state:', e);
            }
        }

        formatEventType(eventType) {
            return eventType
                .replace('OPTIMIZELY:', '')
                .replace(/_/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }

        addEvent(eventData) {
            if (!this.isTracking) return;

            const event = {
                id: Date.now() + Math.random(),
                ...eventData
            };

            this.events.unshift(event);

            // Keep only the latest events
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
            // Check if window already exists
            if (document.getElementById('optimizely-event-tracker-window')) {
                this.floatingWindow = document.getElementById('optimizely-event-tracker-window');
                return;
            }

            // Create container
            const container = document.createElement('div');
            container.id = 'optimizely-event-tracker-window';
            container.className = 'opt-event-tracker-window hidden';

            // Create header
            const header = document.createElement('div');
            header.className = 'opt-event-tracker-header';
            header.innerHTML = `
        <span class="opt-event-tracker-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v5l3 3M14 8A6 6 0 11 2 8a6 6 0 0112 0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Optimizely Event Tracker
        </span>
        <button class="opt-event-tracker-close" title="Close">×</button>
      `;

            // Create content area
            const content = document.createElement('div');
            content.className = 'opt-event-tracker-content';

            // Create events list
            const eventsList = document.createElement('div');
            eventsList.className = 'opt-event-tracker-list';
            content.appendChild(eventsList);

            // Create footer
            const footer = document.createElement('div');
            footer.className = 'opt-event-tracker-footer';
            footer.innerHTML = `
        <span class="opt-event-tracker-count">0 events</span>
        <button class="opt-event-tracker-clear">Clear All</button>
      `;

            // Assemble window
            container.appendChild(header);
            container.appendChild(content);
            container.appendChild(footer);

            // Add to page
            document.body.appendChild(container);

            // Make draggable
            this.makeDraggable(container, header);

            // Add event listeners
            header.querySelector('.opt-event-tracker-close').addEventListener('click', () => {
                this.hideFloatingWindow();
                this.isTracking = false;
                this.stopTracking();
                window.postMessage({
                    source: 'ab-test-detector',
                    action: 'EVENT_TRACKING_STOPPED'
                }, '*');
            });

            footer.querySelector('.opt-event-tracker-clear').addEventListener('click', () => {
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

                // Keep within viewport
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

            const list = this.floatingWindow.querySelector('.opt-event-tracker-list');
            const count = this.floatingWindow.querySelector('.opt-event-tracker-count');

            // Update count
            count.textContent = `${this.events.length} event${this.events.length !== 1 ? 's' : ''}`;

            // Update list
            list.innerHTML = this.events.map(event => {
                const categoryClass = event.category.toLowerCase().replace(/\s+/g, '-');
                const typeClass = event.type.toLowerCase().replace(/\s+/g, '-');

                return `
          <div class="opt-event-item ${categoryClass} ${typeClass}">
            <div class="opt-event-header">
              <span class="opt-event-time">${event.timestamp}</span>
              <span class="opt-event-category ${categoryClass}">${event.category}</span>
            </div>
            <div class="opt-event-name">${event.name}</div>
            ${this.renderEventDetails(event)}
          </div>
        `;
            }).join('');
        }

        renderEventDetails(event) {
            if (!event.details || Object.keys(event.details).length === 0) {
                return '';
            }

            let detailsHtml = '<div class="opt-event-details">';

            Object.entries(event.details).forEach(([key, value]) => {
                if (value === undefined || value === null) return;

                if (key === 'tags' || key === 'eventTags' || key === 'attributes') {
                    if (value && typeof value === 'object' && Object.keys(value).length > 0) {
                        detailsHtml += `
              <div class="opt-detail-row">
                <span class="opt-detail-key">${key}:</span>
                <span class="opt-detail-value">${JSON.stringify(value)}</span>
              </div>
            `;
                    }
                } else if (typeof value === 'object') {
                    detailsHtml += `
            <div class="opt-detail-row">
              <span class="opt-detail-key">${key}:</span>
              <span class="opt-detail-value">${JSON.stringify(value, null, 2)}</span>
            </div>
          `;
                } else {
                    detailsHtml += `
            <div class="opt-detail-row">
              <span class="opt-detail-key">${key}:</span>
              <span class="opt-detail-value">${value}</span>
            </div>
          `;
                }
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

    // Initialize event tracker
    if (!window.__optimizelyEventTracker) {
        window.__optimizelyEventTracker = new OptimizelyEventTracker();

        // Add styles (same as before)
        if (!document.getElementById('optimizely-event-tracker-styles')) {
            const style = document.createElement('style');
            style.id = 'optimizely-event-tracker-styles';
            style.textContent = `
        .opt-event-tracker-window {
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
        
        .opt-event-tracker-window.hidden {
          opacity: 0;
          transform: translateY(20px);
          pointer-events: none;
        }
        
        .opt-event-tracker-window.dragging {
          cursor: move;
          opacity: 0.95;
        }
        
        .opt-event-tracker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%);
          color: white;
          border-radius: 12px 12px 0 0;
          cursor: move;
          user-select: none;
        }
        
        .opt-event-tracker-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 15px;
        }
        
        .opt-event-tracker-close {
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
        
        .opt-event-tracker-close:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        .opt-event-tracker-content {
          flex: 1;
          overflow-y: auto;
          background: #f8f9fa;
        }
        
        .opt-event-tracker-list {
          padding: 12px;
        }
        
        .opt-event-item {
          background: white;
          border: 1px solid #e1e4e8;
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 10px;
          transition: all 0.2s ease;
        }
        
        .opt-event-item:hover {
          transform: translateX(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: #0078d4;
        }
        
        .opt-event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .opt-event-time {
          color: #666;
          font-size: 12px;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
        }
        
        .opt-event-category {
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .opt-event-category.api-call {
          background-color: #e3f2fd;
          color: #1976d2;
        }
        
        .opt-event-category.notification {
          background-color: #f3e5f5;
          color: #7b1fa2;
        }
        
        .opt-event-category.initial-state {
          background-color: #e8f5e9;
          color: #388e3c;
        }
        
        .opt-event-category.system {
          background-color: #ffebee;
          color: #c62828;
        }
        
        .opt-event-name {
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 8px;
          font-size: 14px;
        }
        
        .opt-event-details {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #f0f0f0;
        }
        
        .opt-detail-row {
          display: flex;
          align-items: flex-start;
          margin-bottom: 6px;
          font-size: 12px;
        }
        
        .opt-detail-key {
          color: #666;
          margin-right: 8px;
          min-width: 80px;
          font-weight: 500;
        }
        
        .opt-detail-value {
          color: #1a1a1a;
          flex: 1;
          word-break: break-word;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
          white-space: pre-wrap;
        }
        
        /* Event type specific colors */
        .opt-event-item.page .opt-event-name {
          color: #1976d2;
        }
        
        .opt-event-item.event .opt-event-name {
          color: #388e3c;
        }
        
        .opt-event-item.bucket .opt-event-name {
          color: #f57c00;
        }
        
        .opt-event-item.activate .opt-event-name {
          color: #7b1fa2;
        }
        
        .opt-event-tracker-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          border-top: 1px solid #e1e4e8;
          background: white;
          border-radius: 0 0 12px 12px;
        }
        
        .opt-event-tracker-count {
          font-size: 13px;
          color: #666;
          font-weight: 500;
        }
        
        .opt-event-tracker-clear {
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
        
        .opt-event-tracker-clear:hover {
          background-color: #c82333;
        }
        
        /* Empty state */
        .opt-event-tracker-list:empty::after {
          content: "No events captured yet. Interact with the page to see Optimizely events.";
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