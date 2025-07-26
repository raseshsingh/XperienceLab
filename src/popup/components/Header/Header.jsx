import React, { useState } from 'react';
import SettingsModal from '../SettingsModal/SettingsModal';
import './Header.css';

function Header({ onRefresh, preferences, onPreferenceChange }) {
    const [showSettings, setShowSettings] = useState(false);

    return (
        <>
            <header className="header">
                <div className="header-content">
                    <div className="header-title">
                        <h1>A/B Test Debugger</h1>
                        <span className="header-version">v1.0.0</span>
                    </div>

                    <div className="header-actions">
                        <button
                            className="header-button refresh-button"
                            onClick={onRefresh}
                            title="Refresh data"
                            aria-label="Refresh"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M13.65 2.35A8 8 0 1 0 16 8h-1.5a6.5 6.5 0 1 1-1.86-4.64L11 5h5V0l-2.35 2.35z" fill="currentColor"/>
                            </svg>
                        </button>

                        <button
                            className="header-button settings-button"
                            onClick={() => setShowSettings(true)}
                            title="Settings"
                            aria-label="Settings"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="currentColor"/>
                                <path d="M13.3 5.2l1.1-2.1L13 1.7l-2.1 1.1a6 6 0 0 0-1.1-.5L9 0H7l-.8 2.3c-.4.1-.7.3-1.1.5L3 1.7 1.6 3.1l1.1 2.1c-.2.4-.4.7-.5 1.1L0 7v2l2.3.8c.1.4.3.7.5 1.1L1.7 13l1.4 1.4 2.1-1.1c.4.2.7.4 1.1.5L7 16h2l.8-2.3c.4-.1.7-.3 1.1-.5L13 14.4l1.4-1.4-1.1-2.1c.2-.4.4-.7.5-1.1L16 9V7l-2.3-.8c-.1-.4-.3-.7-.5-1.1zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="header-subtitle">
                    Debug A/B tests across Convert, VWO & Optimizely
                </div>
            </header>

            {showSettings && (
                <SettingsModal
                    preferences={preferences}
                    onPreferenceChange={onPreferenceChange}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </>
    );
}

export default Header;