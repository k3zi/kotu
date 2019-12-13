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
                        }
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
                            [Op.like]: q
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
            model.dictionaries.common = data.dictionaries.common.map(d => {
                let siftedData = d.data.filter(x => {
                    // 0 = expression, 1 = reading, 5 = glossary
                    let expression = x[0];
                    let reading = x[1];

                    if (entry.entryKanjiElements && entry.entryKanjiElements.length) {
                        let kanjiPart = entry.entryKanjiElements.some(k => k.word == expression);
                        if (kanjiPart) {
                            return true;
                        }
                    }

                    let hiraganaPart = entry.entryReadingElements.some(r => r.word == expression || r.word == reading);
                    return hiraganaPart;
                });

                let fuse = new Fuse(siftedData, options);
                return {
                    provider: d.provider,
                    results: fuse.search(q)
                };
            }).filter(p => p.results.length);
            return res.render('pages/data_term', model);
        }).catch(next);
    });

    router.get('/accent/:kanji/:kana', [
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

    router.get('/accents/:offset/:limit/:filter?', [
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

    router.put('/accents/:id', [
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

    router.get('/accents/create', rescue(async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

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

        res.json({
            result: pair,
            message: 'Successfully updated accent!'
        });
    }));

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

    router.get('/status', function(req, res) {
        let result = helpers.outputResult('The server is doing fine.');
        res.json(result);
    });

    return router;
};
