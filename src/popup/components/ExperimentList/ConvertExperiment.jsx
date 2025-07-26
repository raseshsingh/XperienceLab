import React, { useState } from 'react';
import CopyButton from '../shared/CopyButton/CopyButton';
import './ExperimentCard.css';

function ConvertExperiment({ experimentId, details, variations, onUpdate }) {
    const [selectedVariation, setSelectedVariation] = useState(details.variation_id);

    const handleVariationChange = (e) => {
        const newVariationId = e.target.value;
        setSelectedVariation(newVariationId);
        onUpdate(experimentId, newVariationId);
    };

    const currentVariation = variations[selectedVariation];
    const hasMultipleVariations = Object.keys(variations).length > 1;

    return (
        <div className="experiment-card">
            <div className="experiment-header">
                <div className="experiment-title">
                    <h3>Experiment {experimentId}</h3>
                    <CopyButton text={experimentId} />
                </div>
                {details.first_time && (
                    <span className="experiment-badge new">New</span>
                )}
            </div>

            <div className="experiment-info">
                <div className="info-row">
                    <span className="info-label">Current Variation:</span>
                    <span className="info-value">{currentVariation?.name || selectedVariation}</span>
                </div>

                {details.variation_name_parts?.sections?.length > 0 && (
                    <div className="info-row">
                        <span className="info-label">Sections:</span>
                        <span className="info-value">{details.variation_name_parts.sections.join(', ')}</span>
                    </div>
                )}

                {details.variation_name_parts?.changes?.length > 0 && (
                    <div className="info-row">
                        <span className="info-label">Changes:</span>
                        <span className="info-value changes">{details.variation_name_parts.changes.join(', ')}</span>
                    </div>
                )}
            </div>

            {hasMultipleVariations && (
                <div className="experiment-controls">
                    <label htmlFor={`convert-${experimentId}`}>Switch Variation:</label>
                    <select
                        id={`convert-${experimentId}`}
                        value={selectedVariation}
                        onChange={handleVariationChange}
                        className="variation-select"
                    >
                        {Object.entries(variations).map(([id, variation]) => (
                            <option key={id} value={id}>
                                {variation.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}

export default ConvertExperiment;