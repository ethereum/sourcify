const merge = require('webpack-merge');
const common = require("./webpack.common.js");

module.exports = merge(common, {
    mode: 'development',
    devtool: "eval-cheap-module-source-map",
    module: {
        rules: [
            {
                test: /\.s[ac]ss$/i,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader'
                ]
            }
        ]
    },
    devServer: {
        historyApiFallback: true,
        port: '3001',
        disableHostCheck: true,
        hot: true,
        host: 'localhost',
        open: true
    }
});