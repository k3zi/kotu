const express = require('express');
const { check, body, validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
const Fuse = require('fuse.js');
const Promise = require("bluebird");
const MeCab = new require('mecab-async');
const moji = require('moji');
const _ = require('lodash');

const router = express.Router();

module.exports = function(passThrough) {
    const { ac, models, operatorAliases: Op, passport, data, helpers, Sequelize, status, rescue, config } = passThrough;

    router.use(function (req, res, next) {
        if (config.security.disableAuth) {
            return next();
        }

        if (!res.locals.isValidUser) {
            return res.status(status.UNAUTHORIZED).json(helpers.outputError('Data points can only be accessed by active users.'));
        }

        next();
    });

    router.use((req, res, next) => {
        if (!ac.can(req.user.role).updateAny('user').granted) {
            return res.status(status.UNAUTHORIZED).json(helpers.outputError('This data point can only be accessed by authorized users.'));
        }

        next();
    });

    router.get('/:offset/:limit/:filter?', [
        check('offset').exists().not().isEmpty().withMessage('is required'),
        check('limit').exists().not().isEmpty().withMessage('is required'),
    ], rescue(async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        const offset = req.params.offset;
        const limit = req.params.limit;
        const filter = req.params.filter;

        let where = {};
        if (filter) {
            where = {
                [Op.or]: [
                    {
                        username: {
                            [Op.like]: `${filter}%`
                        }
                    },
                    {
                        email: {
                            [Op.like]: `${filter}%`
                        }
                    },
                    {
                        nickname: {
                            [Op.like]: `${filter}%`
                        }
                    }
                ]
            };
        }

        const data = await models.User.findAndCountAll({
            where: where,
            offset: offset,
            limit: limit,
            order: [
                ['username', 'ASC']
            ]
        });

        res.json({
            result: data.rows,
            roles: config.roles,
            count: data.count,
            pages: Math.ceil(data.count / limit)
        });
    }));

    router.put('/:id', [
        check('id').exists().not().isEmpty().withMessage('is required'),
    ], rescue(async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        const id = req.params.id;
        const updatedValue = req.body;

        if (updatedValue.username) {
            let duplicateUser = await models.User.findOne({
                where: {
                    username: updatedValue.username
                }
            });

            if (duplicateUser && duplicateUser.id != id) {
                return res.status(401).json(helpers.outputError(config.messages.duplicateUsername));
            }
        }

        if (typeof updatedValue.last_login !== 'undefined') {
            delete updatedValue.last_login;
        }

        const user = await models.User.findByPk(id);
        await user.update(updatedValue, {
            user: req.user
        });

        res.json({
            result: user,
            message: 'Successfully updated user!'
        });
    }));

    router.delete('/:id', [
        check('id').exists().not().isEmpty().withMessage('is required'),
    ], rescue(async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        const id = req.params.id;

        const pair = await models.User.findByPk(id);
        await pair.destroy({
            user: req.user
        });

        res.json({
            result: pair,
            message: 'Successfully deleted user!'
        });
    }));

    router.get('/create', rescue(async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        const user = await models.User.create({
        }, {
            user: req.user
        });

        res.json({
            result: user,
            message: 'Successfully updated accent!'
        });
    }));

    return router;
};
