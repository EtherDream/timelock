export default {
  entry: './src/index.ts',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.wgsl$/,
        type: 'asset/source',
      },
      {
        test: /\.wasm$/,
        type: 'asset/inline',
        generator: {
          // no `data:` prefix
          dataUrl: content => content.toString('base64')
        }
      },
    ],
  },
  resolve: {
    extensions: ['.ts'],
  },
  experiments: {
    outputModule: true,
  },
  output: {
    filename: 'index.js',
    path: import.meta.dirname + '/dist',
    library: {
      type: "module",
    },
  },
}