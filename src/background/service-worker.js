import { MessageBus } from '../utils/messaging.js';
import { Storage } from '../utils/storage.js';
import { MESSAGES, STORAGE_KEYS } from '../utils/constants.js';

// Keep service worker alive
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();

// Handle installation with new default preferences
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        await Storage.set(STORAGE_KEYS.USER_PREFERENCES, {
            autoReload: true,
            notifications: true,
            debugMode: false,
            autoOpenEventTracker: false
        });
    } else if (details.reason === 'update') {
        // Add new preference to existing users
        const preferences = await Storage.get(STORAGE_KEYS.USER_PREFERENCES) || {};
        if (preferences.autoOpenEventTracker === undefined) {
            preferences.autoOpenEventTracker = false;
            await Storage.set(STORAGE_KEYS.USER_PREFERENCES, preferences);
        }
    }
});

// Message handling
MessageBus.onMessage(async (message, sender) => {
    switch (message.type) {
        case MESSAGES.SET_COOKIE:
            return setCookie(message.data, sender.tab);

        case MESSAGES.GET_PLATFORM_DATA:
            return getPlatformData(sender.tab);

        default:
            console.warn('Unknown message type:', message.type);
            return null;
    }
});

async function setCookie(cookieData, tab) {
    try {
        const { name, value, domain } = cookieData;
        await chrome.cookies.set({
            url: tab.url,
            name,
            value,
            domain: domain || new URL(tab.url).hostname
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to set cookie:', error);
        return { success: false, error: error.message };
    }
}

async function getPlatformData(tab) {
    try {
        // Store last active tab info
        await Storage.set(STORAGE_KEYS.LAST_PLATFORM, {
            tabId: tab.id,
            url: tab.url,
            timestamp: Date.now()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}