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

module.exports = function(passThrough) {
    const router = express.Router();
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

    router.use('/accents', require('./accents')(passThrough));
    router.use('/users', require('./users')(passThrough));

    router.get('/search/:q', [
        check('q').exists().not().isEmpty().withMessage('is required'),
    ], (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        let q = req.params.q;
        let options = {
            threshold: 0.1,
            location: 0,
            maxPatternLength: 32,
            minMatchCharLength: 1
        };

        let promise;
        if (q.match(config.isJapanese)) {
            promise = models.JMdictEntry.findAll({
                where: {
                    [Op.or]: [
                        {
                            '$entryKanjiElements.word$': q
                        },
                        {
                            '$entryKanjiElements.kanjiRestrictedReadingElements.word$': q
                        },
                        {
                            '$entryReadingElements.word$': q
                        },
                    ]
                },
                include: helpers.includeAllEntry
            });
        } else {
            promise = models.JMdictSenseElement.findAll({
                include: [{
                    model: models.JMdictSenseGlossElement,
                    as: 'glosses',
                    required: true,
                    where: {
                        value: {
                            [Op.like]: `%${q}%`
                        }
                    }
                }, {
                    model: models.JMdictEntry,
                    as: 'parentEntry'
                }]
            }).then(senses => {
                senses.length = Math.min(senses.length, 25);
                return models.JMdictEntry.findAll({
                    where: {
                        id: senses.map(s => s.parentEntry.id)
                    },
                    include: helpers.includeAllEntry
                });
            });
        }

        promise.then(results => {
            results.length = Math.min(results.length, 25);
            results = results.map(helpers.resultMapping).sort((a, b) => a.title.length - b.title.length);
            res.json(helpers.outputResult(`Successfully found ${results.length} results.`, results));
        }).catch(next);
    });

    router.get('/term/:id', [
        check('id').exists().not().isEmpty().withMessage('is required')
    ], (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        let id = req.params.id;
        models.JMdictEntry.findByPk(id, {
            include: helpers.includeAllEntry
        }).then(entry => {
            console.log(`Loaded entry: ${entry.id}`);
            let audioOptions = {
                shouldSort: true,
                threshold: 0.6,
                location: 0,
                distance: 20,
                maxPatternLength: 32,
                minMatchCharLength: 1,
                keys: ['path', 'kanji', 'hiragana']
            };

            let options = {
                shouldSort: true,
                threshold: 0.6,
                location: 0,
                distance: 20,
                maxPatternLength: 32,
                minMatchCharLength: 1,
                keys: [0]
            };

            let model = {};
            let q = (entry.entryKanjiElements && entry.entryKanjiElements.length) ? entry.entryKanjiElements.word : entry.entryReadingElements.word;

            model.entry = helpers.resultMapping(entry);
            model.audio = [
                {
                    provider: 'Forvo (KKLC)',
                    results: data.audio.kklc.filter(x => x.jmdicte_id == id)
                },
                {
                    provider: 'JDIC',
                    results: (new Fuse(data.audio.jdic.filter(x => x.jmdicte_id == id), audioOptions)).search(q)
                }
            ].filter(p => p.results.length);

            model.accent = helpers.parseAccents(entry.entryAccents);

            model.dictionaries = {};
            model.dictionaries.wisdom = data.dictionaries.wisdom_j.filter(x => x.jmdicte_id == id);
            model.dictionaries.common = data.dictionaries.searchCommon(entry);
            return res.render('pages/data_term', model);
        }).catch(next);
    });

    router.post('/parse', [
        check('q').exists().not().isEmpty().withMessage('is required')
    ], (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        let q = req.params.q;
        ktaccent.parse(q, function (result) {
            return res.json(result);
        });
    });

    return router;
};
