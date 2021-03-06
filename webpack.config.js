// @flow

const path = require("path");

const webpack = require("webpack");

const entry = {};

// TODO: Generate this dynamically
const entries = [
    "AddSource",
    "AddSources",
    "AddUser",
    "AddUsers",
    "Admin",
    "EditRecord",
    "Error",
    "Home",
    "ImportImages",
    "ImportRecords",
    "Login",
    "ManageSources",
    "Record",
    "Search",
    "SourceAdmin",
    "Upload",
];

for (const file of entries) {
    entry[file] = path.resolve(__dirname, `src/entries/${file}.js`);
}

module.exports = {
    entry,

    mode: process.env.NODE_ENV === "production" ? "production" : "development",

    output: {
        filename: "[name].js",
        path: path.resolve(process.cwd(), "static", "js"),
    },

    resolve: {
        modules: [path.resolve(__dirname, "node_modules"), "node_modules"],
    },

    plugins: [
        new webpack.ProvidePlugin({
            fetch: "exports-loader?self.fetch!whatwg-fetch",
        }),
    ],

    optimization: {
        splitChunks: {
            chunks: "all",

            cacheGroups: {
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    priority: -10,
                    name: "vendor",
                },
                default: {
                    minChunks: 2,
                    priority: -20,
                    reuseExistingChunk: true,
                    name: "shared",
                },
            },
        },
    },

    module: {
        rules: [
            {
                test: /regenerator-runtime/,
                loader: path.resolve(__dirname, "node_modules", "null-loader"),
            },
            {
                test: /\.js$/,
                loader: path.resolve(__dirname, "node_modules", "babel-loader"),
                options: {
                    babelrcRoots: __dirname,
                },
            },
        ],
    },
};
