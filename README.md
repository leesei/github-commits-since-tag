# github-commits-since-tag

[![js-semistandard-style](https://cdn.rawgit.com/flet/semistandard/master/badge.svg)](https://github.com/Flet/semistandard)

Get commits of GitHub repo since the last version tag with GitHub API.  

Equivalent to this in a local git repo:
```sh
git log <yourlasttag>..HEAD
```

## Why?

When there are many small (possibly inter-dependent) repos, we may forgot to tag and publish the repos after commits and PR.  
This library list the commits since the last tagging. We can then evaluate the commits and determine whether we should create a new release for the repo.

I assume:  
1. each tagging is followed by an `npm publish` (see [`npmpub`](https://gist.github.com/leesei/73f5d9d847ae47d05927))  
2. tagging follows [SemVer](http://semver.org/), versions with meta are considered unofficial and ignored  
3. forks are not to be tracked

## Install

```sh
npm i github-commits-since-tag
```

## Usage

GitHub imposes a [per IP rate limit](https://developer.github.com/v3/#rate-limiting) on GitHub API requests, you need a [Personal access tokens](https://github.com/settings/tokens) to enjoy higher rates. A token with no specific role should suffice.

```js
// instance creation
const GHcst = require('github-commits-since-tag');
const ghcst = new GHcst({
  user: 'GitHub username',
  token: 'GitHub token'
});

// list specific repo (accessibility depends on token)
// rejected upon invalid repo, forked repo, repo without tag
ghcst.commitsForRepo('github/hub')
  .then(result => console.log(result))
  .catch(err => console.log(err));

// list all repo (accessibility depends on token)
// ignore forked repo, repo without tag
ghcst.commitsForOwner('github')
  .then(results => console.log(results))
  .catch(err => console.log(err));
```

### Debug logs

Supported DEBUG tags: *ghcst:flow*, *ghcst:data*.  
See [visionmedia/debug](https://github.com/visionmedia/debug/) for details.
