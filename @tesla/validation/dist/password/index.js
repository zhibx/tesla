"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (function (password) {
    var regex = /^(?=.*[a-z])(?=.*\d)[a-zA-Z0-9\d\S]{8,100}$/;
    return regex.test(password);
});
