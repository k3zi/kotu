const express = require('express');
const config = require('config');
const { check, body, validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
const router = express.Router();
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

module.exports = function(passThrough) {
    const { models, operatorAliases: Op, passport, data, helpers } = passThrough;

    router.use(function (req, res, next) {
        if (config.security.disableAuth) {
            return next();
        }

        if (!req.isAuthenticated() || !req.user || !req.user.active) {
            return res.json(helpers.outputError('Data points can only be accessed by active users.'));
        }

        next();
    });

    router.get('/:type/:encryptedPath', [
        check('type').exists().not().isEmpty().withMessage('is required'),
        check('encryptedPath').exists().not().isEmpty().withMessage('is required')
    ], async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        let type = req.params.type;
        if (!['audio', 'examples'].includes(type)) {
            return next();
        }

        let encryptedPath = req.params.encryptedPath;
        let decryptedExampleId = res.locals.encryptor.decrypt(encryptedPath);
        let example = await models.SentenceExample.findByPk(decryptedExampleId, {
            include: [
                {
                    model: models.SentenceExampleMedia,
                    as: 'media',
                    seperate: true
                }
            ]
        });

        const soundPath = path.join(config.directory.server, 'data', type, example.media.soundPath);
        console.log(soundPath);
        console.log('start time', example.startTime);
        console.log('duration', example.endTime - example.startTime);
        const padding = 0.5;
        const startTime = Math.max(example.startTime - padding, 0);
        const duration = example.endTime - example.startTime + (2 * padding);
        ffmpeg(soundPath)
            .format('mp3')
            .seekInput(startTime)
            .duration(duration)
            .on('error', function(err) {
                console.log('an error happened: ' + err.message);
            })
            .pipe(res, { end: true });
    });

    router.get('/download/:type/:encryptedPath', [
        check('type').exists().not().isEmpty().withMessage('is required'),
        check('encryptedPath').exists().not().isEmpty().withMessage('is required')
    ], async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        let type = req.params.type;
        if (!['audio', 'examples'].includes(type)) {
            return next();
        }

        let encryptedPath = req.params.encryptedPath;
        let decryptedExampleId = res.locals.encryptor.decrypt(encryptedPath);
        let example = await models.SentenceExample.findByPk(decryptedExampleId, {
            include: [
                {
                    model: models.SentenceExampleMedia,
                    as: 'media',
                    seperate: true
                }
            ]
        });

        const soundPath = path.join(config.directory.server, 'data', type, example.media.soundPath);
        const padding = 0.5;
        const startTime = Math.max(example.startTime - padding, 0);
        const duration = example.endTime - example.startTime + (2 * padding);
        ffmpeg(soundPath)
            .format('mp3')
            .seekInput(startTime)
            .duration(duration)
            .on('error', function(err) {
                console.log('an error happened: ' + err.message);
            })
            .pipe(res.attachment(`${example.text}.mp3`), { end: true });
    });

    return router;
};