const express = require('express');
const config = require('config');
const { check, body, validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
const Fuse = require('fuse.js');
const ktaccent = require(config.directory.server + '/../ktaccent/lib/ktaccent');
const Promise = require("bluebird");
const MeCab = new require('mecab-async');
const moji = require('moji');
const _ = require('lodash');

const router = express.Router();

module.exports = function(passThrough) {
    const { models, operatorAliases: Op, passport, data, helpers, Sequelize, status, rescue } = passThrough;

    router.use(function (req, res, next) {
        if (config.security.disableAuth) {
            return next();
        }

        if (!res.locals.isValidUser) {
            return res.status(status.UNAUTHORIZED).json(helpers.outputError('Data points can only be accessed by active users.'));
        }

        next();
    });

    router.get('/search/:kanji/:kana', [
        check('kanji').exists().not().isEmpty().withMessage('is required'),
        check('kana').exists().not().isEmpty().withMessage('is required'),
    ], (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        let kanji = req.params.kanji;
        let kana = req.params.kana;
        let results = helpers.getAccentForKanjiKana(kanji, kana);
        res.json(helpers.outputResult(`Successfully found ${results.length} results.`, results));
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
                        accentEntryId: isNaN(filter) ? undefined : filter
                    },
                    {
                        kana: {
                            [Op.like]: `${moji(filter).convert('HG', 'KK').toString()}%`
                        }
                    },
                    {
                        kanji: {
                            [Op.contains]: [filter]
                        }
                    },
                    {
                        fullKanji: {
                            [Op.like]: `${filter}%`
                        }
                    }
                ]
            };
        }

        const data = await models.AccentJMDictPair.findAndCountAll({
            where: where,
            offset: offset,
            limit: limit,
            order: [
                ['kana', 'ASC']
            ]
        });

        res.json({
            result: data.rows,
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
        const updatedaValue = req.body;
        if (updatedaValue.accent) {
            updatedaValue.accent = updatedaValue.accent.map(a => {
                let justWord = a.accentString.replace(/\(|\)|\*/g, '');
                justWord = justWord.split('').filter(chr => helpers.smallKatakana.indexOf(chr) === -1).join('');
                let number = justWord.indexOf('＼');
                return {
                    accentString: a.accentString.replace(/\*/g, "\u309a"),
                    accentNumber: number < 0 ? 0 : number
                };
            });
        }

        if (!updatedaValue.accentEntryId || isNaN(updatedaValue.accentEntryId)) {
            delete updatedaValue.accentEntryId;
        }

        const pair = await models.AccentJMDictPair.findByPk(id);
        await pair.update(updatedaValue);

        res.json({
            result: pair,
            message: 'Successfully updated accent!'
        });
    }));

    router.get('/create', rescue(async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        console.log('creating new pair');
        const pair = await models.AccentJMDictPair.create({
            accent: [],
            accurate: false,
            fullKanji: '',
            kana: '',
            expression: '',
            kanji: [],
            notes: [],
            sources: []
        });
        console.log('created new pair');

        res.json({
            result: pair,
            message: 'Successfully updated accent!'
        });
    }));

    return router;
};
