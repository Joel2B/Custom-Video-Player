const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const semver = require('semver');
const cheerio = require('cheerio');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const WebpackObfuscatorPlugin = require('webpack-obfuscator');

// Loading the current package.json - will be used to determine version etc.
const packageJSON = require(path.resolve(__dirname, 'package.json'));
// Loading cdn
const cdnJSON = require(path.resolve(__dirname, 'deploy.json'));

// Validate package version is valid semver
if (!semver.valid(packageJSON.version)) {
    throw new Error('Invalid package version - ' + packageJSON.version);
}

// Distribution options configure how build paths are going to be configured.
const getDistOptions = (mode) => {
    const fullVersion = packageJSON.version;
    const majorVersion = semver.major(packageJSON.version);
    const cdnRoot = cdnJSON.cdn;

    switch (mode) {
        case 'development':
            return {
                path: path.resolve(__dirname, 'dist'),
                publicPath: '',
            };
        case 'current':
            return {
                path: path.resolve(__dirname, 'dist-cdn/v' + majorVersion + '/current/'),
                publicPath: cdnRoot + '/v' + majorVersion + '/current/',
            };
        case 'versioned':
            return {
                path: path.resolve(__dirname, 'dist-cdn/' + fullVersion + '/'),
                publicPath: cdnRoot + '/' + fullVersion + '/',
            };
        default:
            throw new Error('Unknown distribution type provided in --dist!');
    }
};

// Webpack configuration
module.exports = (env, argv) => {
    const mode = typeof argv.mode !== 'undefined' ? argv.mode : 'development';
    const debug = mode === 'development' && !!env.debug;
    const dist = typeof env.dist !== 'undefined' ? env.dist : 'development';
    const distOptions = getDistOptions(dist);
    const obf = !!env.obf;

    if (dist !== 'development' && (mode !== 'production' || debug)) {
        throw new Error('Building a production distribution in development mode or with debug enabled is not allowed!');
    }

    const plugins = [
        // Define common variables for use in Fluid Player
        new webpack.DefinePlugin({
            FP_BUILD_VERSION: JSON.stringify(packageJSON.version),
            FP_HOMEPAGE: JSON.stringify(packageJSON.homepage),
            FP_ENV: JSON.stringify(mode),
            FP_DEBUG: JSON.stringify(debug),
        }),
        new webpack.optimize.LimitChunkCountPlugin({
            maxChunks: 1, // disable creating additional chunks
        }),
    ];

    // Development mode builds and development server specifics
    if (mode === 'development') {
        // Locate all E2E cases
        const caseFiles = [];
        fs.readdirSync(path.resolve(__dirname, 'test/html/')).forEach((file) => {
            const absPath = path.resolve(__dirname, 'test/html/', file);
            const caseHtml = cheerio.load(fs.readFileSync(absPath));
            const publicName = file.replace('.tpl', '');

            plugins.push(
                new HtmlWebpackPlugin({
                    template: path.resolve(__dirname, 'test/html/', file),
                    inject: false,
                    filename: publicName,
                    scriptLoading: 'blocking',
                }),
            );

            caseFiles.push({
                file: publicName,
                name: caseHtml('title').text(),
            });
        });

        // Emit all cases as separate HTML pages
        plugins.push(
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, 'test/index.html'),
                filename: 'index.html',
                inject: false,
                templateParameters: {
                    cases: caseFiles,
                },
            }),
        );

        // Copy static assets for E2E
        plugins.push(
            new CopyPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, 'test/static/'),
                        to: path.resolve(distOptions.path, 'static'),
                    },
                ],
            }),
        );
    }

    if (obf) {
        plugins.push(
            new WebpackObfuscatorPlugin({
                compact: true,
                controlFlowFlattening: false,
                deadCodeInjection: false,
                debugProtection: false,
                debugProtectionInterval: false,
                disableConsoleOutput: false,
                identifierNamesGenerator: 'mangled-shuffled',
                log: false,
                numbersToExpressions: false,
                renameGlobals: false,
                rotateStringArray: true,
                selfDefending: false,
                shuffleStringArray: true,
                simplify: true,
                splitStrings: false,
                stringArray: true,
                stringArrayEncoding: [],
                stringArrayIndexShift: true,
                stringArrayWrappersCount: 1,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersParametersMaxCount: 2,
                stringArrayWrappersType: 'variable',
                stringArrayThreshold: 0.75,
                unicodeEscapeSequence: false,
            }),
        );
    }

    return {
        resolve: {
            fallback: {
                buffer: false,
                stream: false,
                fs: false,
            },
        },
        mode: mode,
        devServer: {
            static: distOptions.path,
        },
        devtool: mode === 'development' ? 'source-map' : false,
        plugins,
        entry: {
            player: './src/browser.js',
        },
        optimization: {
            minimize: mode !== 'development',
            splitChunks: false,
            minimizer: [new TerserPlugin()],
        },
        output: {
            filename: '[name].min.js',
            chunkFilename: '[name].[chunkhash].min.js',
            path: distOptions.path,
            publicPath: distOptions.publicPath,
            clean: true,
        },
        module: {
            rules: [
                {
                    test: /\.m?js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env'],
                            cacheDirectory: true,
                        },
                    },
                },
                {
                    test: /\.css$/i,
                    use: ['style-loader', 'css-loader'],
                },
                {
                    test: /\.svg$/,
                    type: 'asset',
                },
            ],
        },
    };
};
