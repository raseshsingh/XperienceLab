import React, { useState } from 'react';
import CopyButton from '../shared/CopyButton/CopyButton';
import LinkButton from '../shared/LinkButton/LinkButton';
import './ExperimentCard.css';

function OptimizelyExperiment({ experimentId, experiment, currentVariation, projectId, onUpdate }) {
    const [selectedVariation, setSelectedVariation] = useState(currentVariation || '');

    const handleVariationChange = (e) => {
        const newVariationId = e.target.value;
        setSelectedVariation(newVariationId);
        onUpdate(experimentId, newVariationId);
    };

    const optimizelyUrl = `https://app.optimizely.com/v2/projects/${projectId}/experiments/${experimentId}`;

    return (
        <div className="experiment-card">
            <div className="experiment-header">
                <div className="experiment-title">
                    <h3>{experiment.name}</h3>
                    <CopyButton text={experimentId} />
                    <LinkButton url={optimizelyUrl} title="View in Optimizely" />
                </div>
                <span className={`experiment-badge ${experiment.status === 'Running' ? 'active' : ''}`}>
          {experiment.status}
        </span>
            </div>

            <div className="experiment-info">
                <div className="info-row">
                    <span className="info-label">ID:</span>
                    <span className="info-value">{experimentId}</span>
                </div>

                {experiment.audienceIds?.length > 0 && (
                    <div className="info-row">
                        <span className="info-label">Audiences:</span>
                        <span className="info-value">{experiment.audienceIds.length} targeted</span>
                    </div>
                )}

                <div className="info-row">
                    <span className="info-label">Traffic Allocation:</span>
                    <span className="info-value">{experiment.trafficAllocation}%</span>
                </div>
            </div>

            {experiment.variations?.length > 0 && (
                <div className="experiment-controls">
                    <label htmlFor={`optimizely-${experimentId}`}>Switch Variation:</label>
                    <select
                        id={`optimizely-${experimentId}`}
                        value={selectedVariation}
                        onChange={handleVariationChange}
                        className="variation-select"
                    >
                        {experiment.variations.map((variation) => (
                            <option key={variation.id} value={variation.id}>
                                {variation.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}

export default OptimizelyExperiment;