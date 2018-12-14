const config = require('config');
const express = require('express');
const LocalStrategy = require('passport-local').Strategy;
const { check, body, validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
const bcrypt = require('bcrypt');
const validator = require('validator');
const randomstring = require("randomstring");
const rescue = require('express-rescue');

let router = express.Router();
module.exports = function(passThrough) {
    const { models, operatorAliases: Op, passport, helpers } = passThrough;

    router.post('/login', [
        check('username').exists().not().isEmpty().withMessage('is required'),
        check('password').exists().not().isEmpty().withMessage('is required')
    ], (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        passport.authenticate('local', function(error, user, info) {
            if (error) {
                let result = helpers.outputError(error);
                return res.status(500).json(result);
            }

            if (!user) {
                return res.status(401).json(helpers.outputError(info ? info.message : "Invalid error object."));
            }

            req.logIn(user, function(err) {
                if (err) {
                    next(err);
                }

                res.json(helpers.outputResult(`You have successfully logged in!`, user));
            });
        })(req, res, next);
    });

    router.post('/register', [
        body('username').exists()
            .not().isEmpty().withMessage('is required')
            .not().isEmail().withMessage('can not be of email format')
            .trim()
            .isLength({ max: 20 }).withMessage('must be of length < 20'),
        body('password').exists()
            .not().isEmpty().withMessage('is required')
            .isLength({ min: 5, max: 30 }).withMessage('must be of 5 < length < 20'),
        body('email').isEmail().withMessage('must be valid email')
            .normalizeEmail(),
        body('nickname').exists()
            .not().isEmpty().withMessage('is required')
            .trim().isLength({ max: 27 }).withMessage('must be of length < 27'),
    ], rescue(async (req, res, next) => {
        const username = req.body.username;
        const password = await bcrypt.hash(req.body.password, config.security.saltRounds);
        const email = req.body.email;
        const nickname = req.body.nickname;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        console.log(`Find a user with username: ${username}`);
        let user = await models.User.findOne({
            where: {
                username: username
            }
        });

        if (user) {
            return res.status(401).json(helpers.outputError('A user with this username already exists.'));
        }

        console.log(`Find a user with email: ${email}`);
        user = await models.User.findOne({
            where: {
                email: email
            }
        });

        if (user) {
            return res.status(401).json(helpers.outputError('A user with this email already exists.'));
        }

        console.log(`Create a user with username: ${username}`);
        user = await models.User.create({
            username: username,
            password: password,
            email: email,
            nickname: nickname,
            one_time: randomstring.generate(config.security.lengthOfVerifyCode)
        }, {
            user: req.user
        });

        console.log(`Render email template.`);
        let message = helpers.render(config.directory.server + '/views/templates/verify-email.art', {
            verifyLink: config.site.url + '/user/verify/' + user.one_time
        });

        console.log(`Send email to user.`);
        let info = await helpers.sendMail(user.email, 'Verify Email Address', message);

        req.login(user, function(err) {
            res.json(helpers.outputResult(`You have successfully registered! Please verify your email by navigating to the link sent to: ${user.email}`, user));
        });
    }));

    return router;
};
