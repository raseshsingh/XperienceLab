(() => {
    'use strict';

    class VWOEventTracker {
        constructor() {
            this.isTracking = false;
            this.events = [];
            this.maxEvents = 100;
            this.floatingWindow = null;
            this.originalVWOPush = null;
            this.originalVWOTrack = null;
            this.interceptedMethods = new Map();

            console.log('[VWO Event Tracker] Initialized');
            this.init();
        }

        init() {
            this.setupMessageListener();
            this.createFloatingWindow();
        }

        setupMessageListener() {
            window.addEventListener('message', (event) => {
                if (event.data?.source !== 'ab-test-vwo-tracker') return;

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
            console.log('[VWO Event Tracker] Starting event tracking...');

            if (!window.VWO && !window._vwo_exp) {
                console.warn('[VWO Event Tracker] VWO not found on page');
                this.addEvent({
                    type: 'error',
                    category: 'System',
                    name: 'VWO Not Found',
                    details: { message: 'VWO SDK not detected on this page' }
                });
                return;
            }

            // Intercept VWO methods
            this.interceptVWOMethods();

            // Track initial state
            this.trackInitialState();

            // Listen to VWO events
            this.setupVWOListeners();
        }

        stopTracking() {
            console.log('[VWO Event Tracker] Stopping event tracking...');

            // Restore original methods
            this.restoreVWOMethods();
        }

        interceptVWOMethods() {
            // Intercept VWO.push() for async tracking
            if (window.VWO && window.VWO.push && !this.originalVWOPush) {
                this.originalVWOPush = window.VWO.push;
                const tracker = this;

                window.VWO.push = function(...args) {
                    args.forEach(command => {
                        if (Array.isArray(command)) {
                            tracker.trackVWOCommand(command);
                        }
                    });

                    return tracker.originalVWOPush.apply(window.VWO, args);
                };
            }

            // Intercept track event
            if (window.VWO && window.VWO.track && !this.originalVWOTrack) {
                this.originalVWOTrack = window.VWO.track;
                const tracker = this;

                window.VWO.track = function(eventName, properties) {
                    tracker.trackVWOEvent('track', {
                        eventName,
                        properties
                    });

                    return tracker.originalVWOTrack.apply(window.VWO, arguments);
                };
            }

            // Intercept other VWO methods
            const methodsToIntercept = [
                'goal', 'revenue', 'setCustomVariable', 'activate', 'variationShown'
            ];

            methodsToIntercept.forEach(method => {
                if (window.VWO && window.VWO[method] && !this.interceptedMethods.has(method)) {
                    const original = window.VWO[method];
                    this.interceptedMethods.set(method, original);

                    const tracker = this;
                    window.VWO[method] = function(...args) {
                        tracker.trackVWOEvent(method, args);
                        return original.apply(window.VWO, args);
                    };
                }
            });
        }

        restoreVWOMethods() {
            if (this.originalVWOPush && window.VWO) {
                window.VWO.push = this.originalVWOPush;
                this.originalVWOPush = null;
            }

            if (this.originalVWOTrack && window.VWO) {
                window.VWO.track = this.originalVWOTrack;
                this.originalVWOTrack = null;
            }

            // Restore other methods
            this.interceptedMethods.forEach((original, method) => {
                if (window.VWO) {
                    window.VWO[method] = original;
                }
            });
            this.interceptedMethods.clear();
        }

        trackVWOCommand(command) {
            const eventData = {
                timestamp: new Date().toLocaleTimeString(),
                category: 'API Call',
                type: 'command'
            };

            if (Array.isArray(command) && command.length > 0) {
                const [action, ...params] = command;

                eventData.name = `VWO.${action}`;
                eventData.details = {
                    action,
                    parameters: params
                };

                switch (action) {
                    case 'track':
                        eventData.type = 'track';
                        eventData.details.eventName = params[0];
                        eventData.details.properties = params[1] || {};
                        break;

                    case 'trigger':
                        eventData.type = 'trigger';
                        eventData.details.goalId = params[0];
                        break;

                    case 'setCustomVariable':
                        eventData.type = 'custom-var';
                        eventData.details.name = params[0];
                        eventData.details.value = params[1];
                        break;
                }
            }

            this.addEvent(eventData);
        }

        trackVWOEvent(method, args) {
            const eventData = {
                timestamp: new Date().toLocaleTimeString(),
                category: 'API Call',
                type: method,
                name: `VWO.${method}`,
                details: {}
            };

            switch (method) {
                case 'track':
                    eventData.details = {
                        eventName: args.eventName,
                        properties: args.properties || {}
                    };
                    break;

                case 'goal':
                    eventData.details = {
                        goalId: args[0],
                        value: args[1]
                    };
                    break;

                case 'revenue':
                    eventData.details = {
                        revenue: args[0]
                    };
                    break;

                case 'setCustomVariable':
                    eventData.details = {
                        name: args[0],
                        value: args[1]
                    };
                    break;

                case 'activate':
                    eventData.details = {
                        campaignId: args[0]
                    };
                    break;

                case 'variationShown':
                    eventData.details = {
                        campaignId: args[0],
                        variationId: args[1]
                    };
                    break;

                default:
                    eventData.details = { arguments: args };
            }

            this.addEvent(eventData);
        }

        setupVWOListeners() {
            // Listen for VWO events through dataLayer
            if (window.dataLayer && Array.isArray(window.dataLayer)) {
                const originalPush = window.dataLayer.push.bind(window.dataLayer);
                const tracker = this;

                window.dataLayer.push = function(...args) {
                    args.forEach(arg => {
                        if (arg && typeof arg === 'object' && arg.event && arg.event.includes('vwo')) {
                            tracker.addEvent({
                                timestamp: new Date().toLocaleTimeString(),
                                type: 'datalayer',
                                category: 'DataLayer',
                                name: arg.event,
                                details: arg
                            });
                        }
                    });

                    return originalPush(...args);
                };
            }

            // Monitor VWO cookies for changes
            this.monitorVWOCookies();
        }

        monitorVWOCookies() {
            const vwoCookies = this.getVWOCookies();

            setInterval(() => {
                const currentCookies = this.getVWOCookies();

                Object.keys(currentCookies).forEach(cookieName => {
                    if (!vwoCookies[cookieName] || vwoCookies[cookieName] !== currentCookies[cookieName]) {
                        this.addEvent({
                            timestamp: new Date().toLocaleTimeString(),
                            type: 'cookie',
                            category: 'Cookie',
                            name: 'Cookie Change',
                            details: {
                                cookie: cookieName,
                                oldValue: vwoCookies[cookieName],
                                newValue: currentCookies[cookieName]
                            }
                        });
                        vwoCookies[cookieName] = currentCookies[cookieName];
                    }
                });
            }, 1000);
        }

        getVWOCookies() {
            const cookies = {};
            document.cookie.split(';').forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                if (name && (name.includes('_vis_opt') || name.includes('_vwo'))) {
                    cookies[name] = value;
                }
            });
            return cookies;
        }

        trackInitialState() {
            try {
                // Track active experiments from _vwo_exp
                if (window._vwo_exp) {
                    Object.entries(window._vwo_exp).forEach(([expId, experiment]) => {
                        if (experiment && experiment.ready && experiment.combination_chosen) {
                            this.addEvent({
                                timestamp: new Date().toLocaleTimeString(),
                                type: 'state',
                                category: 'Initial State',
                                name: 'Active Experiment',
                                details: {
                                    experimentId: expId,
                                    experimentName: experiment.name,
                                    variationId: experiment.combination_chosen,
                                    type: experiment.type,
                                    status: experiment.status
                                }
                            });
                        }
                    });
                }

                // Track VWO settings
                if (window.VWO && window.VWO.data) {
                    this.addEvent({
                        timestamp: new Date().toLocaleTimeString(),
                        type: 'state',
                        category: 'Initial State',
                        name: 'VWO Configuration',
                        details: {
                            accountId: window._vwo_acc_id,
                            version: window.VWO.v,
                            experiments: Object.keys(window._vwo_exp || {}).length
                        }
                    });
                }
            } catch (e) {
                console.error('[VWO Event Tracker] Error tracking initial state:', e);
            }
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
            if (document.getElementById('vwo-event-tracker-window')) {
                this.floatingWindow = document.getElementById('vwo-event-tracker-window');
                return;
            }

            const container = document.createElement('div');
            container.id = 'vwo-event-tracker-window';
            container.className = 'vwo-event-tracker-window hidden';

            const header = document.createElement('div');
            header.className = 'vwo-event-tracker-header';
            header.innerHTML = `
        <span class="vwo-event-tracker-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13 3L8 13L3 3h10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          VWO Event Tracker
        </span>
        <button class="vwo-event-tracker-close" title="Close">×</button>
      `;

            const content = document.createElement('div');
            content.className = 'vwo-event-tracker-content';

            const eventsList = document.createElement('div');
            eventsList.className = 'vwo-event-tracker-list';
            content.appendChild(eventsList);

            const footer = document.createElement('div');
            footer.className = 'vwo-event-tracker-footer';
            footer.innerHTML = `
        <span class="vwo-event-tracker-count">0 events</span>
        <button class="vwo-event-tracker-clear">Clear All</button>
      `;

            container.appendChild(header);
            container.appendChild(content);
            container.appendChild(footer);

            document.body.appendChild(container);

            this.makeDraggable(container, header);

            header.querySelector('.vwo-event-tracker-close').addEventListener('click', () => {
                this.hideFloatingWindow();
                this.isTracking = false;
                this.stopTracking();
                window.postMessage({
                    source: 'ab-test-detector',
                    action: 'VWO_EVENT_TRACKING_STOPPED'
                }, '*');
            });

            footer.querySelector('.vwo-event-tracker-clear').addEventListener('click', () => {
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

            const list = this.floatingWindow.querySelector('.vwo-event-tracker-list');
            const count = this.floatingWindow.querySelector('.vwo-event-tracker-count');

            count.textContent = `${this.events.length} event${this.events.length !== 1 ? 's' : ''}`;

            list.innerHTML = this.events.map(event => {
                const categoryClass = event.category.toLowerCase().replace(/\s+/g, '-');
                const typeClass = event.type.toLowerCase().replace(/\s+/g, '-');

                return `
          <div class="vwo-event-item ${categoryClass} ${typeClass}">
            <div class="vwo-event-header">
              <span class="vwo-event-time">${event.timestamp}</span>
              <span class="vwo-event-category ${categoryClass}">${event.category}</span>
            </div>
            <div class="vwo-event-name">${event.name}</div>
            ${this.renderEventDetails(event)}
          </div>
        `;
            }).join('');
        }

        renderEventDetails(event) {
            if (!event.details || Object.keys(event.details).length === 0) {
                return '';
            }

            let detailsHtml = '<div class="vwo-event-details">';

            Object.entries(event.details).forEach(([key, value]) => {
                if (value === undefined || value === null) return;

                let displayValue = value;
                if (typeof value === 'object') {
                    displayValue = JSON.stringify(value, null, 2);
                }

                detailsHtml += `
          <div class="vwo-detail-row">
            <span class="vwo-detail-key">${key}:</span>
            <span class="vwo-detail-value">${displayValue}</span>
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
    if (!window.__vwoEventTracker) {
        window.__vwoEventTracker = new VWOEventTracker();

        // Add styles
        if (!document.getElementById('vwo-event-tracker-styles')) {
            const style = document.createElement('style');
            style.id = 'vwo-event-tracker-styles';
            style.textContent = `
        .vwo-event-tracker-window {
          position: fixed;
          bottom: 20px;
          left: 20px;
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
        
        .vwo-event-tracker-window.hidden {
          opacity: 0;
          transform: translateY(20px);
          pointer-events: none;
        }
        
        .vwo-event-tracker-window.dragging {
          cursor: move;
          opacity: 0.95;
        }
        
        .vwo-event-tracker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
          color: white;
          border-radius: 12px 12px 0 0;
          cursor: move;
          user-select: none;
        }
        
        .vwo-event-tracker-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 15px;
        }
        
        .vwo-event-tracker-close {
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
        
        .vwo-event-tracker-close:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        .vwo-event-tracker-content {
          flex: 1;
          overflow-y: auto;
          background: #f8f9fa;
        }
        
        .vwo-event-tracker-list {
          padding: 12px;
        }
        
        .vwo-event-item {
          background: white;
          border: 1px solid #e1e4e8;
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 10px;
          transition: all 0.2s ease;
        }
        
        .vwo-event-item:hover {
          transform: translateX(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: #7c3aed;
        }
        
        .vwo-event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .vwo-event-time {
          color: #666;
          font-size: 12px;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
        }
        
        .vwo-event-category {
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .vwo-event-category.api-call {
          background-color: #f3f0ff;
          color: #7c3aed;
        }
        
        .vwo-event-category.initial-state {
          background-color: #e8f5e9;
          color: #388e3c;
        }
        
        .vwo-event-category.cookie {
          background-color: #fff8e1;
          color: #f57c00;
        }
        
        .vwo-event-category.datalayer {
          background-color: #fce4ec;
          color: #c2185b;
        }
        
        .vwo-event-category.system {
          background-color: #ffebee;
          color: #c62828;
        }
        
        .vwo-event-name {
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 8px;
          font-size: 14px;
        }
        
        .vwo-event-details {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #f0f0f0;
        }
        
        .vwo-detail-row {
          display: flex;
          align-items: flex-start;
          margin-bottom: 6px;
          font-size: 12px;
        }
        
        .vwo-detail-key {
          color: #666;
          margin-right: 8px;
          min-width: 80px;
          font-weight: 500;
        }
        
        .vwo-detail-value {
          color: #1a1a1a;
          flex: 1;
          word-break: break-word;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
          white-space: pre-wrap;
        }
        
        .vwo-event-item.track .vwo-event-name {
          color: #388e3c;
        }
        
        .vwo-event-item.custom-var .vwo-event-name {
          color: #1976d2;
        }
        
        .vwo-event-tracker-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          border-top: 1px solid #e1e4e8;
          background: white;
          border-radius: 0 0 12px 12px;
        }
        
        .vwo-event-tracker-count {
          font-size: 13px;
          color: #666;
          font-weight: 500;
        }
        
        .vwo-event-tracker-clear {
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
        
        .vwo-event-tracker-clear:hover {
          background-color: #c82333;
        }
        
        .vwo-event-tracker-list:empty::after {
          content: "No events captured yet. Interact with the page to see VWO events.";
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