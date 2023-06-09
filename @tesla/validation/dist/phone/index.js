"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var google_libphonenumber_1 = tslib_1.__importDefault(require("google-libphonenumber"));
exports.default = (function (phone, countryCode) {
    var phoneUtil = google_libphonenumber_1.default.PhoneNumberUtil.getInstance();
    var isValid = false;
    try {
        var number = phoneUtil.parse(phone, countryCode);
        isValid = phoneUtil.isValidNumber(number);
    }
    catch (err) {
        isValid = false;
        console.warn('Phone Number Validation Error Details: ', err);
    }
    return isValid;
});
