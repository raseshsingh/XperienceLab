import React, { useEffect } from 'react';
import { PLATFORMS } from '../../../utils/constants';
import ConvertExperiment from './ConvertExperiment';
import VWOExperiments from './VWOExperiments';
import OptimizelyExperiment from './OptimizelyExperiment';
import './ExperimentList.css';

function ExperimentList({ platform, data, onExperimentUpdate }) {
    useEffect(() => {
        console.log('[ExperimentList] Rendering platform:', platform, 'data:', data);
    }, [platform, data]);

    const renderExperiments = () => {
        switch (platform) {
            case PLATFORMS.CONVERT:
                return <ConvertExperiments data={data} onUpdate={onExperimentUpdate} />;

            case PLATFORMS.VWO:
                return <VWOExperiments data={data} onUpdate={onExperimentUpdate} />;

            case PLATFORMS.OPTIMIZELY:
                return <OptimizelyExperiments data={data} onUpdate={onExperimentUpdate} />;

            default:
                return null;
        }
    };

    return (
        <div className="experiment-list">
            {renderExperiments()}
        </div>
    );
}

function ConvertExperiments({ data, onUpdate }) {
    const { currentData, experiments } = data;

    if (!currentData?.experiments || Object.keys(currentData.experiments).length === 0) {
        return <p className="no-experiments">No active experiments found.</p>;
    }

    return Object.entries(currentData.experiments).map(([experimentId, details]) => (
        <ConvertExperiment
            key={experimentId}
            experimentId={experimentId}
            details={details}
            variations={experiments[experimentId]?.vars || {}}
            onUpdate={onUpdate}
        />
    ));
}

function OptimizelyExperiments({ data, onUpdate }) {
    const { experiments, appliedVariations, activeExperiments } = data;

    if (!activeExperiments || activeExperiments.length === 0) {
        return <p className="no-experiments">No active experiments found.</p>;
    }

    return activeExperiments.map(experimentId => (
        <OptimizelyExperiment
            key={experimentId}
            experimentId={experimentId}
            experiment={experiments[experimentId]}
            currentVariation={appliedVariations[experimentId]}
            projectId={data.projectId}
            onUpdate={onUpdate}
        />
    ));
}

export default ExperimentList;