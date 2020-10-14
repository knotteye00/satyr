async function render(){
	var context = await getContext();
	switch(window.location.pathname){
		//nothing but context
		case (window.location.pathname.match(/^\/about\/?$/) || {}).input: 
			document.body.innerHTML = nunjucks.render('about.njk', context);
			break;
		case (window.location.pathname.match(/^\/login\/?$/) || {}).input:
			document.body.innerHTML = nunjucks.render('login.njk', context);
			break;
		case (window.location.pathname.match(/^\/register\/?$/) || {}).input:
			if(!context.registration) window.location = '/';
			document.body.innerHTML = nunjucks.render('registration.njk', context);
			break;
		case (window.location.pathname.match(/^\/changepwd\/?$/) || {}).input:
			document.body.innerHTML = nunjucks.render('changepwd.njk', context);
			break;
		case (window.location.pathname.match(/^\/chat\/?$/) || {}).input:
			document.body.innerHTML = nunjucks.render('chat.html', context);
			break;
		case (window.location.pathname.match(/^\/help\/?$/) || {}).input:
			document.body.innerHTML = nunjucks.render('help.njk', context);
			break;
		//need to hit the API
		case (window.location.pathname.match(/^\/users\/live\/?$/) || {}).input:
			var list = JSON.parse(await makeRequest("POST", "/api/users/live", JSON.stringify({num: 50})));
			document.body.innerHTML = nunjucks.render('live.njk', Object.assign({list: list.users}, context));
			break;
		case (window.location.pathname.match(/^\/users\/?$/) || {}).input:
			var list = JSON.parse(await makeRequest("POST", "/api/users/all", JSON.stringify({num: 50})));
			document.body.innerHTML = nunjucks.render('list.njk', Object.assign({list: list.users}, context));
			break;
		case (window.location.pathname.match(/^\/profile\/chat\/?$/) || {}).input:
			if(!context.auth.name) window.location = '/login';
			var config = JSON.parse(await makeRequest("GET", '/api/'+context.auth.name+'/config'));
			config = {
				integ: {
					twitch: config.twitch,
					xmpp: config.xmpp,
					irc: config.irc,
					discord: config.discord
				}
			};
			document.body.innerHTML = nunjucks.render('chat_integ.njk', Object.assign(config, context));
			break;
		case (window.location.pathname.match(/^\/profile\/?$/) || {}).input:
			if(!context.auth.name) window.location = '/login';
			var config = JSON.parse(await makeRequest("GET", '/api/'+context.auth.name+'/config'));
			config = {
				meta: {
					title: config.title,
					about: config.about
				},
				rflag: {record_flag: config.record_flag},
				twitch: config.twitch_mirror
			};
			document.body.innerHTML = nunjucks.render('profile.njk', Object.assign(config, context));
			break;
		//parsing slugs
		case (window.location.pathname.match(/^\/invite\//) || {}).input: // /invite/:code
			document.body.innerHTML = nunjucks.render('invite.njk', Object.assign({icode: window.location.pathname.substring(8)}, context));
			break;
		//slugs and API
		case (window.location.pathname.match(/^\/users\/.+\/?$/) || {}).input: // /users/:user
			if(window.location.pathname.substring(window.location.pathname.length - 1).indexOf('/') !== -1)
			var usr = window.location.pathname.substring(7, window.location.pathname.length - 1);
			else var usr = window.location.pathname.substring(7);
			var config = JSON.parse(await makeRequest("GET", '/api/'+usr+'/config'));
			if(!config.title){document.body.innerHTML = nunjucks.render('404.njk', context); break;}
			document.body.innerHTML = nunjucks.render('user.njk', Object.assign({about: config.about, title: config.title, username: config.username}, context));
			break;
		case (window.location.pathname.match(/^\/vods\/.+\/manage\/?$/) || {}).input: // /vods/:user/manage
			var usr = window.location.pathname.substring(6, (window.location.pathname.length - 7));
			if(context.auth.name !== usr) window.location = '/vods/'+usr;
			var vods = JSON.parse(await makeRequest("GET", '/api/'+usr+'/vods'));
			document.body.innerHTML = nunjucks.render('managevods.njk', Object.assign({user: usr, list: vods.vods.filter(fn => fn.name.endsWith('.mp4'))}, context));
			break;
		case (window.location.pathname.match(/^\/vods\/.+\/?$/) || {}).input: // /vods/:user
			if(window.location.pathname.substring(window.location.pathname.length - 1).indexOf('/') !== -1)
			var usr = window.location.pathname.substring(6, window.location.pathname.length - 1);
			else var usr = window.location.pathname.substring(6);
			var vods = JSON.parse(await makeRequest("GET", '/api/'+usr+'/vods'));
			document.body.innerHTML = nunjucks.render('vods.njk', Object.assign({user: usr, list: vods.vods.filter(fn => fn.name.endsWith('.mp4'))}, context));
			break;
		//root
		case "/":
			window.location = '/users/live';
			break;
		case "":
			window.location = '/users/live';
			break;	
		//404
		default:
			document.body.innerHTML = nunjucks.render('404.njk', context);
	}
}

async function getContext(){
	var info = JSON.parse(await makeRequest('GET', '/api/instance/info'));
	info.sitename = info.name;
	info.name = null;
	info.auth = {
		is: document.cookie.match(/^(.*;)?\s*X-Auth-As\s*=\s*[^;]+(.*)?$/) !== null,
		name: parseCookie(document.cookie)['X-Auth-As']
	}
	return info;
}

function makeRequest(method, url, payload) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                resolve(xhr.response);
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        !payload ? xhr.send() : xhr.send(payload);
    });
}

function parseCookie(c){
	if(typeof(c) !== 'string' || !c.includes('=')) return {};
	return Object.assign({[c.split('=')[0].trim()]:c.split('=')[1].split(';')[0].trim()}, parseCookie(c.split(/;(.+)/)[1]));
}

function handleLoad() {
	var r = JSON.parse(document.getElementById('responseFrame').contentDocument.documentElement.textContent).success
	if (typeof(r) !== 'undefined') window.location.href = '/profile'
}