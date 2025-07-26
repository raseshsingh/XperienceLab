const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
    entry: {
        popup: path.resolve(__dirname, '../src/popup/index.js'),
        content: path.resolve(__dirname, '../src/content/content.js'),
        injected: path.resolve(__dirname, '../src/injected/detector.js'),
        background: path.resolve(__dirname, '../src/background/service-worker.js'),
    },
    output: {
        path: path.resolve(__dirname, '../dist'),
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react'],
                    },
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|jpg|jpeg|gif|svg)$/,
                type: 'asset/resource',
            },
        ],
    },
    resolve: {
        extensions: ['.js', '.jsx'],
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'src/manifest.json' },
                { from: 'src/assets/images', to: '.' },
                { from: 'src/content/styles.css', to: 'content.css' },
            ],
        }),
        new HtmlWebpackPlugin({
            template: 'src/popup/index.html',
            filename: 'popup.html',
            chunks: ['popup'],
        }),
    ],
};