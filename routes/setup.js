const config = require('config');
const express = require('express');
const LocalStrategy = require('passport-local').Strategy;
const Cryptr = require('cryptr');
const path = require('path');
const icons = require("evil-icons");
const cryptr = new Cryptr(config.security.frontFacingKey);
const _ = require("lodash");

let router = express.Router();
module.exports = function(passThrough) {
    const { models, operatorAliases: Op, passport, helpers } = passThrough;

    passport.use(new LocalStrategy(function (username, password, done) {
        return models.User.findOne({
            where: {
                [Op.or]: [
                    {
                        username: username
                    },
                    {
                        email: username
                    }
                ]
            }
        }).then(async user => {
            if (!user || !(await user.validPassword(password))) {
                return done(null, false, { message: 'Incorrect username/password.' });
            }

            return done(null, user);
        }).catch(done);
    }));

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
        models.User.findByPk(id).then(user => {
            done(null, user);
        }).catch(error => {
            done(error, null);
        });
    });

    router.use(function (req, res, next) {
        res.locals.login = req.isAuthenticated();
        if (typeof req.user !== 'undefined') {
            res.locals.user = req.user.get({
                plain: true
            });
        }

        res.locals.encryptor = cryptr;
        res.locals.encodeURIComponent = encodeURIComponent;
        res.locals.encodeURI = encodeURI;
        res.locals.dataFolder = path.join(config.directory.server, 'data');
        res.locals.icons = icons;
        res.locals._ = _;
        next();
    });

    return router;
};
