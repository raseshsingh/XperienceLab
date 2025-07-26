(() => {
    'use strict';

    class ABTestDetector {
        constructor() {
            this.platforms = {
                convert: this.detectConvert.bind(this),
                vwo: this.detectVWO.bind(this),
                optimizely: this.detectOptimizely.bind(this),
                adobe: this.detectAdobeTarget.bind(this)
            };

            this.detectionInterval = null;
            this.lastDetectedPlatform = null;
            this.detectionCount = 0;
            this.maxDetectionAttempts = 30;
            this.adobeTargetData = null;

            console.log('[AB Test Debugger] Detector initialized');

            // Set up interceptors immediately
            this.setupNetworkInterceptors();
            this.init();
        }

        init() {
            this.setupMessageListener();
            this.startDetection();
        }

        setupMessageListener() {
            window.addEventListener('message', (event) => {
                if (event.data?.source !== 'ab-test-content') return;

                console.log('[AB Test Debugger] Received message:', event.data.action);

                switch (event.data.action) {
                    case 'GET_PLATFORM_DATA':
                        this.sendPlatformData();
                        break;

                    case 'UPDATE_EXPERIMENT':
                        this.handleExperimentUpdate(event.data.payload);
                        break;
                }
            });
        }

        startDetection() {
            // Initial detection
            this.detectPlatform();

            // Periodic detection with limit
            this.detectionInterval = setInterval(() => {
                this.detectionCount++;

                if (this.detectionCount >= this.maxDetectionAttempts) {
                    console.log('[AB Test Debugger] Max detection attempts reached, stopping detection');
                    this.stopDetection();
                    return;
                }

                this.detectPlatform();
            }, 1000);
        }

        stopDetection() {
            if (this.detectionInterval) {
                clearInterval(this.detectionInterval);
                this.detectionInterval = null;
            }
        }

        detectPlatform() {
            console.log(`[AB Test Debugger] Detection attempt #${this.detectionCount + 1}`);

            for (const [platform, detector] of Object.entries(this.platforms)) {
                const data = detector();
                if (data) {
                    console.log(`[AB Test Debugger] Detected platform: ${platform}`, data);

                    // Only send if platform changed or data updated
                    if (this.lastDetectedPlatform !== platform) {
                        this.lastDetectedPlatform = platform;
                        this.sendMessage({
                            action: 'PLATFORM_DETECTED',
                            payload: { platform, data }
                        });
                    }

                    // Stop detection after successful detection
                    if (this.detectionCount > 5) {
                        this.stopDetection();
                    }
                    return;
                }
            }

            // Only send unknown once
            if (this.lastDetectedPlatform !== 'unknown') {
                console.log('[AB Test Debugger] No platform detected');
                this.lastDetectedPlatform = 'unknown';
                this.sendMessage({
                    action: 'PLATFORM_DETECTED',
                    payload: { platform: 'unknown', data: null }
                });
            }
        }

        sendPlatformData() {
            const detected = this.detectCurrentPlatform();
            console.log('[AB Test Debugger] Sending platform data:', detected);
            this.sendMessage({
                action: 'PLATFORM_DATA',
                payload: detected
            });
        }

        detectCurrentPlatform() {
            for (const [platform, detector] of Object.entries(this.platforms)) {
                const data = detector();
                if (data) return { platform, data };
            }
            return { platform: 'unknown', data: null };
        }

        setupNetworkInterceptors() {
            console.log('[AB Test Debugger] Setting up network interceptors for Adobe Target');

            // Intercept XHR requests
            if (window.XMLHttpRequest) {
                const oldXHROpen = window.XMLHttpRequest.prototype.open;
                const self = this;

                window.XMLHttpRequest.prototype.open = function() {
                    this.addEventListener('load', function() {
                        if (self.isAdobeTargetURL(this.responseURL)) {
                            try {
                                const responseBody = JSON.parse(this.responseText);
                                console.log('[AB Test Debugger] Adobe Target XHR response captured:', responseBody);
                                self.processAdobeTargetResponse(responseBody, this.responseURL);
                            } catch (e) {
                                console.error('[AB Test Debugger] Error parsing Adobe Target response:', e);
                            }
                        }
                    });

                    return oldXHROpen.apply(this, arguments);
                };
            }

            // Intercept fetch requests
            if (window.fetch) {
                const originalFetch = window.fetch;
                const self = this;

                window.fetch = function(...args) {
                    const promise = originalFetch.apply(this, args);

                    promise.then(response => {
                        if (self.isAdobeTargetURL(response.url)) {
                            response.clone().json().then(data => {
                                console.log('[AB Test Debugger] Adobe Target fetch response captured:', data);
                                self.processAdobeTargetResponse(data, response.url);
                            }).catch(e => {
                                console.error('[AB Test Debugger] Error parsing Adobe Target response:', e);
                            });
                        }
                    }).catch(e => {
                        // Ignore fetch errors
                    });

                    return promise;
                };
            }
        }

        detectAdobeTarget() {
            console.log('[AB Test Debugger] Checking for Adobe Target...');

            // Check multiple indicators for Adobe Target
            const targetIndicators = [
                // at.js 2.x
                window.adobe && window.adobe.target,
                window.adobe && window.adobe.target && window.adobe.target.getOffer,
                window.adobe && window.adobe.target && window.adobe.target.getOffers,

                // at.js 1.x
                window.mbox,
                window.mboxCreate,
                window.mboxDefine,
                window.mboxUpdate,
                window.mboxFactoryDefault,

                // Global settings
                window.targetGlobalSettings,
                window.targetPageParams,
                window.targetPageParamsAll,

                // Other indicators
                window.AT,
                window._AT,
                document.querySelector('script[src*="at.js"]'),
                document.querySelector('script[src*="target.js"]'),
                document.querySelector('script[src*=".tt.omtrdc.net"]'),

                // Check for Target cookies
                document.cookie.includes('mbox'),
                document.cookie.includes('at_check'),
                document.cookie.includes('PC#'),

                // Check sessionStorage
                (() => {
                    try {
                        const keys = Object.keys(sessionStorage);
                        return keys.some(key => key.includes('at-') || key.includes('adobe.target'));
                    } catch (e) {
                        return false;
                    }
                })()
            ];

            const isTargetPresent = targetIndicators.some(indicator => !!indicator);

            if (!isTargetPresent && !this.adobeTargetData) {
                console.log('[AB Test Debugger] Adobe Target not found - checked all indicators');
                return null;
            }

            console.log('[AB Test Debugger] Adobe Target indicators found, building data...');

            try {
                const result = {
                    isLoaded: true,
                    version: 'Unknown',
                    atjsVersion: null,
                    globalSettings: {},
                    pageParams: {},
                    activities: [],
                    mboxes: [],
                    offers: [],
                    clientCode: null
                };

                // Detect version
                if (window.adobe && window.adobe.target && window.adobe.target.VERSION) {
                    result.version = window.adobe.target.VERSION;
                    result.atjsVersion = result.version.startsWith('2') ? 2 : 1;
                    console.log('[AB Test Debugger] Detected at.js version:', result.version);
                } else if (window.mbox || window.mboxFactoryDefault) {
                    result.version = '1.x';
                    result.atjsVersion = 1;
                    console.log('[AB Test Debugger] Detected at.js 1.x (legacy)');
                } else if (this.adobeTargetData && this.adobeTargetData.version) {
                    result.version = this.adobeTargetData.version;
                    result.atjsVersion = result.version.startsWith('2') ? 2 : 1;
                }

                // Get global settings
                if (window.targetGlobalSettings) {
                    result.globalSettings = this.serializeObject(window.targetGlobalSettings);
                    if (result.globalSettings.clientCode) {
                        result.clientCode = result.globalSettings.clientCode;
                    }
                }

                // Get page params
                if (window.targetPageParams) {
                    try {
                        const params = window.targetPageParams();
                        if (params) {
                            result.pageParams = this.serializeObject(params);
                        }
                    } catch (e) {
                        console.log('[AB Test Debugger] Could not execute targetPageParams:', e);
                    }
                }

                // Add intercepted activities if available
                if (this.adobeTargetData && this.adobeTargetData.activities.length > 0) {
                    result.activities = this.adobeTargetData.activities;
                    console.log('[AB Test Debugger] Found intercepted activities:', result.activities.length);
                }

                // Extract from sessionStorage
                try {
                    const sessionKeys = Object.keys(sessionStorage);
                    sessionKeys.forEach(key => {
                        if (key.includes('at-') || key.includes('adobe.target')) {
                            try {
                                const value = sessionStorage.getItem(key);
                                const parsed = JSON.parse(value);
                                console.log('[AB Test Debugger] Found Target data in sessionStorage:', key, parsed);

                                // Try to extract activities from session data
                                if (parsed.execute || parsed.prefetch) {
                                    this.processAdobeTargetResponse(parsed, 'sessionStorage');
                                }
                            } catch (e) {
                                // Not JSON or can't parse
                            }
                        }
                    });
                } catch (e) {
                    console.log('[AB Test Debugger] Could not access sessionStorage');
                }

                // Check cookies for activities
                this.extractActivitiesFromCookies(result);

                // Detect mboxes on the page
                this.detectMboxes(result);

                // Add client code from intercepted data
                if (!result.clientCode && this.adobeTargetData && this.adobeTargetData.clientCode) {
                    result.clientCode = this.adobeTargetData.clientCode;
                }

                console.log('[AB Test Debugger] Adobe Target final data:', result);
                return result;
            } catch (error) {
                console.error('[AB Test Debugger] Adobe Target detection error:', error);
                return null;
            }
        }

        isAdobeTargetURL(url) {
            if (!url) return false;

            // Adobe Target patterns
            const patterns = [
                /\/rest\/v\d+\/delivery\?/,
                /\/mbox\/json\?/,
                /\.tt\.omtrdc\.net/,
                /\/event\?.*mbox/,
                /mboxSession=/,
                /mboxURL=/,
                /\/delivery\?client=/,
                /at\.js/,
                /atjs-integration/
            ];

            const matches = patterns.some(pattern => pattern.test(url));
            if (matches) {
                console.log('[AB Test Debugger] Adobe Target URL detected:', url);
            }
            return matches;
        }

        processAdobeTargetResponse(responseData, url) {
            console.log('[AB Test Debugger] Processing Adobe Target response from:', url);

            if (!this.adobeTargetData) {
                this.adobeTargetData = {
                    activities: [],
                    rawResponses: [],
                    version: null,
                    clientCode: null
                };
            }

            // Store raw response
            this.adobeTargetData.rawResponses.push({
                url,
                timestamp: Date.now(),
                data: responseData
            });

            // Detect version from response structure
            if (responseData.execute || responseData.prefetch) {
                this.adobeTargetData.version = '2.x';
            } else if (responseData.offers || responseData.offer || responseData.mbox) {
                this.adobeTargetData.version = '1.x';
            }

            // Extract client code
            if (typeof url === 'string') {
                const clientMatch = url.match(/client=([a-zA-Z0-9_-]+)/);
                if (clientMatch) {
                    this.adobeTargetData.clientCode = clientMatch[1];
                    console.log('[AB Test Debugger] Client code:', clientMatch[1]);
                }
            }

            // Process different response formats

            // at.js 2.x formats
            if (responseData.execute && responseData.execute.pageLoad) {
                console.log('[AB Test Debugger] Processing execute.pageLoad');
                if (responseData.execute.pageLoad.options) {
                    this.processAdobeTargetV2Options(responseData.execute.pageLoad.options);
                }
            }

            if (responseData.execute && responseData.execute.mboxes) {
                console.log('[AB Test Debugger] Processing execute.mboxes');
                responseData.execute.mboxes.forEach(mbox => {
                    if (mbox.options) {
                        this.processAdobeTargetV2Options(mbox.options, mbox.name || mbox.mbox);
                    }
                });
            }

            if (responseData.prefetch && responseData.prefetch.mboxes) {
                console.log('[AB Test Debugger] Processing prefetch.mboxes');
                responseData.prefetch.mboxes.forEach(mbox => {
                    if (mbox.options) {
                        this.processAdobeTargetV2Options(mbox.options, mbox.name || mbox.mbox);
                    }
                });
            }

            // at.js 1.x formats
            if (responseData.offers) {
                console.log('[AB Test Debugger] Processing offers array (v1 style)');
                this.processAdobeTargetV1Offers(responseData.offers, responseData.mbox);
            }

            // Single offer response (v1)
            if (responseData.offer && !responseData.offers) {
                console.log('[AB Test Debugger] Processing single offer (v1 style)');
                this.processAdobeTargetV1Offers([responseData.offer], responseData.mbox);
            }

            // Direct mbox response (v1)
            if (responseData.mbox && responseData.html) {
                console.log('[AB Test Debugger] Processing mbox HTML response (v1 style)');
                const offer = {
                    mbox: responseData.mbox,
                    content: responseData.html,
                    activityId: responseData.activityId,
                    activityName: responseData.activityName || responseData.activity,
                    experienceId: responseData.experienceId,
                    experienceName: responseData.experienceName,
                    campaignId: responseData.campaignId,
                    campaignName: responseData.campaignName
                };
                this.processAdobeTargetV1Offers([offer], responseData.mbox);
            }

            // Legacy format with activities array
            if (responseData.activities && Array.isArray(responseData.activities)) {
                console.log('[AB Test Debugger] Processing activities array (legacy format)');
                responseData.activities.forEach(activity => {
                    if (activity.offers) {
                        this.processAdobeTargetV1Offers(activity.offers, activity.mbox);
                    }
                });
            }

            // Set detected platform
            this.lastDetectedPlatform = 'adobe';

            // Send update message
            this.sendMessage({
                action: 'PLATFORM_DETECTED',
                payload: {
                    platform: 'adobe',
                    data: this.detectAdobeTarget()
                }
            });
        }

        processAdobeTargetV2Options(options, mboxName = 'target-global-mbox') {
            if (!Array.isArray(options)) return;

            options.forEach((option, index) => {
                const activity = {
                    id: null,
                    name: 'Unknown Activity',
                    experienceId: null,
                    experienceName: null,
                    content: option.content,
                    type: 'at.js 2.x',
                    mboxName: mboxName,
                    isActive: true,
                    timestamp: Date.now()
                };

                // Extract from response tokens
                if (option.responseTokens) {
                    const tokens = option.responseTokens;
                    activity.id = tokens['activity.id'] || `activity_${Date.now()}_${index}`;
                    activity.name = tokens['activity.name'] || activity.name;
                    activity.experienceId = tokens['experience.id'];
                    activity.experienceName = tokens['experience.name'];
                    activity.campaignId = tokens['campaign.id'];
                    activity.campaignName = tokens['campaign.name'];
                    activity.algorithm = tokens['activity.decisioningMethod'];
                    activity.responseTokens = tokens;

                    console.log('[AB Test Debugger] Extracted activity from tokens:', activity.name);
                } else {
                    // Create basic activity without tokens
                    activity.id = `activity_${mboxName}_${Date.now()}_${index}`;
                    activity.name = `${mboxName} Activity`;
                    console.log('[AB Test Debugger] Created activity without tokens:', activity.name);
                }

                // Add or update activity
                const existingIndex = this.adobeTargetData.activities.findIndex(
                    a => a.id === activity.id && a.experienceId === activity.experienceId
                );

                if (existingIndex >= 0) {
                    this.adobeTargetData.activities[existingIndex] = activity;
                } else {
                    this.adobeTargetData.activities.push(activity);
                }
            });

            console.log('[AB Test Debugger] Total activities after processing:', this.adobeTargetData.activities.length);
        }

        processAdobeTargetV1Offers(offers, mboxName = null) {
            if (!Array.isArray(offers)) return;

            offers.forEach((offer, index) => {
                // Initialize with default values
                let activityName = 'Unknown Activity';
                let activityId = null;
                let experienceId = null;
                let experienceName = null;

                // First priority: Check response tokens (v1 can have response tokens too)
                if (offer.responseTokens) {
                    console.log('[AB Test Debugger] Found response tokens in v1 offer:', offer.responseTokens);

                    // Extract from response tokens
                    activityName = offer.responseTokens['activity.name'] || activityName;
                    activityId = offer.responseTokens['activity.id'];
                    experienceId = offer.responseTokens['experience.id'];
                    experienceName = offer.responseTokens['experience.name'];

                    // Also check for other token formats
                    if (!activityName || activityName === 'Unknown Activity') {
                        activityName = offer.responseTokens['campaign.name'] ||
                            offer.responseTokens['activity.name'] ||
                            activityName;
                    }
                }

                // Second priority: Check direct properties if not found in tokens
                if (activityName === 'Unknown Activity') {
                    activityName = offer.activityName ||
                        offer.campaignName ||
                        offer.name ||
                        activityName;
                }

                // Set IDs with fallbacks
                activityId = activityId ||
                    offer.activityId ||
                    offer.campaignId ||
                    offer.id ||
                    `offer_${Date.now()}_${index}`;

                experienceId = experienceId ||
                    offer.experienceId ||
                    offer.offerId ||
                    index.toString();

                experienceName = experienceName ||
                    offer.experienceName ||
                    offer.offerName ||
                    `Experience ${index + 1}`;

                const activity = {
                    id: activityId,
                    name: activityName,
                    experienceId: experienceId,
                    experienceName: experienceName,
                    campaignId: offer.campaignId || activityId,
                    campaignName: offer.campaignName || activityName,
                    content: offer.content || offer.html || offer,
                    type: 'at.js 1.x',
                    mboxName: mboxName || offer.mbox || offer.mboxName || 'unknown',
                    isActive: true,
                    timestamp: Date.now(),
                    responseTokens: offer.responseTokens || {}
                };

                // Add any additional metadata
                if (offer.state) {
                    activity.state = offer.state;
                }

                if (offer.priority !== undefined) {
                    activity.priority = offer.priority;
                }

                // Add raw offer data for debugging
                activity.rawOffer = offer;

                console.log('[AB Test Debugger] Extracted v1 activity:', activity.name, 'from offer:', offer);

                const existingIndex = this.adobeTargetData.activities.findIndex(
                    a => a.id === activity.id && a.experienceId === activity.experienceId
                );

                if (existingIndex >= 0) {
                    this.adobeTargetData.activities[existingIndex] = activity;
                } else {
                    this.adobeTargetData.activities.push(activity);
                }
            });

            console.log('[AB Test Debugger] Total activities after v1 processing:', this.adobeTargetData.activities.length);
        }

        extractActivitiesFromCookies(result) {
            const cookies = document.cookie.split(';');

            cookies.forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                if (!name || !value) return;

                if (name.includes('mbox') ||
                    name.includes('at_') ||
                    name.includes('PC') ||
                    name.includes('session')) {

                    const activity = {
                        name: name,
                        value: decodeURIComponent(value),
                        type: 'cookie',
                        isActive: true
                    };

                    // Try to parse PC ID
                    if (name === 'PC' || name.includes('PC#')) {
                        result.visitorId = value.split('#')[0];
                    }

                    result.activities.push(activity);
                    console.log('[AB Test Debugger] Found Target cookie:', name);
                }
            });
        }

        detectMboxes(result) {
            const mboxSelectors = [
                '[data-at-mbox]',
                '[data-mbox-name]',
                '.at-element-marker',
                '[class*="at-element"]',
                '[class*="mbox"]',
                '.mboxDefault',
                '[id*="mbox"]',
                '.at-content-loaded',
                '[data-at-src]'
            ];

            const elements = document.querySelectorAll(mboxSelectors.join(','));
            const processedMboxes = new Set();

            elements.forEach(element => {
                let mboxName = element.dataset?.atMbox ||
                    element.dataset?.mboxName ||
                    element.className?.match?.(/mbox-([^\s]+)/)?.[1] ||
                    element.id?.match?.(/mbox-([^\s]+)/)?.[1];

                if (!mboxName && element.className?.includes('mbox')) {
                    mboxName = 'unnamed-mbox';
                }

                if (mboxName && !processedMboxes.has(mboxName)) {
                    processedMboxes.add(mboxName);
                    result.mboxes.push({
                        name: mboxName,
                        selector: this.getSelector(element),
                        status: 'detected',
                        hasContent: element.children.length > 0
                    });
                    console.log('[AB Test Debugger] Found mbox:', mboxName);
                }
            });

            // Always include global mbox
            if (!processedMboxes.has('target-global-mbox')) {
                result.mboxes.push({
                    name: 'target-global-mbox',
                    selector: 'body',
                    status: 'detected',
                    isGlobal: true
                });
            }
        }


        detectConvert() {
            if (typeof window.convert !== 'object' || !window.convert.data) {
                console.log('[AB Test Debugger] Convert not found');
                return null;
            }

            try {
                console.log('[AB Test Debugger] Convert detected, extracting data...');
                const { data, currentData } = window.convert;

                // Serialize the data to ensure it's cloneable
                return this.serializeObject({
                    experiments: data.experiments || {},
                    currentData: currentData || {},
                    goals: data.goals || {}
                });
            } catch (error) {
                console.error('[AB Test Debugger] Convert detection error:', error);
                return null;
            }
        }

        detectVWO() {
            // Check multiple possible VWO object locations
            const vwoObjects = [
                window._vwo_exp,
                window._vwo_exp_ids,
                window.VWO,
                window._vwo,
                window._vis_opt_experiment_id
            ];

            console.log('[AB Test Debugger] Checking for VWO...');

            // Check for VWO experiments in _vwo_exp
            if (window._vwo_exp && typeof window._vwo_exp === 'object') {
                console.log('[AB Test Debugger] Found _vwo_exp:', window._vwo_exp);

                try {
                    const experiments = {};

                    for (const [id, experiment] of Object.entries(window._vwo_exp)) {
                        // Include all experiments, not just ready ones
                        console.log(`[AB Test Debugger] Processing VWO experiment ${id}:`, experiment);

                        experiments[id] = {
                            id: String(id),
                            name: String(experiment.name || `Experiment ${id}`),
                            status: Number(experiment.status) || 0,
                            type: String(experiment.type || 'VISUAL_AB'),
                            variations: this.serializeObject(experiment.comb_n || experiment.combs || {}),
                            currentVariation: String(experiment.combination_chosen || experiment.current_combination || '1'),
                            goals: Array.isArray(experiment.goals) ? experiment.goals.map(g => String(g)) : [],
                            ready: Boolean(experiment.ready)
                        };
                    }

                    if (Object.keys(experiments).length > 0) {
                        console.log('[AB Test Debugger] VWO experiments found:', experiments);
                        return experiments;
                    }
                } catch (error) {
                    console.error('[AB Test Debugger] VWO detection error:', error);
                }
            }

            // Check for VWO via global VWO object
            if (window.VWO && typeof window.VWO === 'object') {
                console.log('[AB Test Debugger] Found global VWO object:', window.VWO);

                try {
                    // Try to get experiments from VWO object
                    if (window.VWO.data && window.VWO.data.experiments) {
                        const experiments = {};

                        for (const [id, exp] of Object.entries(window.VWO.data.experiments)) {
                            experiments[id] = {
                                id: String(id),
                                name: String(exp.name || `Experiment ${id}`),
                                status: 2, // Assume running if in VWO.data
                                type: 'VISUAL_AB',
                                variations: this.serializeObject(exp.sections || {}),
                                currentVariation: '1',
                                goals: [],
                                ready: true
                            };
                        }

                        if (Object.keys(experiments).length > 0) {
                            console.log('[AB Test Debugger] VWO experiments from VWO.data:', experiments);
                            return experiments;
                        }
                    }
                } catch (error) {
                    console.error('[AB Test Debugger] VWO global object detection error:', error);
                }
            }

            // Check for experiment IDs in cookies
            const cookies = document.cookie.split(';');
            const vwoCookies = cookies.filter(c => c.includes('_vis_opt_exp_'));
            if (vwoCookies.length > 0) {
                console.log('[AB Test Debugger] Found VWO cookies but no experiment data:', vwoCookies);
            }

            console.log('[AB Test Debugger] VWO not detected');
            return null;
        }

        detectOptimizely() {
            if (typeof window.optimizely !== 'object') {
                console.log('[AB Test Debugger] Optimizely not found');
                return null;
            }

            try {
                console.log('[AB Test Debugger] Optimizely detected, extracting data...');

                const state = window.optimizely.get('state');
                const data = window.optimizely.get('data');

                if (!state || !data) {
                    console.log('[AB Test Debugger] Optimizely state or data not available');
                    return null;
                }

                // Extract only the data we need, ensuring it's serializable
                const experiments = {};
                const allExperiments = data.experiments || {};

                console.log('[AB Test Debugger] Optimizely experiments:', allExperiments);

                for (const [expId, experiment] of Object.entries(allExperiments)) {
                    experiments[expId] = {
                        id: String(expId),
                        name: String(experiment.name || ''),
                        status: String(experiment.status || ''),
                        audienceIds: Array.isArray(experiment.audienceIds)
                            ? experiment.audienceIds.map(id => String(id))
                            : [],
                        variations: Array.isArray(experiment.variations)
                            ? experiment.variations.map(v => ({
                                id: String(v.id || ''),
                                name: String(v.name || ''),
                                weight: Number(v.weight) || 0
                            }))
                            : [],
                        trafficAllocation: Number(experiment.trafficAllocation) || 100
                    };
                }

                // Get variation map and active experiments
                const variationMap = state.getVariationMap() || {};
                const serializedVariationMap = {};

                for (const [expId, varId] of Object.entries(variationMap)) {
                    serializedVariationMap[String(expId)] = String(varId);
                }

                const result = {
                    experiments,
                    projectId: String(data.projectId || ''),
                    appliedVariations: serializedVariationMap,
                    activeExperiments: (state.getActiveExperimentIds() || []).map(id => String(id)),
                    audiences: {}
                };

                console.log('[AB Test Debugger] Optimizely data extracted:', result);
                return result;
            } catch (error) {
                console.error('[AB Test Debugger] Optimizely detection error:', error);
                return null;
            }
        }

        handleExperimentUpdate(payload) {
            const { platform, experimentId, variationId } = payload;
            console.log('[AB Test Debugger] Updating experiment:', payload);

            switch (platform) {
                case 'convert':
                    this.updateConvertExperiment(experimentId, variationId);
                    break;

                case 'vwo':
                    this.updateVWOExperiment(experimentId, variationId);
                    break;

                case 'optimizely':
                    this.updateOptimizelyExperiment(experimentId, variationId);
                    break;

                case 'adobe':
                    this.updateAdobeTargetExperiment(experimentId, variationId);
                    break;
            }
        }

        updateAdobeTargetExperiment(activityId, experienceId) {
            console.log('[AB Test Debugger] Updating Adobe Target activity:', activityId, experienceId);

            // Adobe Target doesn't have a direct way to force experiences like other platforms
            // You would typically need to use profile parameters or custom code
            console.log('[AB Test Debugger] Adobe Target manual experience switching requires profile parameters or custom implementation');

            // Could potentially set a cookie or profile parameter here
            document.cookie = `mbox_debug=${activityId}:${experienceId}; path=/`;

            setTimeout(() => window.location.reload(), 100);
        }

        updateConvertExperiment(experimentId, variationId) {
            console.log('[AB Test Debugger] Updating Convert experiment:', experimentId, variationId);
            this.updateUrlParameter('_conv_eforce', `${experimentId}.${variationId}`);

            // Trigger reload after URL update
            setTimeout(() => window.location.reload(), 100);
        }

        updateVWOExperiment(experimentId, variationId) {
            console.log('[AB Test Debugger] Updating VWO experiment:', experimentId, variationId);
            const cookieName = `_vis_opt_exp_${experimentId}_combi`;
            document.cookie = `${cookieName}=${variationId}; path=/`;

            // Try multiple VWO refresh methods
            if (window.VWO && window.VWO.refresh) {
                console.log('[AB Test Debugger] Calling VWO.refresh()');
                window.VWO.refresh();
            } else if (window._vwo_exp && window._vwo_exp[experimentId]) {
                console.log('[AB Test Debugger] Updating _vwo_exp directly');
                window._vwo_exp[experimentId].combination_chosen = variationId;
                setTimeout(() => window.location.reload(), 100);
            } else {
                console.log('[AB Test Debugger] No VWO refresh method found, reloading page');
                setTimeout(() => window.location.reload(), 100);
            }
        }

        updateOptimizelyExperiment(experimentId, variationId) {
            console.log('[AB Test Debugger] Updating Optimizely experiment:', experimentId, variationId);
            if (window.optimizely) {
                window.optimizely.push({
                    type: 'bucketVisitor',
                    experimentId: String(experimentId),
                    variationId: String(variationId)
                });

                // Force activation
                window.optimizely.push({
                    type: 'activate'
                });

                console.log('[AB Test Debugger] Optimizely commands pushed');
            }
        }

        updateUrlParameter(key, value) {
            const url = new URL(window.location);
            url.searchParams.set(key, value);
            window.history.replaceState({}, '', url);
        }

        sendMessage(data) {
            try {
                // Ensure the data is serializable before sending
                const serializedData = JSON.parse(JSON.stringify({
                    source: 'ab-test-detector',
                    ...data
                }));

                window.postMessage(serializedData, '*');
            } catch (error) {
                console.error('[AB Test Debugger] Failed to send message:', error);

                // Send a minimal error message
                window.postMessage({
                    source: 'ab-test-detector',
                    action: 'ERROR',
                    payload: {
                        error: 'Failed to serialize data',
                        platform: data.payload?.platform || 'unknown'
                    }
                }, '*');
            }
        }
    }

    // Initialize detector only once
    if (!window.__abTestDetectorInitialized) {
        window.__abTestDetectorInitialized = true;
        new ABTestDetector();
    } else {
        console.log('[AB Test Debugger] Detector already initialized, skipping');
    }
})();