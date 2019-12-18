const express = require('express');
const config = require('config');
const { check, body, validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
const Fuse = require('fuse.js');
const MeCab = new require('mecab-async');
const moji = require('moji');
const _ = require('lodash');

let router = express.Router();
module.exports = function(passThrough) {
    const { data, helpers, models } = passThrough;
    router.use(function (req, res, next) {
        if (config.security.disableAuth) {
            return next();
        }

        if (!req.isAuthenticated() || !req.user || !req.user.active) {
            return res.json(helpers.outputError('Data points can only be accessed by active users.'));
        }

        next();
    });

    router.get('/term/:id', [
        check('id').exists().not().isEmpty().withMessage('is required')
    ], (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        const id = req.params.id;
        models.JMdictEntry.findByPk(id, {
            include: helpers.includeAllEntry
        }).then(async entry => {
            console.log(`Loaded entry: ${entry.id}`);
            const jmdictId = entry.reference.jmdict_id;

            const audioOptions = {
                shouldSort: true,
                threshold: 0.6,
                location: 0,
                distance: 20,
                maxPatternLength: 32,
                minMatchCharLength: 1,
                keys: ['path', 'kanji', 'hiragana']
            };

            const model = {};
            const q = (entry.entryKanjiElements && entry.entryKanjiElements.length) ? entry.entryKanjiElements.word : entry.entryReadingElements.word;

            model.entry = helpers.resultMapping(entry);
            model.audio = [
                {
                    provider: 'Forvo (KKLC)',
                    results: data.audio.kklc.filter(x => x.jmdicte_id == jmdictId)
                },
                {
                    provider: 'JDIC',
                    results: (new Fuse(data.audio.jdic.filter(x => x.jmdicte_id == jmdictId), audioOptions)).search(q)
                }
            ].filter(p => p.results.length);

            model.accents = helpers.parseAccents(entry.entryAccents);

            model.examples = await helpers.examplesForEntry(entry);

            model.dictionaries = {};
            model.dictionaries.wisdom = data.dictionaries.wisdom_j.filter(x => x.jmdicte_id == jmdictId);
            model.dictionaries.common = data.dictionaries.searchCommon(entry);
            model.title = entry.title;
            return res.render('pages/data', model);
        }).catch(next);
    });

    router.get('/examples/:text', [
        check('text').exists().not().isEmpty().withMessage('is required')
    ], async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        const model = {};
        const text = req.params.text;
        model.examples = await helpers.examplesContaing(text);
        return res.render('pages/examples', model);
    });

    router.get('/sentence/:sentence', [
        check('sentence').exists().not().isEmpty().withMessage('is required')
    ], (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        const sentence = req.params.sentence;
        const mecab = new MeCab();
        mecab.command = config.mecabCommand;

        mecab.parse(sentence, function(err, result) {
            if (err) {
                return next(err);
            }

            result = result.map(data => {
                return {
                    kanji: data[0],
                    lexical: data[1],
                    compound: data[2],
                    compound2: data[3],
                    compound3: data[4],
                    conjugation: data[5],
                    inflection: data[6],
                    original: data[7],
                    reading: data[8],
                    pronunciation: data[9] || ''
                }
            });

            Promise.all(result.map(x => {
                return {
                    data: x
                }
            })).then(result => {
                return res.render('pages/sentence', {
                    result: result,
                    sentence: sentence
                });
            });
        });
    });

    return router;
};
