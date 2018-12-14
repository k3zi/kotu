const express = require('express');
const config = require('config');
const { check, body, validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
const router = express.Router();
const path = require('path');

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
    ], (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(helpers.outputValidationErrors(errors.array()));
        }

        let type = req.params.type;
        if (!['audio', 'examples'].includes(type)) {
            return next();
        }

        let encryptedPath = req.params.encryptedPath;
        let decryptedPath = res.locals.encryptor.decrypt(encryptedPath);
        res.sendFile(path.join(config.directory.server, 'data', type, decryptedPath));
    });

    return router;
};
