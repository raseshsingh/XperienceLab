import React, { useState } from 'react';
import './CopyButton.css';

function CopyButton({ text, size = 'small' }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.stopPropagation();

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <button
            className={`copy-button ${size} ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            aria-label="Copy to clipboard"
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
            {copied && <span className="copy-tooltip">Copied!</span>}
        </button>
    );
}

export default CopyButton;