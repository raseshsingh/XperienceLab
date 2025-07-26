import React, { useState, useEffect } from 'react';
import CopyButton from '../shared/CopyButton/CopyButton';
import './ExperimentCard.css';

function VWOExperiment({ experiment, onUpdate }) {
    const [selectedVariation, setSelectedVariation] = useState(
        experiment.currentVariation || Object.keys(experiment.variations || {})[0] || '1'
    );

    useEffect(() => {
        console.log('[VWO Experiment] Rendering:', experiment);
    }, [experiment]);

    const handleVariationChange = (e) => {
        const newVariationId = e.target.value;
        setSelectedVariation(newVariationId);
        onUpdate(experiment.id, newVariationId);
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            0: { text: 'Inactive', className: 'inactive' },
            1: { text: 'Paused', className: 'paused' },
            2: { text: 'Running', className: 'active' },
            3: { text: 'Stopped', className: 'stopped' }
        };
        return statusMap[status] || { text: 'Unknown', className: '' };
    };

    const status = getStatusBadge(experiment.status);
    const hasVariations = experiment.variations && Object.keys(experiment.variations).length > 0;

    return (
        <div className="experiment-card">
            <div className="experiment-header">
                <div className="experiment-title">
                    <h3>{experiment.name}</h3>
                    <CopyButton text={experiment.id.toString()} />
                </div>
                <div className="experiment-badges">
          <span className={`experiment-badge ${status.className}`}>
            {status.text}
          </span>
                    {!experiment.ready && (
                        <span className="experiment-badge loading">
              Loading
            </span>
                    )}
                </div>
            </div>

            <div className="experiment-info">
                <div className="info-row">
                    <span className="info-label">ID:</span>
                    <span className="info-value">{experiment.id}</span>
                </div>

                <div className="info-row">
                    <span className="info-label">Type:</span>
                    <span className="info-value">{experiment.type.replace('_', ' ')}</span>
                </div>

                {hasVariations && (
                    <div className="info-row">
                        <span className="info-label">Current Variation:</span>
                        <span className="info-value">
              {experiment.variations[selectedVariation] || `Variation ${selectedVariation}`}
            </span>
                    </div>
                )}

                {experiment.goals?.length > 0 && (
                    <div className="info-row">
                        <span className="info-label">Goals:</span>
                        <span className="info-value">{experiment.goals.length} tracked</span>
                    </div>
                )}
            </div>

            {hasVariations && (
                <div className="experiment-controls">
                    <label htmlFor={`vwo-${experiment.id}`}>Switch Variation:</label>
                    <select
                        id={`vwo-${experiment.id}`}
                        value={selectedVariation}
                        onChange={handleVariationChange}
                        className="variation-select"
                    >
                        {Object.entries(experiment.variations).map(([id, name]) => (
                            <option key={id} value={id}>
                                {name || `Variation ${id}`}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {!hasVariations && (
                <div className="experiment-info">
                    <p className="no-variations-message">
                        No variation data available. The experiment might still be loading.
                    </p>
                </div>
            )}
        </div>
    );
}

export default VWOExperiment;