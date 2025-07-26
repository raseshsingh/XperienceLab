import React, { useState } from 'react';
import { MessageBus } from '../../../utils/messaging';
import { MESSAGES } from '../../../utils/constants';
import './EventTracker.css';

function EventTracker() {
    const [isTracking, setIsTracking] = useState(false);

    const handleToggle = async () => {
        const newState = !isTracking;
        setIsTracking(newState);

        // Send message to content script to toggle event tracking
        await MessageBus.sendToActiveTab({
            type: MESSAGES.TOGGLE_EVENT_TRACKING,
            data: { enabled: newState }
        });
    };

    return (
        <div className="event-tracker">
            <button
                className={`event-tracker-toggle ${isTracking ? 'active' : ''}`}
                onClick={handleToggle}
                title={isTracking ? 'Stop event tracking' : 'Start event tracking'}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1v6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                <span>{isTracking ? 'Stop Tracking' : 'Track Events'}</span>
            </button>
        </div>
    );
}

export default EventTracker;