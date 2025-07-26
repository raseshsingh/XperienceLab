import React from 'react';
import './SettingsModal.css';

function SettingsModal({ preferences, onPreferenceChange, onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Settings</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="setting-item">
                        <label className="setting-label">
                            <input
                                type="checkbox"
                                checked={preferences.autoReload}
                                onChange={(e) => onPreferenceChange('autoReload', e.target.checked)}
                            />
                            <span>Auto-reload page after variation change</span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <label className="setting-label">
                            <input
                                type="checkbox"
                                checked={preferences.notifications}
                                onChange={(e) => onPreferenceChange('notifications', e.target.checked)}
                            />
                            <span>Show notifications</span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <label className="setting-label">
                            <input
                                type="checkbox"
                                checked={preferences.debugMode}
                                onChange={(e) => onPreferenceChange('debugMode', e.target.checked)}
                            />
                            <span>Enable debug mode (console logs)</span>
                        </label>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="button button-primary" onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;