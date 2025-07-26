(() => {
    'use strict';

    class ABTestDetector {
        constructor() {
            this.platforms = {
                convert: this.detectConvert.bind(this),
                vwo: this.detectVWO.bind(this),
                optimizely: this.detectOptimizely.bind(this)
            };

            this.detectionInterval = null;
            this.lastDetectedPlatform = null;
            this.detectionCount = 0;
            this.maxDetectionAttempts = 30; // Stop after 30 seconds

            console.log('[AB Test Debugger] Detector initialized');
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

        // Safely serialize object, removing functions and non-serializable values
        serializeObject(obj, maxDepth = 5, currentDepth = 0) {
            if (currentDepth >= maxDepth) return null;
            if (obj === null || obj === undefined) return null;

            const type = typeof obj;

            // Handle primitive types
            if (type === 'string' || type === 'number' || type === 'boolean') {
                return obj;
            }

            // Skip functions, symbols, and other non-serializable types
            if (type === 'function' || type === 'symbol') {
                return null;
            }

            // Handle arrays
            if (Array.isArray(obj)) {
                return obj.map(item => this.serializeObject(item, maxDepth, currentDepth + 1))
                    .filter(item => item !== null);
            }

            // Handle objects
            if (type === 'object') {
                const serialized = {};

                try {
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            const value = obj[key];
                            const serializedValue = this.serializeObject(value, maxDepth, currentDepth + 1);
                            if (serializedValue !== null) {
                                serialized[key] = serializedValue;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[AB Test Debugger] Error serializing object:', e);
                }

                return serialized;
            }

            return null;
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
            }
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