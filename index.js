#!/usr/bin/env node
let resolve = require('path').resolve
let basename = require('path').basename
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
		console.log("\nDownloaded template\nInstalling dependencies. This may take a while")
		process.chdir(directory)

		// Remove
		await exec('rm -rf .git')
	
		let package = JSON.stringify({
			...require(resolve(directory, 'package.json')),
			...opts
		}, null, 2)
		fs.writeFileSync(resolve(directory, 'package.json'), package)

		await exec('npm install --progress')
		console.log("Dependencies installed!")
	})
	.argv