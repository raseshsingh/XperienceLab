import React, { useState } from 'react';
import CopyButton from '../shared/CopyButton/CopyButton';
import LinkButton from '../shared/LinkButton/LinkButton';
import ExperimentDetailsModal from '../ExperimentDetailsModal/ExperimentDetailsModal';
import './ExperimentCard.css';

function OptimizelyExperiment({
                                  experimentId,
                                  experiment = {}, // Default to empty object
                                  currentVariation,
                                  projectId,
                                  onUpdate,
                                  isActive = false
                              }) {
    // Ensure variations is always an array
    const variations = experiment.variations || [];

    const [selectedVariation, setSelectedVariation] = useState(
        currentVariation || variations[0]?.id || ''
    );
    const [showDetails, setShowDetails] = useState(false);

    const handleVariationChange = (e) => {
        const newVariationId = e.target.value;
        setSelectedVariation(newVariationId);
        onUpdate(experimentId, newVariationId);
    };

    const optimizelyUrl = `https://app.optimizely.com/v2/projects/${projectId}/experiments/${experimentId}`;

    // Determine experiment type for display
    const getExperimentType = () => {
        if (experiment.type === 'personalization' || experiment.campaignId) {
            return 'Personalization';
        } else if (experiment.layerId || experiment.isFeature) {
            return 'Feature Test';
        } else if (experiment.isRollout) {
            return 'Feature Rollout';
        }
        return 'A/B Test';
    };

    const hasMultipleVariations = variations.length > 1;
    const hasDetailsToShow = (experiment.audienceIds?.length > 0) ||
        (experiment.pageIds?.length > 0) ||
        (experiment.integrations && Object.keys(experiment.integrations).length > 0);

    return (
        <>
            <div className={`experiment-card ${!isActive ? 'inactive' : ''}`}>
                <div className={`experiment-status-indicator ${isActive ? 'active' : ''}`} />

                <div className="experiment-header">
                    <div className="experiment-title">
                        <h3 title={experiment.name || 'Unnamed Experiment'}>
                            {experiment.name || 'Unnamed Experiment'}
                        </h3>
                        <CopyButton
                            text={experimentId}
                            label="Activity ID"
                            tooltipText={`Copy activity ID: ${experimentId}`}
                        />
                        <LinkButton url={optimizelyUrl} title="View in Optimizely" />
                        {hasDetailsToShow && (
                            <button
                                className="details-button"
                                onClick={() => setShowDetails(true)}
                                title="View all details"
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M7 13A6 6 0 1 0 7 1a6 6 0 0 0 0 12z" stroke="currentColor" strokeWidth="1.5"/>
                                    <path d="M7 9V7M7 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                            </button>
                        )}
                    </div>
                    <div className="experiment-badges">
            <span className={`experiment-badge ${isActive ? 'active' : 'inactive'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
                        <span className="experiment-badge type">
              {getExperimentType()}
            </span>
                    </div>
                </div>

                <div className="experiment-info">
                    <div className="info-row">
                        <span className="info-label">Activity ID:</span>
                        <span className="info-value">{experimentId}</span>
                    </div>

                    {experiment.audienceIds?.length > 0 && (
                        <div className="info-row">
                            <span className="info-label">Audiences:</span>
                            <span className="info-value">
                {experiment.audienceIds.length} audience{experiment.audienceIds.length > 1 ? 's' : ''} targeted
              </span>
                        </div>
                    )}

                    {experiment.trafficAllocation !== undefined && (
                        <div className="info-row">
                            <span className="info-label">Traffic Allocation:</span>
                            <span className="info-value">{experiment.trafficAllocation}%</span>
                        </div>
                    )}
                </div>

                {variations.length > 0 && isActive && (
                    <div className="experiment-controls">
                        <label htmlFor={`optimizely-${experimentId}`}>
                            {hasMultipleVariations ? 'Switch Variation:' : 'Current Variation:'}
                        </label>
                        <select
                            id={`optimizely-${experimentId}`}
                            value={selectedVariation}
                            onChange={handleVariationChange}
                            className="variation-select"
                            disabled={!hasMultipleVariations}
                        >
                            {!selectedVariation && <option value="">Select variation...</option>}
                            {variations.map((variation) => (
                                <option key={variation.id} value={variation.id}>
                                    {variation.name} {variation.weight ? `(${variation.weight}%)` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {!isActive && variations.length > 0 && (
                    <div className="experiment-info">
                        <p className="inactive-message">
                            This activity is not currently active. Activate it in Optimizely to test variations.
                        </p>
                    </div>
                )}
            </div>

            {showDetails && (
                <ExperimentDetailsModal
                    experiment={experiment}
                    experimentId={experimentId}
                    projectId={projectId}
                    onClose={() => setShowDetails(false)}
                />
            )}
        </>
    );
}

export default OptimizelyExperiment;