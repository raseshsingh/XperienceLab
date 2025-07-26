import React from 'react';
import './Accordion.css';

function Accordion({ title, children, isExpanded, onToggle, className = '' }) {
    return (
        <div className={`accordion ${className} ${isExpanded ? 'expanded' : ''}`}>
            <button
                className="accordion-header"
                onClick={onToggle}
                aria-expanded={isExpanded}
            >
                <div className="accordion-title">{title}</div>
                <div className="accordion-icon">
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="chevron"
                    >
                        <path
                            d="M3 4.5L6 7.5L9 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            </button>

            <div className="accordion-content">
                <div className="accordion-inner">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default Accordion;