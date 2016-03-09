const fetch = require('node-fetch');
const url = require('url');
const DFLOW = require('debug')('ghcst:flow');
const DDATA = require('debug')('ghcst:data');


const FULLPATH_RE = /^([\w-]+)\/([\w-]+)$/;
// only include official release (no meta)
const VERSION_RE = /^v?\d+.\d+.\d+$/;

/**
 * Normalize Response to JSONified body or Error
 *
 * @param  {Response} res Response from `fetch()`
 * @return {Promise}      Promise for JSON on success; Promise for Error on fail
 */
function _handleResponse (res) {
  if (res.status !== 200) {
    return new Promise((resolve, reject) => {
      res.json().then((body) => {
        DFLOW('%s: %s', body.message, url.parse(res.url).path);
        return reject(new Error(body.message));
      });
    });
  } else {
    return res.json();
  }
}

/**
 * Transform result from `getRepoCommitsSinceTag()` to result schema
 * @param  {Object} result result from `getRepoCommitsSinceTag()`
 * @return {Result}        result that follows result schema
 */
function _transformResult (result) {
  return {
    repo: result.repo.full_name,
    tag: result.tag.name,
    numCommits: result.commits.length,
    commits: result.commits.map(commit => {
      return {
        author: commit.author,
        message: commit.message
      };
    })
  };
}

function GHcst (opts) {
  if (!opts.user || !opts.token) {
    throw new Error('user or token missing');
  }

  this.ROOTURL = `https://${opts.user}:${opts.token}@api.github.com`;
}

/**
 * Given a repo full name, get the commits since the last version tag
 * @param  {String} fullName repo to query (in `owner/repo` format)
 * @return {Promise}         Promise for result that follows result schema
 */
GHcst.prototype.commitsForRepo = function (fullName) {
  if (!FULLPATH_RE.test(fullName)) {
    return Promise.reject(new Error(`incorrect format: ${fullName}`));
  }
  return fetch(`${this.ROOTURL}/repos/${fullName}`)
    .then(_handleResponse)
    .then(repo => {
      if (repo.fork) {
        return Promise.reject(new Error(`ignoring forked repo`));
      }
      return repo;
    })
    .then(repo => {
      return this.getLatestTag(repo);
    })
    .then(result => {
      if (!result.tag) {
        return Promise.reject(new Error(`repo has no version tag`));
      }
      return result;
    })
    .then(result => {
      return this.getRepoCommitsSinceTag(result.repo, result.tag);
    })
    .then(result => {
      return _transformResult(result);
    })
    .catch(err => {
      throw err;
    });
};

/**
 * Given an owner, get the commits since the last version tag for each of the owner's non-fork repo
 * @param  {String} owner owner to query
 * @return {Promise}      Promise for array of results that follows result schema
 */
GHcst.prototype.commitsForOwner = function (owner) {
  return fetch(`${this.ROOTURL}/users/${owner}/repos`)
    .then(_handleResponse)
    .then(repos => {
      DFLOW(`${repos.length} repos before filter`);
      // filter repos
      return repos
        .filter(repo => !repo.fork);
    })
    .then(repos => {
      return Promise.all(repos.map(this.getLatestTag.bind(this)));
    })
    .then(results => {
      // filter those with no tag
      return results.filter(result => result.tag);
    })
    .then(results => {
      DFLOW(`${results.length} repos after filter`);
      return Promise.all(results.map(result => this.getRepoCommitsSinceTag(result.repo, result.tag)));
    })
    .then(results => {
      // filter those with no commits after tag
      return results.filter(result => result.commits.length);
    })
    .then(results => {
      return results.map(_transformResult);
    })
    .catch(err => {
      throw err;
    });
};

/**
 * Get the latest tag of a repo, return `undefined` as tag on fail
 *
 * @param  {Object} repo repo returned from GitHub API
 * @return {Promise}     Promise for `{repo, tag}`
 */
GHcst.prototype.getLatestTag = function (repo) {
  return new Promise((resolve, reject) => {
    fetch(`${this.ROOTURL}/repos/${repo.full_name}/tags`)
      .then(_handleResponse)
      .then(tags => {
        DFLOW(`[${repo.full_name}] ${tags.length} tags`);
        if (tags.length) {
          DDATA(tags);
        }
        resolve({
          repo: repo,
          tag: tags.find(tag => VERSION_RE.test(tag.name))
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

/**
 * Get the commits of a repo since the tag
 *
 * @param  {Object} repo repo returned from GitHub API
 * @param  {Object} tag  tag returned from GitHub API
 * @return {Promise}     Promise for `{repo, tag, commits}`,
 *                       `commits` is a collection of the `commit` field in the
 *                       commit object returned from GitHub API
 */
GHcst.prototype.getRepoCommitsSinceTag = function (repo, tag) {
  return new Promise((resolve, reject) => {
    fetch(`${this.ROOTURL}/repos/${repo.full_name}/commits/${tag.commit.sha}`)
      .then(_handleResponse)
      .then(commit => {
        fetch(`${this.ROOTURL}/repos/${repo.full_name}/commits?since=${commit.commit.author.date}`)
          .then(_handleResponse)
          .then(commits => {
            commits.pop(); // the last commit IS the one being tagged
            DFLOW('[%s] %d commits after tag %s', repo.full_name, commits.length, tag.name);
            if (commits.length) {
              DDATA(commits);
            }
            resolve({repo: repo, tag: tag, commits: commits.map(commit => commit.commit)});
          })
          .catch(err => {
            reject(err);
          });
      })
      .catch(err => {
        reject(err);
      });
  });
};

module.exports = GHcst;
