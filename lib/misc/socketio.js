'use strict';

// Load redis config from secrets.js or environment variables
let redisConfig;
try {
	const secrets = require(__dirname+'/../../configs/secrets.js');
	redisConfig = secrets.redis;
} catch (e) {
	redisConfig = {
		host: process.env.REDIS_HOST,
		port: parseInt(process.env.REDIS_PORT) || 6379,
		password: process.env.REDIS_PASSWORD,
		db: 0
	};
}

const { Boards } = require(__dirname+'/../../db/')
	, roomRegex = /^(?<roomBoard>[a-z0-9]+)-(?<roomName>[a-z0-9-]+)$/i
	, calcPerms = require(__dirname+'/../permission/calcperms.js')
	, { Permissions } = require(__dirname+'/../permission/permissions.js')
	, socketIO = require('socket.io')
	, createAdapter = require('@socket.io/redis-adapter')
	, Redis = require('ioredis')
	, { Cluster } = require('ioredis');

module.exports = {

	io: null, //null to begin with

	connect: (server, sessionMiddleware) => {
		//create socket.io without Redis adapter for lower latency
		const io = socketIO(server);
		// Note: Redis adapter disabled for lower latency on single instance
		//setup the middleware for sessions on socket
		const sessionRefresh = require(__dirname+'/../middleware/permission/sessionrefresh.js');
		io.use((socket, next) => {
			sessionMiddleware(socket.request, socket.request, next);
		});
		io.use((socket, next) => {
			sessionRefresh(socket.request, socket.request, next);
		});
		module.exports.io = io;
		//start accepting connections
		module.exports.startRooms();
	},

	startRooms: () => {
		module.exports.io.on('connection', socket => {
			socket.on('ping', cb => {
				if (typeof cb === 'function') {
					cb();
				}
			});
			socket.on('room', async (room) => {

				//check if a valid formatted room name
				const roomMatch = room.match(roomRegex);
				if (roomMatch && roomMatch.groups) {
					const { roomBoard, roomName } = roomMatch.groups;

					let hasPermission = true;

					//permission to manage/globalmanage based on MANAGE_GLOBAL/BOARD permissions
					if (room === 'globalmanage-recent-raw'
						|| room === 'globalmanage-recent-hashed') {
						socket.request.locals.board = null;
						socket.request.locals.permissions = calcPerms(socket.request, socket.request);
						hasPermission = socket.request.locals.permissions.get(Permissions.MANAGE_GLOBAL_GENERAL);
					} else {
						/* unlike normal endpoints, we cant get board from params and compare staffBoards and ownerBoards
						to roomBoard, so we need to put this here, in the room event and use the internal calcPerms after,
						instead of using a io.use( calcPermsMiddleware() after sessionRefresh() */
						socket.request.locals.board = await Boards.findOne(roomBoard);
						socket.request.locals.permissions = calcPerms(socket.request, socket.request);
						if (roomName === 'manage-recent-hashed'
							|| roomName === 'manage-recent-raw') {
							hasPermission = socket.request.locals.permissions.get(Permissions.MANAGE_BOARD_GENERAL);
						}
					}

					//if raw, must have room permission AND raw ip permission
					if (room.endsWith('-raw')) {
						hasPermission = hasPermission && socket.request.locals.permissions.get(Permissions.VIEW_RAW_IP);
					}

					//user has perms to join
					if (hasPermission === true) {
						socket.join(room);
						return socket.send('joined');
					}

				}

				//invalid room or no perms
				socket.disconnect(true);

			});
		});
	},

	emitRoom: (room, event, message) => {
		if (!module.exports.io) {
			return; //not initialized or in process that doesnt emit these events
		}
		module.exports.io.to(room).emit(event, message);
	},

};
