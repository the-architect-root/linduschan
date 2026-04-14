'use strict';

const csrf = require('csurf')({
	cookie: false,
	ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
});

module.exports = csrf;
