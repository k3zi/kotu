let express = require('express');
let config = require('config');
let helpers = require(config.directory.server + '/helpers');

module.exports = function (passThrough) {
    let router = express.Router();

    router.use(require('./setup.js')(passThrough));

    router.get('/', (req, res) => {
        res.render('pages/index');
    });

    router.use('/api', require('./api')(passThrough));
    // router.use('/user', require('./user')(passThrough));
    router.use('/data', require('./data')(passThrough));
    router.use('/manage', require('./manage')(passThrough));

    // Handle 404
    router.use(function(req, res) {
       res.render('pages/404');
    });

    // Handle 500
    router.use(function(error, req, res, next) {
        console.log(error);
         res.render('pages/500');
    });

    return router;
};
