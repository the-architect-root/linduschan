'use strict';

const cache = require(__dirname+'/../../redis/redis.js')
	, dynamicResponse = require(__dirname+'/../../misc/dynamic.js')
	, deleteTempFiles = require(__dirname+'/../../file/deletetempfiles.js')
	, config = require(__dirname+'/../../misc/config.js')
	, { Permissions } = require(__dirname+'/../../permission/permissions.js');

module.exports = async (req, res, next) => {

	const { vpnBlock, blockBypass, ipHeader, disableVpnPosting } = config.get;

	// Skip if VPN blocking is not active
	if (!disableVpnPosting) {
		return next();
	}

	// Skip for users with bypass permission
	if (res.locals.permissions.get(Permissions.BYPASS_VPN_BLOCK)) {
		return next();
	}

	// Skip for anonymizers (already handled separately)
	if (res.locals.anonymizer) {
		return next();
	}

	// Require IPHub API key for VPN detection
	if (!vpnBlock || !vpnBlock.apiKey) {
		deleteTempFiles(req).catch(console.error);
		const { __ } = res.locals;
		return dynamicResponse(req, res, 503, 'message', {
			'title': __('Configuration Required'),
			'message': __('VPN blocking is enabled but no API key is configured. Set an IPHub API key in global settings.'),
			'redirect': req.headers.referer || '/',
		});
	}

	const ip = req.headers[ipHeader] || req.headers['cf-connecting-ip'] || req.connection.remoteAddress;
	const ipClean = ip.includes(',') ? ip.split(',')[0].trim() : ip;

	try {
		// Check cache first
		let isVpn = await cache.get(`vpn:${ipClean}`);
		
		if (isVpn === null) {
			// Use IPHub API (free tier: 1000 requests/day)
			// Response: 0 = residential, 1 = VPN/proxy, 2 = both
			const response = await fetch(`http://v2.api.iphub.info/ip/${ipClean}`, {
				headers: {
					'X-Key': vpnBlock.apiKey
				},
				timeout: 5000
			});
			
			if (response.ok) {
				const data = await response.json();
				isVpn = data.block === 1 || data.block === 2;
				// Cache for 24 hours
				await cache.set(`vpn:${ipClean}`, isVpn, 86400);
			} else {
				// API error - allow post to avoid blocking legitimate users
				console.error('VPN check API error:', response.status);
				return next();
			}
		}

		if (isVpn) {
			deleteTempFiles(req).catch(console.error);
			const { __ } = res.locals;
			return dynamicResponse(req, res, 403, 'message', {
				'title': __('Forbidden'),
				'message': __('Posting from VPN/proxy is not allowed.'),
				'redirect': req.headers.referer || '/',
			});
		}

		return next();

	} catch (err) {
		console.error('VPN check error:', err);
		// On error, allow the request to proceed
		return next();
	}

};
