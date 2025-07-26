import React, { useState, useMemo } from 'react';
import OptimizelyExperiment from './OptimizelyExperiment';
import Accordion from '../shared/Accordion/Accordion';
import './OptimizelyExperiments.css';

const OPTIMIZELY_TYPES = {
    EXPERIMENT: 'A/B Tests',
    PERSONALIZATION: 'Personalization',
    FEATURE_TEST: 'Feature Tests',
    ROLLOUT: 'Feature Rollouts'
};

const TYPE_ICONS = {
    EXPERIMENT: '🧪',
    PERSONALIZATION: '🎯',
    FEATURE_TEST: '⚡',
    ROLLOUT: '🚀'
};

function OptimizelyExperiments({ data, onUpdate }) {
    const [expandedSections, setExpandedSections] = useState(['EXPERIMENT']);

    const { groupedExperiments, totalCount, stats } = useMemo(() => {
        console.log('[OptimizelyExperiments] Processing data:', data);

        if (!data || !data.experiments) {
            return { groupedExperiments: {}, totalCount: 0, stats: {} };
        }

        const { experiments = {}, appliedVariations = {}, activeExperiments = [] } = data;

        const groups = {
            EXPERIMENT: [],
            PERSONALIZATION: [],
            FEATURE_TEST: [],
            ROLLOUT: []
        };

        const typeStats = {
            EXPERIMENT: { active: 0, total: 0 },
            PERSONALIZATION: { active: 0, total: 0 },
            FEATURE_TEST: { active: 0, total: 0 },
            ROLLOUT: { active: 0, total: 0 }
        };

        // Process all experiments
        Object.entries(experiments).forEach(([expId, experiment]) => {
            if (!experiment) return; // Skip if experiment is null/undefined

            // Determine experiment type
            let type = 'EXPERIMENT';

            if (experiment.type === 'personalization' || experiment.campaignId) {
                type = 'PERSONALIZATION';
            } else if (experiment.layerId || experiment.isFeature) {
                type = 'FEATURE_TEST';
            } else if (experiment.isRollout) {
                type = 'ROLLOUT';
            }

            const isActive = activeExperiments.includes(expId);
            const experimentData = {
                id: expId,
                name: experiment.name || 'Unnamed Experiment',
                status: experiment.status || 'Unknown',
                audienceIds: experiment.audienceIds || [],
                variations: experiment.variations || [],
                trafficAllocation: experiment.trafficAllocation,
                pageIds: experiment.pageIds || [],
                integrations: experiment.integrations || {},
                type: experiment.type,
                campaignId: experiment.campaignId,
                layerId: experiment.layerId,
                isFeature: experiment.isFeature,
                isRollout: experiment.isRollout,
                created: experiment.created,
                lastModified: experiment.lastModified,
                isActive,
                currentVariation: appliedVariations[expId] || null
            };

            groups[type].push(experimentData);
            typeStats[type].total++;

            if (isActive) {
                typeStats[type].active++;
            }
        });

        // Remove empty groups
        Object.keys(groups).forEach(type => {
            if (groups[type].length === 0) {
                delete groups[type];
            }
        });

        const total = Object.values(typeStats).reduce((sum, stat) => sum + stat.total, 0);
        const activeTotal = Object.values(typeStats).reduce((sum, stat) => sum + stat.active, 0);

        console.log('[OptimizelyExperiments] Grouped:', groups, 'Stats:', typeStats);

        return {
            groupedExperiments: groups,
            totalCount: total,
            stats: {
                ...typeStats,
                total,
                activeTotal
            }
        };
    }, [data]);

    const toggleSection = (type) => {
        setExpandedSections(prev => {
            if (prev.includes(type)) {
                return prev.filter(t => t !== type);
            } else {
                return [...prev, type];
            }
        });
    };

    if (totalCount === 0) {
        return <p className="no-experiments">No Optimizely activities found.</p>;
    }

    return (
        <div className="optimizely-experiments">
            {/* Total activities summary */}
            <div className="activities-summary">
                <div className="summary-content">
                    <div className="summary-icon">📊</div>
                    <div className="summary-text">
                        <div className="summary-title">Total Activities</div>
                        <div className="summary-stats">
                            <span className="stat-number">{totalCount}</span>
                            <span className="stat-label">
                ({stats.activeTotal} active)
              </span>
                        </div>
                    </div>
                </div>
                {Object.values(stats).some(stat => stat.total > 0) && (
                    <div className="summary-breakdown">
                        {Object.entries(stats).map(([type, stat]) => {
                            if (type === 'total' || type === 'activeTotal' || stat.total === 0) return null;

                            return (
                                <div key={type} className="breakdown-item">
                                    <span className="breakdown-icon">{TYPE_ICONS[type]}</span>
                                    <span className="breakdown-count">{stat.active}/{stat.total}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Grouped experiments */}
            {Object.entries(groupedExperiments).map(([type, experiments]) => {
                const isExpanded = expandedSections.includes(type);
                const icon = TYPE_ICONS[type] || '📊';
                const label = OPTIMIZELY_TYPES[type] || type;
                const activeCount = experiments.filter(exp => exp.isActive).length;

                return (
                    <Accordion
                        key={type}
                        title={
                            <div className="accordion-title-content">
                                <span className="type-icon">{icon}</span>
                                <span className="type-label">{label}</span>
                                <div className="type-stats">
                                    {activeCount > 0 && (
                                        <span className="active-count">{activeCount} active</span>
                                    )}
                                    <span className="experiment-count">{experiments.length}</span>
                                </div>
                            </div>
                        }
                        isExpanded={isExpanded}
                        onToggle={() => toggleSection(type)}
                        className={`optimizely-type-${type.toLowerCase()}`}
                    >
                        <div className="experiments-container">
                            {experiments
                                .sort((a, b) => {
                                    // Sort active experiments first
                                    if (a.isActive && !b.isActive) return -1;
                                    if (!a.isActive && b.isActive) return 1;
                                    return 0;
                                })
                                .map(experiment => (
                                    <OptimizelyExperiment
                                        key={experiment.id}
                                        experimentId={experiment.id}
                                        experiment={experiment}
                                        currentVariation={experiment.currentVariation}
                                        projectId={data.projectId}
                                        onUpdate={onUpdate}
                                        isActive={experiment.isActive}
                                    />
                                ))}
                        </div>
                    </Accordion>
                );
            })}
        </div>
    );
}

export default OptimizelyExperiments;