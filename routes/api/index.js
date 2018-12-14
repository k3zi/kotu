const express = require('express');
const config = require('config');

module.exports = function(passThrough) {
    const router = express.Router();
    const { helpers } = passThrough;
    router.get('/status', function(req, res) {
        let result = helpers.outputResult('The server is doing fine.');
        res.json(result);
    });

    router.use('/auth', require('./auth')(passThrough));
    router.use('/data', require('./data')(passThrough));
    router.use('/media', require('./media')(passThrough));

    // Error Handling
    router.use(function(req, res) {
        let result = helpers.outputError('404: Method Not Found');
        res.status(404).json(result);
    });

    router.use(function(error, req, res, next) {
        let result = helpers.outputError(error, false, req);
        res.json(result);
    });

    return router;
};
