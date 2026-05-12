'use strict';

const Mongo = require(__dirname+'/../../../db/db.js')
	, { Posts } = require(__dirname+'/../../../db/')
	, { Permissions } = require(__dirname+'/../../permission/permissions.js')
	, config = require(__dirname+'/../../misc/config.js');

module.exports = async (req, res) => {
	// Flood protection completely disabled
	return false;
};
