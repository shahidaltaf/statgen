'use strict';

var _ = require('underscore');
var fm = require('front-matter');
var fs = require('fs');
var handlebars = require('handlebars');
var marked = require('marked');
var mkdirp = require('mkdirp');
var moment = require('moment');

var config = require('./config');
var utils = require('./utils');

var siteData = {
    posts: [],
    pages: [],
    archive: [],
    tags: [],
    navigation: []
}

function build() {
    registerPartials()
    readMarkdownFiles();
    createAuxData();
    createAllPages();
}

function registerPartials() {
    fs.readdir(config().paths.includes, (err, files) => {
        if(err) return;

        files.forEach(file => {
            handlebars.registerPartial(file.split('.')[0], fs.readFileSync(config().paths.includes + file, 'utf8'));
        });
    })
}

function readMarkdownFiles() {
    if (utils.pathExists(config().paths.posts)) {
        fs.readdirSync(config().paths.posts).forEach(function (file) {
            if (file.split('.')[1] !== 'md') return;

            var data = fm(fs.readFileSync(config().paths.posts + file, 'utf8'));
            var post = data.attributes;

            post.Date = moment(post.date).format('MMM YYYY');
            post.shortDate = moment(post.date).format('DD MM');
            post.year = moment(post.date).format('YYYY');
            post.content = marked(data.body);

            _.each(post.tags, function (tag) {
                siteData.tags.push({
                    post: post,
                    tag: tag
                });
            });
            siteData.posts.push(post);
        });
    }
    if (utils.pathExists(config().paths.pages)) {
        fs.readdirSync(config().paths.pages).forEach(function (file) {
            if (file.split('.')[1] !== 'md') return;

            var data = fm(fs.readFileSync(config().paths.pages + file, 'utf8'));
            var page = data.attributes;

            page.content = marked(data.body);
            siteData.pages.push(page);
        });
    }
}

function createAuxData() {
    siteData.posts = _.sortBy(siteData.posts, 'date').reverse();
    siteData.recentPosts = siteData.posts.slice(0, config.recentPostLimit);

    var postsByTag = _.groupBy(siteData.tags, 'tag');
    siteData.tags = [];

    _.mapObject(postsByTag, function (val, key) {
        siteData.tags.push({
            name: key,
            posts: val
        });
    });

    var postsByYear = _.groupBy(siteData.posts, 'year');
    _.mapObject(postsByYear, function (val, key) {
        siteData.archive.push({
            posts: val,
            year: key
        });
    });

    siteData.archive.reverse();

    _.each(siteData.pages, function (page) {
        if (page.navigation) {
            siteData.navigation.push({
                active: false,
                order: page.order,
                slug: page.slug,
                title: page.navigationTitle,
                url: (page.slug === 'home') ? '/' : '/' + page.slug + '/'
            });
        }
    });
    siteData.navigation = _.sortBy(siteData.navigation, 'order');
}

function createAllPages() {
    _.each(siteData.pages, function (page) {
        var pageData = {
            archive: siteData.archive,
            config: config,
            navigation: siteData.navigation,
            page: page,
            recentPosts: siteData.recentPosts
        };

        _.each(siteData.navigation, function (item) {
            item.active = (item.slug == page.slug) ? true : false;
        });

        if (page.slug === 'index') {
            var path = config().paths.site;
            pageData.pageTitle = setPageTitle(config.siteTitle);
            pageData.showRecent = true;
            pageData.isHome = true;
        } else {
            var path = config().paths.site + page.slug + '/';
            pageData.pageTitle = setPageTitle(page.navigationTitle);
        }

        createPage({
            layout: page.layout,
            pageData: pageData,
            path: path
        });
    });

    _.each(siteData.posts, function (post) {
        var pageData = {
            config: config,
            navigation: siteData.navigation,
            pageTitle: setPageTitle(post.title),
            post: post,
            recentPosts: siteData.recentPosts
        };

        _.forEach(siteData.navigation, function (item) {
            item.active = false;
        });

        createPage({
            layout: post.layout,
            path: config().paths.site + post.year + '/' + post.slug + '/',
            pageData: pageData
        });
    });

    _.each(siteData.tags, function (tag) {
        var pageData = {
            config: config,
            navigation: siteData.navigation,
            pageTitle: setPageTitle('Tag: ' + tag.name),
            recentPosts: siteData.recentPosts,
            tag: tag
        };

        createPage({
            layout: 'tag',
            pageData: pageData,
            path: config().paths.site + '/tag/' + tag.name + '/'
        });
    });
}

function setPageTitle(title) {
    return title + ' - ' + config().author;
};

function createPage(data) {
    var layout = fs.readFileSync(config().paths.layouts + data.layout + '.html', 'utf-8');
    var template = handlebars.compile(layout);
    var html = template(data.pageData);

    mkdirp(data.path, function (err) {
        if (err) return console.log(err);

        fs.writeFile(data.path + 'index.html', html, function (err) {
            if (err) return err;
        });
    });
}

module.exports = build;