import React, { useState, useMemo } from 'react';
import VWOExperiment from './VWOExperiment';
import Accordion from '../shared/Accordion/Accordion';
import './VWOExperiments.css';

const VWO_TYPES = [
    'VISUAL AB',
    'TRACK',
    'ANALYZE HEATMAP',
    'ANALYZE RECORDING',
    'ANALYZE FORM',
    'FUNNEL',
    'DEPLOY',
    'SURVEY',
    'INSIGHTS METRIC',
    'INSIGHTS FUNNEL'
];

const TYPE_LABELS = {
    'VISUAL AB': 'Visual A/B Tests',
    'TRACK': 'Tracking',
    'ANALYZE HEATMAP': 'Heatmap Analysis',
    'ANALYZE RECORDING': 'Recording Analysis',
    'ANALYZE FORM': 'Form Analysis',
    'FUNNEL': 'Funnels',
    'DEPLOY': 'Deployments',
    'SURVEY': 'Surveys',
    'INSIGHTS METRIC': 'Metrics Insights',
    'INSIGHTS FUNNEL': 'Funnel Insights'
};

const TYPE_ICONS = {
    'VISUAL AB': '🧪',
    'TRACK': '📊',
    'ANALYZE HEATMAP': '🔥',
    'ANALYZE RECORDING': '🎥',
    'ANALYZE FORM': '📝',
    'FUNNEL': '🔀',
    'DEPLOY': '🚀',
    'SURVEY': '📋',
    'INSIGHTS METRIC': '📈',
    'INSIGHTS FUNNEL': '📉'
};

function VWOExperiments({ data, onUpdate }) {
    const [expandedSections, setExpandedSections] = useState(['VISUAL AB']);

    const groupedExperiments = useMemo(() => {
        console.log('[VWOExperiments] Grouping experiments by type:', data);

        if (!data || typeof data !== 'object') {
            return {};
        }

        const groups = {};

        // Initialize all groups
        VWO_TYPES.forEach(type => {
            groups[type] = [];
        });

        // Group experiments by type
        Object.entries(data).forEach(([id, experiment]) => {
            const type = experiment.type || 'VISUAL AB';
            const normalizedType = type.replace(/_/g, ' ').toUpperCase();

            if (groups[normalizedType]) {
                groups[normalizedType].push({ id, ...experiment });
            } else {
                // If unknown type, add to VISUAL AB
                groups['VISUAL AB'].push({ id, ...experiment });
            }
        });

        // Remove empty groups
        Object.keys(groups).forEach(type => {
            if (groups[type].length === 0) {
                delete groups[type];
            }
        });

        console.log('[VWOExperiments] Grouped experiments:', groups);
        return groups;
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

    if (Object.keys(groupedExperiments).length === 0) {
        return <p className="no-experiments">No VWO experiments found.</p>;
    }

    // Order types with VISUAL AB first
    const orderedTypes = VWO_TYPES.filter(type => groupedExperiments[type]);

    return (
        <div className="vwo-experiments">
            {orderedTypes.map(type => {
                const experiments = groupedExperiments[type];
                const isExpanded = expandedSections.includes(type);
                const icon = TYPE_ICONS[type] || '📊';
                const label = TYPE_LABELS[type] || type;

                return (
                    <Accordion
                        key={type}
                        title={
                            <div className="accordion-title-content">
                                <span className="type-icon">{icon}</span>
                                <span className="type-label">{label}</span>
                                <span className="experiment-count">{experiments.length}</span>
                            </div>
                        }
                        isExpanded={isExpanded}
                        onToggle={() => toggleSection(type)}
                        className={`vwo-type-${type.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                        <div className="experiments-container">
                            {experiments.map(experiment => (
                                <VWOExperiment
                                    key={experiment.id}
                                    experiment={experiment}
                                    onUpdate={onUpdate}
                                />
                            ))}
                        </div>
                    </Accordion>
                );
            })}
        </div>
    );
}

export default VWOExperiments;