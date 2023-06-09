"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVatNumberFormat = exports.getVatNumberRegex = exports.isValidEUVatNumber = exports.isvalidVatNumber = void 0;
var vatNumberFormatMap = {
    AT: {
        business: {
            example: 'ATU12345678',
            format: /^ATU\d{8}$|^AT U\d{8}$|^\d{2}\s\d{3}\/\d{4}$|^EU/,
        },
    },
    BE: {
        business: {
            example: 'BE1234567890',
            format: /^BE\d{10}$|^BE\s0\d{9}$|^EU/,
        },
    },
    BG: {
        business: {
            example: 'BG1234567890',
            format: /^BG\d{9,10}$/,
        },
    },
    CH: {
        business: {
            example: 'CH123 123',
            format: /^(CH)?\d{3}(\s)?\d{3}$|^CHE-?\d{3}\.?\d{3}\.?\d{3}(\s)?(((HR\/?)?MWST)|((RC\/?)?(TVA|IVA)))?$/,
        },
    },
    CN: {
        business: {
            example: '1234567890',
            format: /^\w{8,30}$/,
        },
    },
    CY: {
        business: {
            example: 'CY12345678901',
            format: /^CY\d{11}$/,
        },
    },
    CZ: {
        business: {
            example: 'CZ1234567890',
            format: /^CZ\d{8,10}$/,
        },
    },
    DE: {
        business: {
            example: 'DE123456789',
            format: /^DE\d{9}$|^\d{11}$|^EU/,
        },
    },
    DK: {
        business: {
            example: 'DK12345678',
            format: /^(DK)?\d{8}$|^EU/,
        },
    },
    EE: {
        business: {
            example: 'EE123456789',
            format: /^EE\d{9}$/,
        },
    },
    EL: {
        business: {
            example: 'EL123456789',
            format: /^EL\d{9}$/,
        },
    },
    ES: {
        business: {
            example: 'ESA1234567A',
            format: /^(ES)?[A-Z0-9]\d{7}[A-Z0-9]$|^EU/,
        },
        private: {
            example: 'ESA1234567A',
            format: /^(ES)?[A-Z0-9]\d{7}[A-Z0-9]$|^EU/,
        },
    },
    FI: {
        business: {
            example: 'FI12345678',
            format: /^FI\d{8}$|^EU/,
        },
    },
    FR: {
        business: {
            example: 'FRAA123456789',
            format: /^FR[A-Z0-9]{2}\d{9}$|^EU/,
        },
    },
    GB: {
        business: {
            example: 'GB123456789',
            format: /^GB\d{9}$|^GB\d{12}$|^GB[A-Z]{2}\d{3}$|^EU/,
        },
    },
    GR: {
        business: {
            example: 'EL123456789',
            format: /^EL\d{9}$/,
        },
    },
    HR: {
        business: {
            example: '12345678901',
            format: /^\d{11}$/,
        },
        private: {
            example: '12345678901',
            format: /^\d{11}$/,
        },
    },
    HU: {
        business: {
            example: 'HU12345678',
            format: /^HU\d{8}$/,
        },
    },
    IE: {
        business: {
            example: 'IE1234567A',
            format: /^IE\d{7}[A-Z]{1,2}$|^IE\d[A-Z]\d{5}[A-Z]$|^IE\d\W\d{5}[A-Z]$|^EU/,
        },
    },
    IL: {
        business: {
            example: '512345678',
            format: /^5[\d]{8}$/,
        },
    },
    IN: {
        business: {
            example: '22AAAAA0000A1Z5',
            format: /^([0-2][0-9]|[3][0-8])[A-Z]{3}[ABCFGHLJPTK][A-Z]\d{4}[A-Z][A-Z0-9][Z][A-Z0-9]$/,
        },
    },
    IS: {
        business: {
            example: '4504013150',
            format: /^\d{10}$/,
        },
        private: {
            example: '1201743399',
            format: /^\d{10}$/,
        },
    },
    IT: {
        business: {
            example: 'IT12345678901',
            format: /^(IT)?\d{11}$|^EU/,
        },
        private: {
            example: 'BRDBRT83L19F205T',
            format: /^[A-Z0-9]{16}$/,
        },
    },
    LT: {
        business: {
            example: 'LT123456789012',
            format: /^LT\d{9,12}$/,
        },
    },
    LU: {
        business: {
            example: 'LU12345678',
            format: /^LU\d{8}$|^EU/,
        },
    },
    LV: {
        business: {
            example: 'LV12345678901',
            format: /^LV\d{11}$/,
        },
    },
    MT: {
        business: {
            example: 'MT12345678',
            format: /^MT\d{8}$/,
        },
    },
    NL: {
        business: {
            example: 'NL123456789B12',
            format: /^NL\d{9}B\d{2}$|^EU/,
        },
    },
    NO: {
        business: {
            example: 'NO 123 123 123 MVA',
            format: /^(NO)?\s?\d{3}\s?\d{3}\s?\d{3}\s?MVA$/,
        },
    },
    PL: {
        business: {
            example: 'PL1234567890',
            format: /^PL\d{10}$/,
        },
    },
    PT: {
        business: {
            example: 'PT123456789',
            format: /^PT\d{9}$|^EU/,
        },
        private: {
            example: 'PT123456789',
            format: /^PT\d{9}$|^EU/,
        },
    },
    RO: {
        business: {
            example: 'RO12345678',
            format: /^(RO)?\d{4,8}$/,
        },
    },
    SE: {
        business: {
            example: 'SE123456789012',
            format: /^SE\d{12}$|^EU/,
        },
    },
    SG: {
        business: {
            example: '201010405N',
            format: /^[A-Z0-9]{8,9}[A-Z]$/,
        },
    },
    SI: {
        business: {
            example: 'SI12345678',
            format: /^SI\d{8}$/,
        },
    },
    SK: {
        business: {
            example: 'SK1234567890',
            format: /^SK\d{10}$/,
        },
    },
};
function getVatSettings(countryCode, type) {
    if (countryCode == null || type == null) {
        return null;
    }
    var settings = vatNumberFormatMap[countryCode];
    if (settings == null) {
        console.warn('cannot validate vat number', { countryCode: countryCode });
        return null;
    }
    var specificType = settings[type];
    if (specificType == null) {
        console.warn('cannot validate vat number', { countryCode: countryCode, type: type });
        return null;
    }
    return specificType;
}
var isvalidVatNumber = function (countryCode, vatNumber, type) {
    var vatSettings = getVatSettings(countryCode, type);
    if (vatSettings == null) {
        return true;
    }
    if (vatNumber == null) {
        return false;
    }
    return Boolean(vatSettings.format.exec(vatNumber));
};
exports.isvalidVatNumber = isvalidVatNumber;
var isValidEUVatNumber = function (vatNumber, type) {
    var countryCodes = Object.keys(vatNumberFormatMap).filter(function (countryCode) {
        return [
            'AT',
            'BE',
            'BG',
            'CH',
            'CY',
            'CZ',
            'DE',
            'DK',
            'EE',
            'EL',
            'ES',
            'FI',
            'FR',
            'GB',
            'HR',
            'HU',
            'IE',
            'IT',
            'LT',
            'LU',
            'LV',
            'MT',
            'NL',
            'NO',
            'PL',
            'PT',
            'RO',
            'SE',
            'SI',
            'SK',
        ].indexOf(countryCode) !== -1;
    });
    for (var i = 0; i < countryCodes.length; i += 1) {
        if (exports.isvalidVatNumber(countryCodes[i], vatNumber, type)) {
            return true;
        }
    }
    return false;
};
exports.isValidEUVatNumber = isValidEUVatNumber;
var getVatNumberRegex = function (countryCode, type) {
    var vatSettings = getVatSettings(countryCode, type);
    if (vatSettings == null) {
        return /^\w*$/;
    }
    return vatSettings.format;
};
exports.getVatNumberRegex = getVatNumberRegex;
var getVatNumberFormat = function (countryCode, type) {
    var vatSettings = getVatSettings(countryCode, type);
    if (vatSettings == null) {
        return null;
    }
    return vatSettings.example;
};
exports.getVatNumberFormat = getVatNumberFormat;
