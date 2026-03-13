const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')

module.exports = (env = {}, argv = {}) => {
  const isProd = argv.mode === 'production'
  const target = env.target || (isProd ? 'lib' : 'demo')
  const isLibBuild = target === 'lib'

  return {
    mode: isProd ? 'production' : 'development',
    entry: isLibBuild ? './src/lib/index.js' : './src/main.js',
    output: {
      path: path.resolve(__dirname, './dist'),
      publicPath: '/dist/',
      filename: 'vue-awesome-picker.js',
      clean: isLibBuild,
      library: isLibBuild ? 'VueAwesomePicker' : undefined,
      libraryTarget: isLibBuild ? 'umd' : undefined,
      umdNamedDefine: isLibBuild,
      globalObject: 'this'
    },
    externals: isLibBuild
      ? {
        vue: {
          commonjs: 'vue',
          commonjs2: 'vue',
          amd: 'vue',
          root: 'Vue'
        }
      }
      : undefined,
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        {
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: [
            'vue-style-loader',
            'css-loader'
          ]
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name][ext][query]'
          }
        }
      ]
    },
    resolve: {
      alias: {
        'vue$': 'vue/dist/vue.esm.js'
      },
      extensions: ['.js', '.vue', '.json']
    },
    plugins: [
      new VueLoaderPlugin()
    ],
    devServer: isLibBuild
      ? undefined
      : {
        static: {
          directory: path.resolve(__dirname)
        },
        devMiddleware: {
          publicPath: '/dist/'
        },
        historyApiFallback: true,
        hot: true,
        host: '0.0.0.0',
        allowedHosts: 'all',
        client: {
          overlay: true
        }
      },
    performance: {
      hints: false
    },
    optimization: isProd
      ? {
        minimizer: [
          new TerserPlugin({
            extractComments: false
          })
        ]
      }
      : undefined,
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map'
  }
}
