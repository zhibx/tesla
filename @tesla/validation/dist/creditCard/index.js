"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.reset = exports.defaults = exports.getTypeInfo = exports.getType = exports.getTypes = exports.validate = exports.isExpired = exports.doesCvvMatchType = exports.isValidExpiryYear = exports.isValidExpiryMonth = exports.isValidCardNumber = exports.doesNumberMatchType = exports.luhn = exports.sanitizeNumberString = void 0;
var tslib_1 = require("tslib");
var merge_1 = tslib_1.__importDefault(require("lodash/merge"));
var VISA = 'VISA';
var MASTERCARD = 'MASTERCARD';
var AMEX = 'AMEX';
var DINERSCLUB = 'DINERSCLUB';
var DISCOVER = 'DISCOVER';
var JCB = 'JCB';
var UNIONPAY = 'UNIONPAY';
var MAESTRO = 'MAESTRO';
var testOrder = [VISA, MASTERCARD, AMEX, DINERSCLUB, DISCOVER, JCB, UNIONPAY, MAESTRO];
var defaultOptions = {
    cardTypes: (_a = {},
        _a[AMEX] = {
            cardPattern: /^3[47]\d*$/,
            cardType: AMEX,
            cvvPattern: /^\d{4}$/,
            expDate: true,
            gaps: [4, 10],
            lengths: [15],
            luhn: true,
            partialPattern: /^(3|34|37)$/,
        },
        _a[DINERSCLUB] = {
            cardPattern: /^3(0[0-5]|[689])\d*$/,
            cardType: DINERSCLUB,
            cvvPattern: /^\d{3}$/,
            expDate: true,
            gaps: [4, 10],
            lengths: [14],
            luhn: true,
            partialPattern: /^(3|3[0689]|30[0-5])$/,
        },
        _a[DISCOVER] = {
            cardPattern: /^(6011|65|64[4-9])\d*$/,
            cardType: DISCOVER,
            cvvPattern: /^\d{3}$/,
            expDate: true,
            gaps: [4, 8, 12],
            lengths: [16, 19],
            luhn: true,
            partialPattern: /^(6|60|601|6011|65|64|64[4-9])$/,
        },
        _a[JCB] = {
            cardPattern: /^(2131|1800|35)\d*$/,
            cardType: JCB,
            cvvPattern: /^\d{3}$/,
            expDate: true,
            gaps: [4, 8, 12],
            lengths: [16],
            luhn: true,
            partialPattern: /^(2|21|213|2131|1|18|180|1800|3|35)$/,
        },
        _a[MAESTRO] = {
            cardPattern: /^(50\d\d\d|5[6-9]\d\d\d|601[^1]\d|60[^1]\d|6[1,3,6-9]\d\d\d)\d*$/,
            cardType: MAESTRO,
            cvvPattern: /^\d{3}$/,
            expDate: false,
            gaps: [4, 8, 12],
            lengths: [12, 13, 14, 15, 16, 17, 18, 19],
            luhn: false,
            partialPattern: /^(5[0,6-9]?|6[0-1,3,6-9]?)\d*$/,
        },
        _a[MASTERCARD] = {
            cardPattern: /^(5[1-5]|222[1-9]|2[3-6]|27[0-1]|2720)\d*$/,
            cardType: MASTERCARD,
            cvvPattern: /^\d{3}$/,
            expDate: true,
            gaps: [4, 8, 12],
            lengths: [16],
            luhn: true,
            partialPattern: /^(5|5[1-5]|2|22|222|222[1-9]|2[3-6]|27[0-1]|2720)$/,
        },
        _a[UNIONPAY] = {
            cardPattern: /^62\d*$/,
            cardType: UNIONPAY,
            cvvPattern: /^\d{0,4}$/,
            expDate: false,
            gaps: [4, 8, 12],
            lengths: [16, 17, 18, 19],
            luhn: false,
            partialPattern: /^(6|62)$/,
        },
        _a[VISA] = {
            cardPattern: /^4\d*$/,
            cardType: VISA,
            cvvPattern: /^\d{3}$/,
            expDate: true,
            gaps: [4, 8, 12],
            lengths: [16, 18, 19],
            luhn: true,
            partialPattern: /^4/,
        },
        _a),
    expiryMonths: {
        max: 12,
        min: 1,
    },
    expiryYears: {
        max: 2200,
        min: 1900,
    },
    schema: {
        cardType: 'cardType',
        cvv: 'cvv',
        expiryMonth: 'expiryMonth',
        expiryYear: 'expiryYear',
        number: 'number',
    },
};
function clone(x) {
    if (!x) {
        return null;
    }
    var partialPattern = x.partialPattern.source;
    var cardPattern = x.cardPattern.source;
    var dupe = JSON.parse(JSON.stringify(x));
    dupe.partialPattern = partialPattern;
    dupe.cardPattern = cardPattern;
    return dupe;
}
function setupCardTypeAliases(type, aliases) {
    if (defaultOptions.cardTypes == null) {
        defaultOptions.cardTypes = {};
    }
    for (var i = 0; i < aliases.length; i += 1) {
        defaultOptions.cardTypes[aliases[i]] = defaultOptions.cardTypes[type];
    }
}
setupCardTypeAliases('VISA', ['vc', 'VC', 'visa']);
setupCardTypeAliases('MASTERCARD', ['mc', 'MC', 'mastercard', 'master card', 'MASTER CARD']);
setupCardTypeAliases('AMEX', [
    'ae',
    'AE',
    'ax',
    'AX',
    'amex',
    'american express',
    'AMERICAN EXPRESS',
    'americanexpress',
    'AMERICANEXPRESS',
]);
setupCardTypeAliases('DINERSCLUB', ['dinersclub']);
setupCardTypeAliases('DISCOVER', ['dc', 'DC', 'discover']);
setupCardTypeAliases('JCB', ['jcb']);
setupCardTypeAliases('UNIONPAY', ['up', 'UP', 'UNIONPAY']);
var originalDefaults = merge_1.default({}, defaultOptions);
var sanitizeNumberString = function (cardNumber) {
    if (typeof cardNumber !== 'string') {
        return '';
    }
    return cardNumber.replace(/[^\d]/g, '');
};
exports.sanitizeNumberString = sanitizeNumberString;
var luhn = function (cardNumber, type, options) {
    var settings = merge_1.default({}, defaultOptions.cardTypes, options);
    if (type == null || cardNumber == null) {
        return false;
    }
    var patterns = settings[type];
    if (!patterns) {
        return false;
    }
    if (!patterns.luhn) {
        return true;
    }
    if (/[^\d]+/.test(cardNumber) || typeof cardNumber !== 'string' || !cardNumber) {
        return false;
    }
    var nCheck = 0;
    var cDigit = '0';
    var nDigit = 0;
    var bEven = false;
    var value = cardNumber.replace(/\D/g, '');
    for (var n = value.length - 1; n >= 0; n -= 1) {
        cDigit = value.charAt(n);
        nDigit = parseInt(cDigit, 10);
        if (bEven) {
            nDigit *= 2;
            if (nDigit > 9) {
                nDigit -= 9;
            }
        }
        nCheck += nDigit;
        bEven = !bEven;
    }
    return nCheck % 10 === 0;
};
exports.luhn = luhn;
var doesNumberMatchType = function (number, type, options) {
    var settings = merge_1.default({}, defaultOptions.cardTypes, options);
    var patterns = settings[type];
    if (!number || !patterns) {
        return false;
    }
    return patterns.cardPattern.test(number);
};
exports.doesNumberMatchType = doesNumberMatchType;
var isValidCardNumber = function (number, type, options) {
    return exports.doesNumberMatchType(number, type, options) && exports.luhn(number, type, options);
};
exports.isValidCardNumber = isValidCardNumber;
var isValidExpiryMonth = function (month, type, options) {
    var patterns = merge_1.default({}, defaultOptions.expiryMonths, options);
    var settings = merge_1.default({}, defaultOptions.cardTypes, options);
    var cardSetting = settings[type] || {};
    if (patterns && !('expDate' in cardSetting)) {
        return true;
    }
    if (typeof month === 'string' && month.length > 2) {
        return false;
    }
    var value = Number(month);
    return value >= patterns.min && value <= patterns.max;
};
exports.isValidExpiryMonth = isValidExpiryMonth;
var isValidExpiryYear = function (year, type, options) {
    var patterns = merge_1.default({}, defaultOptions.expiryYears, options);
    var settings = merge_1.default({}, defaultOptions.cardTypes, options);
    var cardSetting = settings[type] || {};
    if (patterns && !('expDate' in cardSetting)) {
        return true;
    }
    if (typeof year === 'string' && year.length !== 4) {
        return false;
    }
    var value = ~~year;
    return value >= patterns.min && value <= patterns.max;
};
exports.isValidExpiryYear = isValidExpiryYear;
var doesCvvMatchType = function (number, type, options) {
    var settings = merge_1.default({}, defaultOptions.cardTypes, options);
    var patterns = settings[type];
    if (!patterns) {
        return false;
    }
    return patterns.cvvPattern.test(number + '');
};
exports.doesCvvMatchType = doesCvvMatchType;
var isExpired = function (month, year) {
    var monthVal = Number(month || 0);
    var yearVal = Number(year || 0);
    console.debug(monthVal);
    console.debug(yearVal);
    var expiration = new Date(yearVal, monthVal);
    return Date.now() >= expiration.getTime();
};
exports.isExpired = isExpired;
var validate = function (card, options) {
    var cardVal = card || {};
    var settings = merge_1.default({}, defaultOptions, options);
    var schema = settings.schema;
    if (schema == null) {
        return null;
    }
    var cardType = cardVal[schema.cardType];
    var number = exports.sanitizeNumberString(cardVal[schema.number]);
    var expiryMonth = cardVal[schema.expiryMonth];
    var expiryYear = cardVal[schema.expiryYear];
    var cvv = exports.sanitizeNumberString(cardVal[schema.cvv]);
    var customValidationFn = settings.customValidation;
    var customValidation;
    if (typeof customValidationFn === 'function') {
        customValidation = customValidationFn(cardVal, settings);
    }
    return {
        card: cardVal,
        customValidation: customValidation,
        isExpired: exports.isExpired(expiryMonth, expiryYear),
        validCardNumber: exports.isValidCardNumber(number, cardType, settings.cardTypes),
        validCvv: exports.doesCvvMatchType(cvv, cardType, settings.cardTypes),
        validExpiryMonth: exports.isValidExpiryMonth(expiryMonth, cardType, settings.expiryMonths),
        validExpiryYear: exports.isValidExpiryYear(expiryYear, cardType, settings.expiryYears),
    };
};
exports.validate = validate;
var getTypes = function (number, options) {
    var settings = merge_1.default({}, defaultOptions, options);
    var cardTypes = settings.cardTypes;
    var cardNumber = exports.sanitizeNumberString(number);
    var type;
    var value;
    var prefixResults = [];
    var exactResults = [];
    for (var i = 0; i < testOrder.length; i += 1) {
        type = testOrder[i];
        value = cardTypes ? cardTypes[type] : undefined;
        if (value == null) {
            continue;
        }
        if (cardNumber.length !== 0) {
            if (value.cardPattern.test(cardNumber)) {
                exactResults.push(clone(value));
            }
            else if (value.partialPattern.test(cardNumber)) {
                prefixResults.push(clone(value));
            }
        }
        else {
            prefixResults.push(clone(value));
        }
    }
    return exactResults.length ? exactResults : prefixResults;
};
exports.getTypes = getTypes;
var getType = function (number, options) {
    var cardData = exports.getTypes(number, options);
    return cardData.length ? cardData[0].cardType : null;
};
exports.getType = getType;
var getTypeInfo = function (type) {
    if (defaultOptions.cardTypes == null) {
        return defaultOptions.cardTypes;
    }
    return clone(defaultOptions.cardTypes[type]);
};
exports.getTypeInfo = getTypeInfo;
var defaults = function (options, overwrite) {
    var optionsVal = options || {};
    if (overwrite === true) {
        defaultOptions = merge_1.default({}, optionsVal);
    }
    else {
        defaultOptions = merge_1.default({}, defaultOptions, optionsVal);
    }
    return defaultOptions;
};
exports.defaults = defaults;
var reset = function () {
    defaultOptions = merge_1.default({}, originalDefaults);
    return defaultOptions;
};
exports.reset = reset;
exports.default = {
    defaults: exports.defaults,
    doesCvvMatchType: exports.doesCvvMatchType,
    doesNumberMatchType: exports.doesNumberMatchType,
    getType: exports.getType,
    getTypeInfo: exports.getTypeInfo,
    getTypes: exports.getTypes,
    isExpired: exports.isExpired,
    isValidCardNumber: exports.isValidCardNumber,
    isValidExpiryMonth: exports.isValidExpiryMonth,
    isValidExpiryYear: exports.isValidExpiryYear,
    luhn: exports.luhn,
    reset: exports.reset,
    sanitizeNumberString: exports.sanitizeNumberString,
    validate: exports.validate,
};
