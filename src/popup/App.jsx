import React, { useState, useEffect, useCallback } from 'react';
import { MessageBus } from '../utils/messaging';
import { Storage } from '../utils/storage';
import { MESSAGES, PLATFORMS, STORAGE_KEYS } from '../utils/constants';
import Header from './components/Header/Header';
import PlatformDetector from './components/PlatformDetector/PlatformDetector';
import ExperimentList from './components/ExperimentList/ExperimentList';
import EventTracker from './components/EventTracker/EventTracker';
import LoadingSpinner from './components/shared/LoadingSpinner/LoadingSpinner';
import ErrorMessage from './components/shared/ErrorMessage/ErrorMessage';
import './App.css';

function App() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [platform, setPlatform] = useState(PLATFORMS.UNKNOWN);
    const [platformData, setPlatformData] = useState(null);
    const [preferences, setPreferences] = useState({});

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load user preferences
            const savedPreferences = await Storage.get(STORAGE_KEYS.USER_PREFERENCES);
            if (savedPreferences) {
                setPreferences(savedPreferences);
            }

            // Get platform data from content script
            const response = await MessageBus.sendToActiveTab({
                type: MESSAGES.GET_PLATFORM_DATA
            });

            if (response) {
                setPlatform(response.platform);
                setPlatformData(response.data);

                // Save to history
                await saveToHistory(response.platform, response.data);
            }
        } catch (err) {
            console.error('Failed to load platform data:', err);
            setError('Failed to detect A/B testing platform. Please refresh the page and try again.');
        } finally {
            setLoading(false);
        }
    };

    const saveToHistory = async (detectedPlatform, data) => {
        if (detectedPlatform === PLATFORMS.UNKNOWN) return;

        const history = await Storage.get(STORAGE_KEYS.EXPERIMENT_HISTORY) || [];
        const entry = {
            platform: detectedPlatform,
            url: window.location.href,
            timestamp: Date.now(),
            experiments: Object.keys(data?.experiments || {})
        };

        history.unshift(entry);
        if (history.length > 50) history.pop();

        await Storage.set(STORAGE_KEYS.EXPERIMENT_HISTORY, history);
    };

    const handleExperimentUpdate = useCallback(async (experimentId, variationId) => {
        try {
            await MessageBus.sendToActiveTab({
                type: MESSAGES.UPDATE_EXPERIMENT,
                data: {
                    platform,
                    experimentId,
                    variationId
                }
            });

            if (preferences.autoReload) {
                await MessageBus.sendToActiveTab({
                    type: MESSAGES.RELOAD_PAGE
                });
            }
        } catch (err) {
            console.error('Failed to update experiment:', err);
            setError('Failed to update experiment. Please try again.');
        }
    }, [platform, preferences.autoReload]);

    const handlePreferenceChange = async (key, value) => {
        const newPreferences = { ...preferences, [key]: value };
        setPreferences(newPreferences);
        await Storage.set(STORAGE_KEYS.USER_PREFERENCES, newPreferences);
    };

    if (loading) {
        return (
            <div className="app">
                <Header />
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="app">
            <Header
                onRefresh={loadInitialData}
                preferences={preferences}
                onPreferenceChange={handlePreferenceChange}
            />

            {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

            <PlatformDetector platform={platform} />

            {platform !== PLATFORMS.UNKNOWN && platformData && (
                <ExperimentList
                    platform={platform}
                    data={platformData}
                    onExperimentUpdate={handleExperimentUpdate}
                />
            )}

            {platform === PLATFORMS.UNKNOWN && !error && (
                <div className="no-platform-message">
                    <p>No A/B testing platform detected on this page.</p>
                    <p>Supported platforms: Convert, VWO, Optimizely</p>
                </div>
            )}

            {platform === PLATFORMS.OPTIMIZELY && <EventTracker />}
        </div>
    );
}

export default App;