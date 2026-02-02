import { dirname as _dirname, resolve as _resolve } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import webpack from 'webpack';
import { fileURLToPath } from 'url';
import { valid, major } from 'semver';
import { load } from 'cheerio';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import WebpackObfuscatorPlugin from 'webpack-obfuscator';

const { DefinePlugin, optimize } = webpack;
const __filename = fileURLToPath(import.meta.url);
const __dirname = _dirname(__filename);

// Lightweight .env loader (avoids extra deps)
const loadEnv = () => {
  const envPath = _resolve(__dirname, '.env');
  if (!existsSync(envPath)) {
    return {};
  }

  return readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return acc;
      }

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        return acc;
      }

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
};

const envVars = loadEnv();
const getEnv = (key) => process.env[key] || envVars[key];

// Loading the current package.json - will be used to determine version etc.
const packageJSON = JSON.parse(readFileSync(_resolve(__dirname, 'package.json'), 'utf8'));

// Validate package version is valid semver
if (!valid(packageJSON.version)) {
  throw new Error('Invalid package version - ' + packageJSON.version);
}

// Distribution options configure how build paths are going to be configured.
const getDistOptions = (mode) => {
  const fullVersion = packageJSON.version;
  const majorVersion = major(packageJSON.version);
  const cdnRoot = getEnv('DEPLOY_CDN');

  if (!cdnRoot && mode !== 'development') {
    throw new Error('DEPLOY_CDN must be set in .env (or environment) for CDN builds.');
  }

  switch (mode) {
    case 'development':
      return {
        path: _resolve(__dirname, 'dist'),
        publicPath: '',
      };
    case 'current':
      return {
        path: _resolve(__dirname, 'dist-cdn/v' + majorVersion + '/current/'),
        publicPath: cdnRoot + '/v' + majorVersion + '/current/',
      };
    case 'versioned':
      return {
        path: _resolve(__dirname, 'dist-cdn/' + fullVersion + '/'),
        publicPath: cdnRoot + '/' + fullVersion + '/',
      };
    default:
      throw new Error('Unknown distribution type provided in --dist!');
  }
};

// Webpack configuration
export default (env, argv) => {
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
    new DefinePlugin({
      FP_BUILD_VERSION: JSON.stringify(packageJSON.version),
      FP_HOMEPAGE: JSON.stringify(packageJSON.homepage),
      FP_ENV: JSON.stringify(mode),
      FP_DEBUG: JSON.stringify(debug),
    }),
    new optimize.LimitChunkCountPlugin({
      maxChunks: 1, // disable creating additional chunks
    }),
  ];

  // Development mode builds and development server specifics
  if (mode === 'development') {
    // Locate all E2E cases
    const caseFiles = [];
    readdirSync(_resolve(__dirname, 'test/html/')).forEach((file) => {
      const absPath = _resolve(__dirname, 'test/html/', file);
      const caseHtml = load(readFileSync(absPath));
      const publicName = file.replace('.tpl', '');

      plugins.push(
        new HtmlWebpackPlugin({
          template: _resolve(__dirname, 'test/html/', file),
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
        template: _resolve(__dirname, 'test/index.html'),
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
            from: _resolve(__dirname, 'test/static/'),
            to: _resolve(distOptions.path, 'static'),
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
        debugProtectionInterval: 0,
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
    performance:
      mode === 'production'
        ? {
            hints: 'warning',
            maxAssetSize: 350 * 1024,
            maxEntrypointSize: 350 * 1024,
          }
        : false,
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
          test: /\.scss$/i,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /\.svg$/,
          type: 'asset',
        },
      ],
    },
  };
};
