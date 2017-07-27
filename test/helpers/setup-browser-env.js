const browserEnv = require("browser-env");
browserEnv();

// Needed to test CodeMirror 
// https://discuss.codemirror.net/t/working-in-jsdom-or-node-js-natively/138
document.createRange = function () {
    return {
        setEnd: function () { },
        setStart: function () { },
        getBoundingClientRect: function () {
            return { right: 0 };
        },
        getClientRects: function () {
            return {
                length: 0,
                left: 0,
                right: 0
            };
        }
    }
};