export const PLATFORMS = {
    CONVERT: 'convert',
    VWO: 'vwo',
    OPTIMIZELY: 'optimizely',
    UNKNOWN: 'unknown'
};

export const MESSAGES = {
    GET_PLATFORM_DATA: 'GET_PLATFORM_DATA',
    PLATFORM_DATA_RESPONSE: 'PLATFORM_DATA_RESPONSE',
    UPDATE_EXPERIMENT: 'UPDATE_EXPERIMENT',
    SET_COOKIE: 'SET_COOKIE',
    RELOAD_PAGE: 'RELOAD_PAGE'
};

export const STORAGE_KEYS = {
    LAST_PLATFORM: 'lastDetectedPlatform',
    EXPERIMENT_HISTORY: 'experimentHistory',
    USER_PREFERENCES: 'userPreferences'
};

export const PLATFORM_LOGOS = {
    [PLATFORMS.CONVERT]: 'https://i.ibb.co/6P5jHJ7/convert.png',
    [PLATFORMS.VWO]: 'https://i.ibb.co/sJHz2JD/VWO.jpg',
    [PLATFORMS.OPTIMIZELY]: 'https://i.ibb.co/SdqT8pd/optimizely.png'
};