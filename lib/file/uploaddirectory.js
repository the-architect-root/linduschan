'use strict';

const path = require('path')
	, directory = process.env.UPLOAD_DIR || path.join(__dirname, '/../../static');

module.exports = directory;
