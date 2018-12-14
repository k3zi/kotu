const _ = require('lodash');
const express = require('express');
const Fuse = require('fuse.js');
const { check, body, validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
const MeCab = new require('mecab-async');
const moji = require('moji');
const rescue = require('express-rescue');

let router = express.Router();
module.exports = function(passThrough) {
    const { data, helpers, models, ac, config } = passThrough;
    router.use(function (req, res, next) {
        if (config.security.disableAuth) {
            return next();
        }

        if (!req.isAuthenticated() || !req.user || !req.user.active) {
            return res.json(helpers.outputError('You do not have permission to manage data points.'));
        }

        next();
    });

    router.get('/accents', (req, res, next) => {
        if (!ac.can(req.user.role).updateAny('accent').granted) {
            return next('You do not have permission to manage accents.')
        }

        return res.render('pages/manage/accents');
    });

    router.get('/users', (req, res, next) => {
        if (!ac.can(req.user.role).updateAny('user').granted) {
            return next('You do not have permission to manage accents.')
        }

        return res.render('pages/manage/users');
    });

    return router;
};
