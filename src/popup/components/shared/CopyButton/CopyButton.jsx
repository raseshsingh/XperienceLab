import React, { useState } from 'react';
import './CopyButton.css';

function CopyButton({ text, label = '', tooltipText = '', size = 'small' }) {
    const [copied, setCopied] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    const handleCopy = async (e) => {
        e.stopPropagation();

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setShowTooltip(false); // Hide hover tooltip when copying
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleMouseEnter = () => {
        if (!copied) {
            setShowTooltip(true);
        }
    };

    const handleMouseLeave = () => {
        setShowTooltip(false);
    };

    const getTooltipText = () => {
        if (copied) {
            return `${label ? `${label} ` : ''}copied!`;
        }
        return tooltipText || `Copy ${label || 'to clipboard'}`;
    };

    return (
        <button
            className={`copy-button ${size} ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            aria-label={getTooltipText()}
        >
            {copied ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M12 3.5L5.5 10L2 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="5" y="5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M9 5V3C9 2.44772 8.55228 2 8 2H3C2.44772 2 2 2.44772 2 3V8C2 8.55228 2.44772 9 3 9H5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
            )}
            {(showTooltip || copied) && (
                <span className={`copy-tooltip ${copied ? 'success' : ''}`}>
          {getTooltipText()}
        </span>
            )}
        </button>
    );
}

export default CopyButton;