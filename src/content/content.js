import { MessageBus } from '../utils/messaging.js';
import { MESSAGES, STORAGE_KEYS } from '../utils/constants.js';

class ContentScript {
    constructor() {
        this.injectedScriptLoaded = false;
        this.trackersLoaded = {
            optimizely: false,
            vwo: false,
            adobe: false
        };
        this.platformData = null;
        this.injectionAttempts = 0;
        this.maxInjectionAttempts = 3;
        this.currentPlatform = null;

        console.log('[AB Test Debugger Content] Initializing content script');
        this.init();
    }

    async init() {
        // Share preferences with injected scripts
        await this.sharePreferences();

        this.injectDetectorScript();
        this.setupMessageListeners();
    }
    async sharePreferences() {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PREFERENCES);
            const preferences = result[STORAGE_KEYS.USER_PREFERENCES] || {};

            // Store in page for injected scripts to access
            window.postMessage({
                source: 'ab-test-preferences',
                preferences: preferences
            }, '*');
        } catch (error) {
            console.error('[AB Test Debugger Content] Error sharing preferences:', error);
        }
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

    injectEventTracker(platform) {
        if (this.trackersLoaded[platform]) {
            // If already loaded, just check if it's active
            window.postMessage({
                source: this.getTrackerSource(platform),
                action: 'GET_STATE'
            }, '*');
            return;
        }

        console.log(`[AB Test Debugger Content] Injecting ${platform} event tracker`);

        // First inject base tracker if not already done
        if (!window.__baseEventTrackerInjected) {
            const baseScript = document.createElement('script');
            baseScript.src = chrome.runtime.getURL('base-event-tracker.js');
            baseScript.onload = () => {
                window.__baseEventTrackerInjected = true;
                this.injectPlatformTracker(platform);
            };
            (document.head || document.documentElement).appendChild(baseScript);
        } else {
            this.injectPlatformTracker(platform);
        }
    }

    injectPlatformTracker(platform) {
        const script = document.createElement('script');
        let fileName = '';

        switch (platform) {
            case 'optimizely':
                fileName = 'event-tracker.js';
                break;
            case 'vwo':
                fileName = 'vwo-event-tracker.js';
                break;
            case 'adobe':
                fileName = 'adobe-target-event-tracker.js';
                break;
            default:
                console.error(`[AB Test Debugger Content] Unknown platform: ${platform}`);
                return;
        }

        script.src = chrome.runtime.getURL(fileName);

        script.onload = () => {
            console.log(`[AB Test Debugger Content] ${platform} event tracker loaded successfully`);
            this.trackersLoaded[platform] = true;
            script.remove();
        };

        (document.head || document.documentElement).appendChild(script);
    }

    getTrackerSource(platform) {
        switch (platform) {
            case 'optimizely':
                return 'ab-test-event-tracker';
            case 'vwo':
                return 'ab-test-vwo-tracker';
            case 'adobe':
                return 'ab-test-adobe-tracker';
            default:
                return '';
        }
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
                    this.currentPlatform = event.data.payload.platform;
                    console.log('[AB Test Debugger Content] Platform data updated:', this.platformData);
                } else if (event.data.action === 'EVENT_TRACKING_STOPPED' ||
                    event.data.action === 'VWO_EVENT_TRACKING_STOPPED' ||
                    event.data.action === 'ADOBE_EVENT_TRACKING_STOPPED') {
                    // Notify popup that tracking was stopped
                    MessageBus.sendToBackground({
                        type: MESSAGES.EVENT_TRACKING_STOPPED,
                        platform: event.data.action.replace('_EVENT_TRACKING_STOPPED', '').toLowerCase()
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

        // Inject appropriate event tracker if not already loaded
        if (!this.trackersLoaded[data.platform] && data.enabled) {
            this.injectEventTracker(data.platform);
        }

        // Send message to appropriate event tracker
        setTimeout(() => {
            window.postMessage({
                source: this.getTrackerSource(data.platform),
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