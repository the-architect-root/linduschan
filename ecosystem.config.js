const numCpus = require('os').cpus().length;
module.exports = {
	// Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
	apps : [{
		// Disabled build-worker to prevent static file regeneration causing stale content
		// name: 'build-worker',
		// script: 'worker.js',
		// cwd: '/home/alt/Desktop/jschan',
		// instances: 1,
		// autorestart: true,
		// watch: false,
		// max_memory_restart: '1G',
		// log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
		// env: {
		// 	NODE_ENV: 'production'
		// },
		// env_development: {
		// 	NODE_ENV: 'production'
		// },
		// env_production: {
		// 	NODE_ENV: 'production'
		// }
	}, {
		name: 'chan',
		script: 'server.js',
		cwd: '/home/alt/jschan',
		instances: 1,
		autorestart: true,
		watch: false,
		max_memory_restart: '1G',
		log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
		wait_ready: true,
		kill_timeout: 5000,
		env: {
			NODE_ENV: 'production'
		},
		env_production: {
			NODE_ENV: 'production'
		}
	}, {
		name: 'schedules',
		script: 'schedules/index.js',
		cwd: '/home/alt/jschan',
		instances: 1,
		autorestart: true,
		watch: false,
		max_memory_restart: '1G',
		log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
		env: {
			NODE_ENV: 'production'
		},
		env_development: {
			NODE_ENV: 'production'
		},
		env_production: {
			NODE_ENV: 'production'
		}
	}]
};
