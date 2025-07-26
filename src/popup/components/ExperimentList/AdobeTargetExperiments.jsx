import React, { useState, useMemo } from 'react';
import AdobeTargetExperiment from './AdobeTargetExperiment';
import Accordion from '../shared/Accordion/Accordion';
import './AdobeTargetExperiments.css';

const ADOBE_TARGET_TYPES = {
    PAGELOAD: 'Page Load Activities',
    PREFETCH: 'Prefetched Activities',
    AB: 'A/B Tests',
    XT: 'Experience Targeting',
    MVT: 'Multivariate Tests',
    AP: 'Automated Personalization',
    AT: 'Auto-Target',
    REC: 'Recommendations',
    COOKIE: 'Cookie-based Activities',
    MBOX: 'Active Mboxes',
    OFFER: 'Applied Offers'
};

const TYPE_ICONS = {
    PAGELOAD: '📄',
    PREFETCH: '⚡',
    AB: '🧪',
    XT: '🎯',
    MVT: '📊',
    AP: '🤖',
    AT: '🎪',
    REC: '💡',
    COOKIE: '🍪',
    MBOX: '📦',
    OFFER: '🎁'
};

function AdobeTargetExperiments({ data, onUpdate }) {
    const [expandedSections, setExpandedSections] = useState(['PAGELOAD', 'MBOX', 'COOKIE']);

    const { groupedActivities, totalCount, stats, mboxes, offers } = useMemo(() => {
        console.log('[AdobeTargetExperiments] Processing data:', data);

        if (!data || typeof data !== 'object') {
            return { groupedActivities: {}, totalCount: 0, stats: {}, mboxes: [], offers: [] };
        }

        const groups = {
            PAGELOAD: [],
            PREFETCH: [],
            AB: [],
            XT: [],
            MVT: [],
            AP: [],
            AT: [],
            REC: [],
            COOKIE: [],
            MBOX: [],
            OFFER: []
        };

        const typeStats = Object.keys(groups).reduce((acc, key) => {
            acc[key] = 0;
            return acc;
        }, {});

        // Process activities
        if (data.activities && Array.isArray(data.activities)) {
            data.activities.forEach(activity => {
                let type = 'AB'; // Default type

                // Determine type based on activity properties
                if (activity.type === 'at.js 2.x' || activity.type === 'at.js 1.x') {
                    // Use algorithm or name to determine actual type
                    const algorithm = activity.algorithm || '';
                    const name = (activity.name || '').toLowerCase();

                    if (algorithm.includes('experience-targeting') || name.includes('xt_')) {
                        type = 'XT';
                    } else if (algorithm.includes('multivariate') || name.includes('mvt_')) {
                        type = 'MVT';
                    } else if (algorithm.includes('auto-personalization') || name.includes('ap_')) {
                        type = 'AP';
                    } else if (algorithm.includes('auto-target') || name.includes('at_')) {
                        type = 'AT';
                    } else if (algorithm.includes('recommendations') || name.includes('rec_')) {
                        type = 'REC';
                    }
                } else if (activity.type === 'cookie') {
                    type = 'COOKIE';
                }

                const activityData = {
                    ...activity,
                    id: activity.id || activity.campaignId || `activity_${Date.now()}_${Math.random()}`,
                    name: activity.name || activity.campaignName || 'Unknown Activity',
                    displayType: type
                };

                groups[type].push(activityData);
                typeStats[type]++;
            });
        }

        // Process mboxes
        const detectedMboxes = [];
        if (data.mboxes && Array.isArray(data.mboxes)) {
            data.mboxes.forEach(mbox => {
                detectedMboxes.push({
                    name: mbox.name,
                    selector: mbox.selector,
                    status: mbox.status || 'detected',
                    version: mbox.version || data.atjsVersion || 'unknown',
                    hasContent: mbox.hasContent,
                    isGlobal: mbox.isGlobal || false,
                    ...mbox
                });
                typeStats.MBOX++;
            });
        }

        // Process offers
        const detectedOffers = [];
        if (data.offers && Array.isArray(data.offers)) {
            data.offers.forEach(offer => {
                detectedOffers.push(offer);
                typeStats.OFFER++;
            });
        }

        // Remove empty groups
        Object.keys(groups).forEach(type => {
            if (groups[type].length === 0 && type !== 'MBOX' && type !== 'OFFER') {
                delete groups[type];
            }
        });

        const total = Object.values(typeStats).reduce((sum, count) => sum + count, 0);

        console.log('[AdobeTargetExperiments] Grouped:', groups, 'Stats:', typeStats);

        return {
            groupedActivities: groups,
            totalCount: total,
            stats: typeStats,
            mboxes: detectedMboxes,
            offers: detectedOffers
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

    if (totalCount === 0 && mboxes.length === 0 && offers.length === 0) {
        return (
            <div className="adobe-target-experiments">
                <div className="no-activities-message">
                    <p>No Adobe Target activities detected on this page.</p>
                    <div className="help-text">
                        <p>Adobe Target Details:</p>
                        <ul>
                            <li>Version: {data.version || 'Not detected'}</li>
                            <li>at.js: {data.atjsVersion ? `v${data.atjsVersion}.x` : 'Not detected'}</li>
                            {data.visitorId && <li>Visitor ID: {data.visitorId}</li>}
                        </ul>
                        <p>Troubleshooting:</p>
                        <ul>
                            <li>Ensure Adobe Target is properly loaded</li>
                            <li>Check if you qualify for any activities</li>
                            <li>Try clearing cookies and refreshing</li>
                            <li>Check browser console for Target errors</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="adobe-target-experiments">
            {/* Adobe Target summary */}
            <div className="activities-summary adobe">
                <div className="summary-content">
                    <div className="summary-icon">🎯</div>
                    <div className="summary-text">
                        <div className="summary-title">Adobe Target Overview</div>
                        <div className="summary-stats">
                            <span className="stat-number">{totalCount}</span>
                            <span className="stat-label">
                total item{totalCount !== 1 ? 's' : ''}
              </span>
                        </div>
                    </div>
                </div>
                <div className="summary-details">
                    <div className="detail-item">
                        <span className="detail-label">Version:</span>
                        <span className="detail-value">
              {data.version || 'Unknown'}
                            {data.atjsVersion && ` (at.js ${data.atjsVersion}.x)`}
            </span>
                    </div>
                    {data.globalSettings?.clientCode && (
                        <div className="detail-item">
                            <span className="detail-label">Client:</span>
                            <span className="detail-value">{data.globalSettings.clientCode}</span>
                        </div>
                    )}
                    {data.visitorId && (
                        <div className="detail-item">
                            <span className="detail-label">Visitor:</span>
                            <span className="detail-value visitor-id">{data.visitorId}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Mboxes Section */}
            {mboxes.length > 0 && (
                <Accordion
                    title={
                        <div className="accordion-title-content">
                            <span className="type-icon">{TYPE_ICONS.MBOX}</span>
                            <span className="type-label">Detected Mboxes</span>
                            <span className="experiment-count">{mboxes.length}</span>
                        </div>
                    }
                    isExpanded={expandedSections.includes('MBOX')}
                    onToggle={() => toggleSection('MBOX')}
                    className="adobe-type-mbox"
                >
                    <div className="mboxes-container">
                        {mboxes.map((mbox, index) => (
                            <div key={`${mbox.name}-${index}`} className="mbox-item">
                                <div className="mbox-header">
                  <span className="mbox-name">
                    {mbox.isGlobal && '🌐 '}
                      {mbox.name}
                  </span>
                                    <div className="mbox-badges">
                    <span className={`mbox-status ${mbox.status}`}>
                      {mbox.status}
                    </span>
                                        <span className="mbox-version">
                      v{mbox.version}
                    </span>
                                    </div>
                                </div>
                                {mbox.selector && (
                                    <div className="mbox-selector">
                                        Selector: <code>{mbox.selector}</code>
                                    </div>
                                )}
                                <div className="mbox-meta">
                                    {mbox.hasContent && <span className="meta-tag">Has Content</span>}
                                    {mbox.hasDefault && <span className="meta-tag">Has Default</span>}
                                    {mbox.isGlobal && <span className="meta-tag">Global Mbox</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Accordion>
            )}

            {/* Offers Section */}
            {offers.length > 0 && (
                <Accordion
                    title={
                        <div className="accordion-title-content">
                            <span className="type-icon">{TYPE_ICONS.OFFER}</span>
                            <span className="type-label">Applied Offers</span>
                            <span className="experiment-count">{offers.length}</span>
                        </div>
                    }
                    isExpanded={expandedSections.includes('OFFER')}
                    onToggle={() => toggleSection('OFFER')}
                    className="adobe-type-offer"
                >
                    <div className="offers-container">
                        {offers.map((offer, index) => (
                            <div key={`offer-${index}`} className="offer-item">
                                <div className="offer-header">
                                    {offer.offerId && <span>Offer ID: {offer.offerId}</span>}
                                    {offer.activityId && <span>Activity ID: {offer.activityId}</span>}
                                </div>
                                {offer.selector && (
                                    <div className="offer-selector">
                                        Applied to: <code>{offer.selector}</code>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Accordion>
            )}

            {/* Grouped activities */}
            {Object.entries(groupedActivities).map(([type, activities]) => {
                if (type === 'MBOX' || type === 'OFFER' || activities.length === 0) return null;

                const isExpanded = expandedSections.includes(type);
                const icon = TYPE_ICONS[type] || '📊';
                const label = ADOBE_TARGET_TYPES[type] || type;

                return (
                    <Accordion
                        key={type}
                        title={
                            <div className="accordion-title-content">
                                <span className="type-icon">{icon}</span>
                                <span className="type-label">{label}</span>
                                <span className="experiment-count">{activities.length}</span>
                            </div>
                        }
                        isExpanded={isExpanded}
                        onToggle={() => toggleSection(type)}
                        className={`adobe-type-${type.toLowerCase()}`}
                    >
                        <div className="experiments-container">
                            {activities.map((activity, index) => (
                                <AdobeTargetExperiment
                                    key={activity.id || `${type}-${index}`}
                                    activity={activity}
                                    onUpdate={onUpdate}
                                    globalSettings={data.globalSettings}
                                    atjsVersion={data.atjsVersion}
                                />
                            ))}
                        </div>
                    </Accordion>
                );
            })}

            {/* Page Parameters Section */}
            {data.pageParams && Object.keys(data.pageParams).length > 0 && (
                <div className="page-params-section">
                    <h3>Page Parameters (targetPageParams)</h3>
                    <div className="params-grid">
                        {Object.entries(data.pageParams).map(([key, value]) => (
                            <div key={key} className="param-item">
                                <span className="param-key">{key}:</span>
                                <span className="param-value">{JSON.stringify(value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdobeTargetExperiments;