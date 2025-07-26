# XperienceLab: Universal A/B Test Debugger

A Chrome extension for debugging A/B tests across Convert, VWO, and Optimizely platforms.

## Overview

This complete rewrite provides a production-ready Chrome extension with:

1.  **Clean Architecture**: Modular components with clear separation of concerns
2.  **Modern JavaScript**: ES6+ features without TypeScript
3.  **Robust Error Handling**: Graceful fallbacks and user-friendly error messages
4.  **Performance Optimized**: Efficient DOM operations and minimal page impact
5.  **Security First**: Proper content script isolation and message validation
6.  **User Experience**: Loading states, animations, and intuitive UI
7.  **Maintainable Code**: Well-documented, linted, and formatted
8.  **Production Ready**: Optimized builds with source maps stripped

The extension is now more robust, secure, and maintainable while providing a better user experience.

## Features

*   **Multi-platform Support**: Automatically detects Convert, VWO, and Optimizely
*   **Experiment Management**: View and switch between experiment variations
*   **One-click Actions**: Copy experiment IDs, open in platform dashboards
*   **Smart Detection**: Continuously monitors for A/B testing platforms
*   **User Preferences**: Customizable settings for auto-reload and notifications
*   **Clean UI**: Modern, responsive interface with platform-specific styling

## Installation

### Development

1.  Clone the repository
2.  Install dependencies: npm install
3.  Build the extension: npm run dev
4.  Load the dist folder as an unpacked extension in Chrome

### Production

1.  Build for production: npm run build
2.  The packaged extension will be in releases/xperience-lab.zip

## Usage

1.  Click the extension icon on any page with A/B tests
2.  View active experiments and their current variations
3.  Switch variations using the dropdown menus
4.  Copy experiment IDs or open in platform dashboards
5.  Configure preferences in the settings menu

## Architecture

*   **Manifest V3**: Modern Chrome extension architecture
*   **React 18**: For the popup interface
*   **Content Scripts**: Minimal footprint for page interaction
*   **Injected Scripts**: Safe platform detection without conflicts
*   **Message Passing**: Secure communication between contexts

## Development

\# Install dependencies  
```npm install```

\# Development build with watch  
```npm run dev```

\# Production build  
```npm run build```

\# Lint code  
```npm run lint```

\# Format code  
```npm run format```

## Contributing

*   Fork the repository
*   Create a feature branch
*   Make your changes
*   Run tests and linting
*   Submit a pull request


## Author

Rasesh Singh