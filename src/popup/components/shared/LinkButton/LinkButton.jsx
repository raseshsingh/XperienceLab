import React from 'react';
import './LinkButton.css';

function LinkButton({ url, title = 'Open link', size = 'small' }) {
    const handleClick = (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url });
    };

    return (
        <button
            className={`link-button ${size}`}
            onClick={handleClick}
            title={title}
            aria-label={title}
        >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M10 7.5V12.5H1.5V4H6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.5 1.5H12.5V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 8L12.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </button>
    );
}

export default LinkButton;