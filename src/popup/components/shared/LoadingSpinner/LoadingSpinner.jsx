import React from 'react';
import './LoadingSpinner.css';

function LoadingSpinner({ size = 'medium', text = 'Loading...' }) {
    return (
        <div className={`loading-spinner ${size}`}>
            <div className="spinner"></div>
            {text && <span className="loading-text">{text}</span>}
        </div>
    );
}

export default LoadingSpinner;