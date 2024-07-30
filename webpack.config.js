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
        test: /\.(glsl|wgsl)$/,
        type: 'asset/source',
      },
      {
        test: /\.wasm$/,
        type: 'asset/inline',
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