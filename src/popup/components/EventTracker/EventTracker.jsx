import React, { useState, useEffect } from 'react';
import { MessageBus } from '../../../utils/messaging';
import { MESSAGES } from '../../../utils/constants';
import './EventTracker.css';

function EventTracker({ platform, autoOpen = false }) {
    const [isTracking, setIsTracking] = useState(false);

    useEffect(() => {
        // Auto-open if preference is set
        if (autoOpen && !isTracking) {
            handleToggle(true);
        }
    }, [autoOpen]);

    const handleToggle = async (forceState = null) => {
        const newState = forceState !== null ? forceState : !isTracking;
        setIsTracking(newState);

        // Send message to content script to toggle event tracking
        await MessageBus.sendToActiveTab({
            type: MESSAGES.TOGGLE_EVENT_TRACKING,
            data: {
                enabled: newState,
                platform: platform.toLowerCase()
            }
        });
    };

    const getPlatformName = () => {
        switch (platform.toLowerCase()) {
            case 'optimizely':
                return 'Optimizely';
            case 'vwo':
                return 'VWO';
            case 'adobe':
                return 'Adobe Target';
            default:
                return platform;
        }
    };

    return (
        <div className="event-tracker">
            <button
                className={`event-tracker-toggle ${isTracking ? 'active' : ''} ${platform.toLowerCase()}`}
                onClick={() => handleToggle()}
                title={isTracking ? `Stop ${getPlatformName()} event tracking` : `Start ${getPlatformName()} event tracking`}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1v6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                <span>{isTracking ? 'Stop' : 'Track'} {getPlatformName()} Events</span>
            </button>
        </div>
    );
}

export default EventTracker;