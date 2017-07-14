const path = require("path")
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin")

const config = {
    entry: ["./web/static/css/app.css", "./web/static/js/app.js"],
    output: {
        path: path.resolve(__dirname, "priv/static"),
        filename: "js/app.js"
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".jsx"],
        modules: ["deps", "node_modules"]
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: ["babel-loader", "ts-loader"]
            },
            {
                test: /\.jsx?$/,
                use: "babel-loader"
            },
            {
                test: /\.css$/,
                use: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: "css-loader"
                })
            },
            {
                test: /\.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
                loader: 'file-loader?name=fonts/[name].[ext]'
            },
        ]
    },
    plugins: [
        new ExtractTextPlugin("css/app.css"),
        new CopyWebpackPlugin([{ from: "./web/static/assets" }])
    ]
};

module.exports = config;
