#!/usr/bin/env node
require('colors')
let path = require('path')
let express = require('express')
let { resolve, basename } = path
let fs = require('fs')
let rl = require('readline-sync')
let exec = (command) => new Promise((resolve, reject) => {
	let proc = require('child_process').exec(command)
	proc.stdout.pipe(process.stdout); proc.stderr.pipe(process.stderr);
	proc.on('close', (code) => {
		if (code == 0) 
			resolve()
		else
			reject("Unknown error!")
	})
})

require('yargs')
	.command('create [directory]', 'initialize an app', (yargs) => {
		yargs
			.positional('directory', {
				describe: 'directory to initialize project in',
				default: '.'
			})
	}, async (argv) => {
		let directory = resolve(argv.directory)
		let title = basename(directory).toLowerCase().split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
		let opts = {
			name: (rl.question(`app title (${title}): `) || title).toLowerCase().split(' ').join('-'),
			description: rl.question('app description: '),
			author: rl.question('author: '),
			license: rl.question('license (MIT): ') || "MIT",
		}
		opts.url = rl.question(`url (${opts.name}): `) || opts.name
		if (argv.directory == '.')
			console.log('Creating app.')
		else
			console.log('Creating app in ' + directory + '...')
		
		try {
			await exec('git clone --progress https://github.com/preyneyv/legacy-app-server-template.git ' + directory)
		} catch(e) {
			process.exit(1)
		}
		console.log("\nDownloaded template")
		console.log("Installing dependencies. This may take a while.")
		process.chdir(directory)

		// Remove
		await exec('rm -rf .git')
	
		let package = {
			...require(resolve(directory, 'package.json')),
			...opts
		}
		delete package['repository']
		let str = JSON.stringify(package, null, 2)
		fs.writeFileSync(resolve(directory, 'package.json'), str)

		await exec('npm install --progress')
		console.log("Dependencies installed!")
	})
	.command('serve [port]', 'serve the app in the current directory', (yargs) => {
		yargs
			.positional('port', {
				describe: 'port to start the server on',
				default: 3000
			})
	}, async (argv) => {
		let port = argv.port
		let projectDir = resolve('.')

		let watcher = require('chokidar').watch('./', {
			awaitWriteFinish: {
				stabilityThreshold: 15
			}
		})
		let server, client, admin
		function restartServer() {
			console.log()
			console.log('Restarting!'.cyan)
			Object.keys(require.cache)
			.forEach(id => {
				if (id.startsWith(projectDir)
				|| id.indexOf('body-parser') != -1) delete require.cache[id];
			})
			startServer()
			global.io = require('socket.io').listen(server)
		}
		function startServer() {
			if (server) server.close();
			const clientSessions = require('client-sessions')

			client = require(resolve('index.js'))
			client.app.use(express.json())
			client.app.use(express.urlencoded({extended: true}))

			admin = require(resolve('admin/index.js'))
			server = require('http').createServer(client.app)

			client.app.use((req, res, next) => {
				if (req.method != "GET") return next();
				if (req.url.endsWith('/')) {
					return next()
				} else {
					if (path.extname(req.url) == '') {
						// IT'S A ROUTE
						res.redirect(req.url + '/')
					} else {
						// IT'S A FILE
						return next()
					}
				}
			})
			client.app.use(clientSessions({
				cookieName: 'session',
				secret: 'legacy app server development'
			}))
			client.app.use((req, res, next) => {
				res.file = file => res.sendFile(path.resolve(projectDir, file))
				req.post = req.body
				req.get = req.query
				next()
			})
			admin.app.use((req, res, next) => {
				res.file = file => res.sendFile(path.resolve(projectDir, 'admin', file))
				next()
			})
			client.app.use('/admin/', admin.app)
			client.init()
			admin.init()
			server.listen(port, () => {
				console.log('Client server is at' + ` http://localhost:${port}/`.green)
				console.log('Admin server is at' + ` http://localhost:${port}/admin/`.green)
			})
		}
		watcher.on('ready', () => {
			process.on('uncaughtException', error => {
				console.error('AN ERROR OCCURED!'.red)
				console.error(error)
				console.log("Waiting for changes before restarting".yellow)
			})
			startServer()
		})
		watcher.on('all', restartServer)
	})
	.argv