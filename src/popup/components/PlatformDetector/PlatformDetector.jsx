import React from 'react';
import { PLATFORMS, PLATFORM_LOGOS } from '../../../utils/constants';
import './PlatformDetector.css';

function PlatformDetector({ platform }) {
    if (platform === PLATFORMS.UNKNOWN) return null;

    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    const logoUrl = PLATFORM_LOGOS[platform];

    return (
        <div className="platform-detector">
            <div className="platform-info">
                <span className="platform-label">Detected Platform:</span>
                <div className="platform-name">
                    {logoUrl && (
                        <img
                            src={logoUrl}
                            alt={platformName}
                            className="platform-logo"
                        />
                    )}
                    <span>{platformName}</span>
                </div>
            </div>
            <div className="platform-status">
                <span className="status-indicator active"></span>
                <span className="status-text">Active</span>
            </div>
        </div>
    );
}

export default PlatformDetector;