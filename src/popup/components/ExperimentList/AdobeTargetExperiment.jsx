import React, { useState } from 'react';
import CopyButton from '../shared/CopyButton/CopyButton';
import './ExperimentCard.css';

function AdobeTargetExperiment({ activity, onUpdate, globalSettings, atjsVersion }) {
    const [selectedExperience, setSelectedExperience] = useState(
        activity.experienceId || activity.experienceName || ''
    );

    const handleExperienceChange = (e) => {
        const newExperienceId = e.target.value;
        setSelectedExperience(newExperienceId);
        onUpdate(activity.id, newExperienceId);
    };

    // Parse activity data from cookie value if available
    const parseActivityData = () => {
        if (!activity.value) return null;

        try {
            // Adobe Target cookies often contain campaign#experience#algo format
            const parts = activity.value.split('#');
            if (parts.length >= 2) {
                return {
                    campaignId: parts[0],
                    experienceId: parts[1],
                    algorithm: parts[2],
                    timestamp: parts[3],
                    additionalData: parts.slice(4)
                };
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    const activityData = parseActivityData();
    const displayName = activity.name || activity.id || 'Unknown Activity';

    return (
        <div className="experiment-card adobe-target">
            <div className="experiment-header">
                <div className="experiment-title">
                    <h3 title={displayName}>{displayName}</h3>
                    <CopyButton
                        text={activity.id || activity.campaignId || activity.name}
                        label="Activity ID"
                        tooltipText={`Copy activity ID: ${activity.id || activity.campaignId || activity.name}`}
                    />
                </div>
                <div className="experiment-badges">
                    {activity.isActive && (
                        <span className="experiment-badge active">Active</span>
                    )}
                    {activity.type && (
                        <span className="experiment-badge type">
              {activity.type}
            </span>
                    )}
                    {activity.algorithm && (
                        <span className="experiment-badge algorithm">
              {activity.algorithm}
            </span>
                    )}
                </div>
            </div>

            <div className="experiment-info">
                {activity.id && (
                    <div className="info-row">
                        <span className="info-label">Activity ID:</span>
                        <span className="info-value">{activity.id}</span>
                    </div>
                )}

                {(activity.experienceId || activity.experienceName) && (
                    <div className="info-row">
                        <span className="info-label">Experience:</span>
                        <span className="info-value">
              {activity.experienceName || activity.experienceId}
                            {activity.experienceId && activity.experienceName &&
                                ` (${activity.experienceId})`}
            </span>
                    </div>
                )}

                {activity.mboxName && (
                    <div className="info-row">
                        <span className="info-label">Mbox:</span>
                        <span className="info-value">{activity.mboxName}</span>
                    </div>
                )}

                {activityData && (
                    <>
                        {activityData.campaignId && (
                            <div className="info-row">
                                <span className="info-label">Campaign ID:</span>
                                <span className="info-value">{activityData.campaignId}</span>
                            </div>
                        )}
                        {activityData.algorithm && (
                            <div className="info-row">
                                <span className="info-label">Algorithm:</span>
                                <span className="info-value">{activityData.algorithm}</span>
                            </div>
                        )}
                    </>
                )}

                {activity.value && activity.type === 'cookie' && (
                    <div className="info-row">
                        <span className="info-label">Cookie:</span>
                        <span className="info-value cookie-value">{activity.name}</span>
                    </div>
                )}

                {/* Show response tokens if available */}
                {activity.tokens && Object.keys(activity.tokens).length > 0 && (
                    <details className="response-tokens">
                        <summary>Response Tokens</summary>
                        <div className="tokens-grid">
                            {Object.entries(activity.tokens).map(([key, value]) => (
                                <div key={key} className="token-item">
                                    <span className="token-key">{key}:</span>
                                    <span className="token-value">{value}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>

            {/* Experience switcher notice */}
            <div className="experiment-controls">
                <div className="adobe-notice">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1C3.68629 1 1 3.68629 1 7C1 10.3137 3.68629 13 7 13C10.3137 13 13 10.3137 13 7C13 3.68629 10.3137 1 7 1Z" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M7 4V7M7 10H7.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span>
            {atjsVersion === 2
                ? 'Use adobe.target.applyOffer() to change experiences programmatically.'
                : 'Use mboxUpdate() or profile parameters to change experiences.'}
                        Track events using the Event Tracker.
          </span>
                </div>
            </div>
        </div>
    );
}

export default AdobeTargetExperiment;