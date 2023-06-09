"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var constants_1 = tslib_1.__importDefault(require("./constants"));
exports.default = (function (postalCode, options) {
    var countryKey = (options && options.countryCode) || null;
    var regex = constants_1.default.DEFAULT;
    if (countryKey != null && countryKey in constants_1.default) {
        regex = constants_1.default[countryKey];
    }
    return regex.test(postalCode);
});
