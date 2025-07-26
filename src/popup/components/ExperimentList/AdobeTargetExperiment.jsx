import React, { useState } from 'react';
import CopyButton from '../shared/CopyButton/CopyButton';
import './ExperimentCard.css';

function AdobeTargetExperiment({ activity, onUpdate, globalSettings, atjsVersion }) {
    const [showDetails, setShowDetails] = useState(false);
    const [showRawData, setShowRawData] = useState(false);

    const displayName = activity.name || activity.campaignName || activity.id || 'Unknown Activity';
    const displayExperience = activity.experienceName || activity.experienceId || 'Default';

    return (
        <div className="experiment-card adobe-target">
            <div className="experiment-header">
                <div className="experiment-title">
                    <h3 title={displayName}>{displayName}</h3>
                    <CopyButton
                        text={activity.id || activity.campaignId}
                        label="Activity ID"
                        tooltipText={`Copy activity ID: ${activity.id || activity.campaignId}`}
                    />
                </div>
                <div className="experiment-badges">
                    {activity.isActive && (
                        <span className="experiment-badge active">Active</span>
                    )}
                    <span className="experiment-badge type">
            {activity.type}
          </span>
                    {activity.algorithm && (
                        <span className="experiment-badge algorithm">
              {activity.algorithm}
            </span>
                    )}
                    {activity.state && (
                        <span className="experiment-badge state">
              {activity.state}
            </span>
                    )}
                </div>
            </div>

            <div className="experiment-info">
                <div className="info-row">
                    <span className="info-label">Activity ID:</span>
                    <span className="info-value">{activity.id || activity.campaignId}</span>
                </div>

                <div className="info-row">
                    <span className="info-label">Experience:</span>
                    <span className="info-value">
            {displayExperience}
                        {activity.experienceId && activity.experienceName &&
                            activity.experienceId !== activity.experienceName &&
                            ` (${activity.experienceId})`}
          </span>
                </div>

                {activity.mboxName && (
                    <div className="info-row">
                        <span className="info-label">Mbox:</span>
                        <span className="info-value">{activity.mboxName}</span>
                    </div>
                )}

                {activity.priority !== undefined && (
                    <div className="info-row">
                        <span className="info-label">Priority:</span>
                        <span className="info-value">{activity.priority}</span>
                    </div>
                )}

                {activity.timestamp && (
                    <div className="info-row">
                        <span className="info-label">Detected:</span>
                        <span className="info-value">
              {new Date(activity.timestamp).toLocaleTimeString()}
            </span>
                    </div>
                )}

                {/* Show response tokens if available */}
                {activity.responseTokens && Object.keys(activity.responseTokens).length > 0 && (
                    <details className="response-tokens" open={showDetails}>
                        <summary onClick={(e) => {
                            e.preventDefault();
                            setShowDetails(!showDetails);
                        }}>
                            Response Tokens ({Object.keys(activity.responseTokens).length})
                        </summary>
                        <div className="tokens-grid">
                            {Object.entries(activity.responseTokens).map(([key, value]) => (
                                <div key={key} className="token-item">
                                    <span className="token-key">{key}:</span>
                                    <span className="token-value">{value || 'null'}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}

                {/* Show content preview if available */}
                {activity.content && (
                    <details className="content-preview">
                        <summary>Content Preview</summary>
                        <div className="content-display">
                            {typeof activity.content === 'string'
                                ? activity.content
                                : JSON.stringify(activity.content, null, 2)}
                        </div>
                    </details>
                )}

                {/* Show raw offer data for debugging (only in v1) */}
                {activity.rawOffer && activity.type === 'at.js 1.x' && (
                    <details className="raw-data-preview">
                        <summary onClick={(e) => {
                            e.preventDefault();
                            setShowRawData(!showRawData);
                        }}>
                            Raw Offer Data (Debug)
                        </summary>
                        {showRawData && (
                            <div className="content-display">
                                {JSON.stringify(activity.rawOffer, null, 2)}
                            </div>
                        )}
                    </details>
                )}
            </div>

            {/* Experience switcher notice */}
            <div className="experiment-controls">
                <div className="adobe-notice info">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 9V7M7 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>
            {activity.type === 'at.js 1.x'
                ? 'at.js 1.x activity detected. Use mboxUpdate() to change experiences.'
                : 'Activity detected via network interception. Use the Event Tracker to monitor changes.'}
          </span>
                </div>
            </div>
        </div>
    );
}

export default AdobeTargetExperiment;