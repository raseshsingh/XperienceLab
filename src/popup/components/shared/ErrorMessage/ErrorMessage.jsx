import React from 'react';
import './ErrorMessage.css';

function ErrorMessage({ message, onDismiss, type = 'error' }) {
    return (
        <div className={`error-message ${type}`}>
            <div className="error-content">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5ZM8 9.5C7.45 9.5 7 9.05 7 8.5V5.5C7 4.95 7.45 4.5 8 4.5C8.55 4.5 9 4.95 9 5.5V8.5C9 9.05 8.55 9.5 8 9.5ZM9 11.5H7V10H9V11.5Z" fill="currentColor"/>
                </svg>
                <span>{message}</span>
            </div>
            {onDismiss && (
                <button className="error-dismiss" onClick={onDismiss} aria-label="Dismiss">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                </button>
            )}
        </div>
    );
}

export default ErrorMessage;