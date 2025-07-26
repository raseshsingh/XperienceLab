import { MessageBus } from '../utils/messaging.js';
import { MESSAGES } from '../utils/constants.js';

class ContentScript {
    constructor() {
        this.injectedScriptLoaded = false;
        this.eventTrackerLoaded = false;
        this.platformData = null;
        this.injectionAttempts = 0;
        this.maxInjectionAttempts = 3;

        console.log('[AB Test Debugger Content] Initializing content script');
        this.init();
    }

    init() {
        this.injectDetectorScript();
        this.setupMessageListeners();
    }

    injectDetectorScript() {
        if (this.injectedScriptLoaded || this.injectionAttempts >= this.maxInjectionAttempts) {
            console.log('[AB Test Debugger Content] Script already loaded or max attempts reached');
            return;
        }

        this.injectionAttempts++;
        console.log(`[AB Test Debugger Content] Injecting detector script (attempt ${this.injectionAttempts})`);

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('injected.js');
        script.dataset.abTestDebugger = 'true';

        script.onload = () => {
            console.log('[AB Test Debugger Content] Detector script loaded successfully');
            this.injectedScriptLoaded = true;
            script.remove();
        };

        script.onerror = () => {
            console.error('[AB Test Debugger Content] Failed to load detector script');
            this.injectedScriptLoaded = false;

            if (this.injectionAttempts < this.maxInjectionAttempts) {
                setTimeout(() => this.injectDetectorScript(), 1000);
            }
        };

        const target = document.head || document.documentElement || document.body;
        if (target) {
            target.appendChild(script);
        } else {
            console.log('[AB Test Debugger Content] No suitable injection point found, waiting...');
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.injectDetectorScript());
            } else {
                setTimeout(() => this.injectDetectorScript(), 100);
            }
        }
    }

    injectEventTracker() {
        if (this.eventTrackerLoaded) return;

        console.log('[AB Test Debugger Content] Injecting event tracker script');

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('event-tracker.js');

        script.onload = () => {
            console.log('[AB Test Debugger Content] Event tracker loaded successfully');
            this.eventTrackerLoaded = true;
            script.remove();
        };

        (document.head || document.documentElement).appendChild(script);
    }

    setupMessageListeners() {
        // Listen for messages from popup/background
        MessageBus.onMessage(async (message) => {
            console.log('[AB Test Debugger Content] Received message:', message.type);

            switch (message.type) {
                case MESSAGES.GET_PLATFORM_DATA:
                    return this.getPlatformData();

                case MESSAGES.UPDATE_EXPERIMENT:
                    return this.updateExperiment(message.data);

                case MESSAGES.TOGGLE_EVENT_TRACKING:
                    return this.toggleEventTracking(message.data);

                case MESSAGES.RELOAD_PAGE:
                    window.location.reload();
                    return { success: true };

                default:
                    return null;
            }
        });

        // Listen for messages from injected script
        window.addEventListener('message', (event) => {
            if (event.source !== window || !event.data?.source) return;

            if (event.data.source === 'ab-test-detector') {
                console.log('[AB Test Debugger Content] Received from detector:', event.data.action);

                if (event.data.action === 'ERROR') {
                    console.error('[AB Test Debugger Content] Detector error:', event.data.payload);
                    this.platformData = {
                        platform: event.data.payload.platform || 'unknown',
                        data: null
                    };
                } else if (event.data.action === 'PLATFORM_DETECTED' || event.data.action === 'PLATFORM_DATA') {
                    this.platformData = event.data.payload;
                    console.log('[AB Test Debugger Content] Platform data updated:', this.platformData);
                } else if (event.data.action === 'EVENT_TRACKING_STOPPED') {
                    // Notify popup that tracking was stopped
                    MessageBus.sendToBackground({
                        type: MESSAGES.EVENT_TRACKING_STOPPED
                    });
                }
            }
        });
    }

    getPlatformData() {
        console.log('[AB Test Debugger Content] Getting platform data');

        window.postMessage({
            source: 'ab-test-content',
            action: 'GET_PLATFORM_DATA'
        }, '*');

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('[AB Test Debugger Content] Timeout waiting for platform data');
                resolve(this.platformData || { platform: 'unknown', data: null });
            }, 2000);

            const listener = (event) => {
                if (event.data?.source === 'ab-test-detector' && event.data?.action === 'PLATFORM_DATA') {
                    console.log('[AB Test Debugger Content] Received platform data');
                    clearTimeout(timeout);
                    window.removeEventListener('message', listener);
                    resolve(event.data.payload);
                }
            };

            window.addEventListener('message', listener);
        });
    }

    updateExperiment(data) {
        console.log('[AB Test Debugger Content] Updating experiment:', data);

        window.postMessage({
            source: 'ab-test-content',
            action: 'UPDATE_EXPERIMENT',
            payload: data
        }, '*');

        return { success: true };
    }

    toggleEventTracking(data) {
        console.log('[AB Test Debugger Content] Toggling event tracking:', data);

        // Inject event tracker if not already loaded
        if (!this.eventTrackerLoaded && data.enabled) {
            this.injectEventTracker();
        }

        // Send message to event tracker
        setTimeout(() => {
            window.postMessage({
                source: 'ab-test-event-tracker',
                action: 'TOGGLE_TRACKING',
                enabled: data.enabled
            }, '*');
        }, 100);

        return { success: true };
    }
}

// Initialize content script only once
if (!window.__abTestContentScriptInitialized) {
    window.__abTestContentScriptInitialized = true;
    new ContentScript();
} else {
    console.log('[AB Test Debugger Content] Content script already initialized');
}