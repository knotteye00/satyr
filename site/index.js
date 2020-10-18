async function render(path, s){
	var context = await getContext();
	if(!s)
		history.pushState({}, context.sitename, location.protocol+'//'+location.host+path);
	switch(path){
		//nothing but context
		case (path.match(/^\/about\/?$/) || {}).input: 
			document.body.innerHTML = nunjucks.render('about.njk', context);
			modifyLinks();
			break;
		case (path.match(/^\/login\/?$/) || {}).input:
			document.body.innerHTML = nunjucks.render('login.njk', context);
			modifyLinks();
			break;
		case (path.match(/^\/register\/?$/) || {}).input:
			if(!context.registration) window.location = '/';
			document.body.innerHTML = nunjucks.render('registration.njk', context);
			modifyLinks();
			break;
		case (path.match(/^\/changepwd\/?$/) || {}).input:
			document.body.innerHTML = nunjucks.render('changepwd.njk', context);
			modifyLinks();
			break;
		case (path.match(/^\/chat\/?$/) || {}).input:
			document.body.innerHTML = nunjucks.render('chat.html', context);
			modifyLinks();
			break;
		case (path.match(/^\/help\/?$/) || {}).input:
			document.body.innerHTML = nunjucks.render('help.njk', context);
			modifyLinks();
			break;
		//need to hit the API
		case (path.match(/^\/users\/live\/?$/) || {}).input:
			var list = JSON.parse(await makeRequest("POST", "/api/users/live", JSON.stringify({num: 50})));
			document.body.innerHTML = nunjucks.render('live.njk', Object.assign({list: list.users}, context));
			modifyLinks();
			break;
		case (path.match(/^\/users\/?$/) || {}).input:
			var list = JSON.parse(await makeRequest("POST", "/api/users/all", JSON.stringify({num: 50})));
			document.body.innerHTML = nunjucks.render('list.njk', Object.assign({list: list.users}, context));
			modifyLinks();
			break;
		case (path.match(/^\/profile\/chat\/?$/) || {}).input:
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
			modifyLinks();
			break;
		case (path.match(/^\/profile\/?$/) || {}).input:
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
			modifyLinks();
			break;
		//parsing slugs
		case (path.match(/^\/invite\//) || {}).input: // /invite/:code
			document.body.innerHTML = nunjucks.render('invite.njk', Object.assign({icode: path.substring(8)}, context));
			modifyLinks();
			break;
		//slugs and API
		case (path.match(/^\/users\/.+\/?$/) || {}).input: // /users/:user
			if(path.substring(path.length - 1).indexOf('/') !== -1)
			var usr = path.substring(7, path.length - 1);
			else var usr = path.substring(7);
			var config = JSON.parse(await makeRequest("GET", '/api/'+usr+'/config'));
			if(!config.title){document.body.innerHTML = nunjucks.render('404.njk', context); break;}
			document.body.innerHTML = nunjucks.render('user.njk', Object.assign({about: config.about, title: config.title, username: config.username}, context));
			modifyLinks();
			initPlayer(usr);
			break;
		case (path.match(/^\/vods\/.+\/manage\/?$/) || {}).input: // /vods/:user/manage
			var usr = path.substring(6, (path.length - 7));
			if(context.auth.name !== usr) window.location = '/vods/'+usr;
			var vods = JSON.parse(await makeRequest("GET", '/api/'+usr+'/vods'));
			document.body.innerHTML = nunjucks.render('managevods.njk', Object.assign({user: usr, list: vods.vods.filter(fn => fn.name.endsWith('.mp4'))}, context));
			modifyLinks();
			break;
		case (path.match(/^\/vods\/.+\/?$/) || {}).input: // /vods/:user
			if(path.substring(path.length - 1).indexOf('/') !== -1)
			var usr = path.substring(6, path.length - 1);
			else var usr = path.substring(6);
			var vods = JSON.parse(await makeRequest("GET", '/api/'+usr+'/vods'));
			document.body.innerHTML = nunjucks.render('vods.njk', Object.assign({user: usr, list: vods.vods.filter(fn => fn.name.endsWith('.mp4'))}, context));
			modifyLinks();
			break;
		//root
		case "/":
			render('/users/live');
			break;
		case "":
			render('/users/live');
			break;	
		case "/index.html":
			render('/users/live');
			break;
		//404
		default:
			document.body.innerHTML = nunjucks.render('404.njk', context);
			modifyLinks();
	}
}

window.addEventListener('popstate', (event) => {
	render(document.location.pathname, true);
});

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

function modifyLinks() {
	for (var ls = document.links, numLinks = ls.length, i=0; i<numLinks; i++){
		if(ls[i].href.indexOf(location.protocol+'//'+location.host) !== -1) {
			//should be a regular link
			ls[i].setAttribute('onclick', 'return internalLink(\"'+ls[i].href.substring((location.protocol+'//'+location.host).length)+'\")');
		}
	}
}

function internalLink(path){
	this.render(path);
	return false;
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

var shakaPolyFilled = false;
async function initPlayer(usr) {
  var manifestUri = document.location.protocol+'//'+document.location.host+'/live/'+usr+'/index.mpd';
  if(!shakaPolyFilled){
  	shaka.polyfill.installAll();
  	shakaPolyFilled = true;
  }
  // Create a Player instance.
  const video = document.getElementById('video');
  const player = new shaka.Player(video);
  // Listen for error events.
  player.addEventListener('error', onErrorEvent);

  // Try to load a manifest.
  // This is an asynchronous process.
  try {
	await player.load(manifestUri);
	// This runs if the asynchronous load is successful.
    console.log('The video has now been loaded!');
  } catch (e) {
    // onError is executed if the asynchronous load fails.
    onError(e);
  }
}

function onErrorEvent(event) {
  // Extract the shaka.util.Error object from the event.
  onError(event.detail);
}

function onError(error) {
  // Log the error.
  console.error('Error code', error.code, 'object', error);
}