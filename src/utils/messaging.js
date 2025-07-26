export class MessageBus {
    static async sendToActiveTab(message) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) throw new Error('No active tab found');

            return chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
            console.error('Failed to send message to tab:', error);
            throw error;
        }
    }

    static async sendToBackground(message) {
        try {
            return chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('Failed to send message to background:', error);
            throw error;
        }
    }

    static onMessage(callback) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Handle async responses properly
            const result = callback(message, sender);
            if (result instanceof Promise) {
                result.then(sendResponse).catch(console.error);
                return true; // Keep message channel open
            }
            return false;
        });
    }
}