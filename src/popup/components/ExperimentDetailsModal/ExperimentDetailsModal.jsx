import React from 'react';
import './ExperimentDetailsModal.css';

function ExperimentDetailsModal({ experiment = {}, experimentId, projectId, onClose }) {
    const getExperimentType = () => {
        if (experiment.type === 'personalization' || experiment.campaignId) {
            return { type: 'Personalization', icon: '🎯', color: 'personalization' };
        } else if (experiment.layerId || experiment.isFeature) {
            return { type: 'Feature Test', icon: '⚡', color: 'feature' };
        } else if (experiment.isRollout) {
            return { type: 'Feature Rollout', icon: '🚀', color: 'rollout' };
        }
        return { type: 'A/B Test', icon: '🧪', color: 'experiment' };
    };

    const experimentType = getExperimentType();
    const variations = experiment.variations || [];
    const audienceIds = experiment.audienceIds || [];
    const pageIds = experiment.pageIds || [];
    const integrations = experiment.integrations || {};

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="details-modal" onClick={(e) => e.stopPropagation()}>
                <div className="details-header">
                    <div className="details-title">
            <span className={`type-icon ${experimentType.color}`}>
              {experimentType.icon}
            </span>
                        <h2>{experiment.name || 'Unnamed Experiment'}</h2>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>

                <div className="details-body">
                    {/* Basic Information */}
                    <section className="details-section">
                        <h3>Basic Information</h3>
                        <div className="details-grid">
                            <div className="detail-item">
                                <span className="detail-label">Activity ID</span>
                                <span className="detail-value">{experimentId}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Type</span>
                                <span className="detail-value">
                  <span className={`type-badge ${experimentType.color}`}>
                    {experimentType.type}
                  </span>
                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Status</span>
                                <span className="detail-value">
                  <span className={`status-badge ${experiment.status}`}>
                    {experiment.status || 'Unknown'}
                  </span>
                </span>
                            </div>
                            {experiment.trafficAllocation !== undefined && (
                                <div className="detail-item">
                                    <span className="detail-label">Traffic Allocation</span>
                                    <span className="detail-value">{experiment.trafficAllocation}%</span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Variations */}
                    {variations.length > 0 && (
                        <section className="details-section">
                            <h3>Variations ({variations.length})</h3>
                            <div className="variations-list">
                                {variations.map((variation, index) => (
                                    <div key={variation.id} className="variation-item">
                                        <div className="variation-header">
                                            <span className="variation-name">{variation.name || 'Unnamed Variation'}</span>
                                            {variation.weight !== undefined && (
                                                <span className="variation-weight">{variation.weight}%</span>
                                            )}
                                        </div>
                                        <div className="variation-id">ID: {variation.id}</div>
                                        {index === 0 && <span className="control-badge">Control</span>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Audiences */}
                    {audienceIds.length > 0 && (
                        <section className="details-section">
                            <h3>Targeted Audiences ({audienceIds.length})</h3>
                            <div className="audience-list">
                                {audienceIds.map((audienceId) => (
                                    <div key={audienceId} className="audience-item">
                                        <span className="audience-icon">👥</span>
                                        <span className="audience-id">{audienceId}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Pages */}
                    {pageIds.length > 0 && (
                        <section className="details-section">
                            <h3>Pages ({pageIds.length})</h3>
                            <div className="pages-list">
                                {pageIds.map((pageId) => (
                                    <div key={pageId} className="page-item">
                                        <span className="page-icon">📄</span>
                                        <span className="page-id">{pageId}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Integrations */}
                    {Object.keys(integrations).length > 0 && (
                        <section className="details-section">
                            <h3>Integrations</h3>
                            <div className="integrations-list">
                                {Object.entries(integrations).map(([key, value]) => (
                                    <div key={key} className="integration-item">
                                        <span className="integration-name">{key}</span>
                                        <span className="integration-status">
                      {value ? '✓ Enabled' : '✗ Disabled'}
                    </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Additional Details */}
                    {(experiment.created || experiment.lastModified) && (
                        <section className="details-section">
                            <h3>Timeline</h3>
                            <div className="timeline-info">
                                {experiment.created && (
                                    <div className="detail-item">
                                        <span className="detail-label">Created</span>
                                        <span className="detail-value">
                      {new Date(experiment.created).toLocaleString()}
                    </span>
                                    </div>
                                )}
                                {experiment.lastModified && (
                                    <div className="detail-item">
                                        <span className="detail-label">Last Modified</span>
                                        <span className="detail-value">
                      {new Date(experiment.lastModified).toLocaleString()}
                    </span>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                <div className="details-footer">
                    <a
                        href={`https://app.optimizely.com/v2/projects/${projectId}/experiments/${experimentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-in-optimizely"
                    >
                        Open in Optimizely
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M9 6.5V10H2V3h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <path d="M6 1h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <path d="M10 1L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    );
}

export default ExperimentDetailsModal;