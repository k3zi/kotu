// Imports Sorted Alphabetically
const _ = require('lodash');
const AccessControl = require('accesscontrol');
const bodyParser = require('body-parser');
const cls = require('continuation-local-storage');
const compression = require('compression');
const config = require('config');
const cookieParser = require('cookie-parser');
const createHandler = require('github-webhook-handler');
const engine = require('ejs-blocks');
const express = require('express');
const extendSequelize = require('sequelize-extension');
const enhanceTracking = require('sequelize-extension-tracking');
const fileExists = require('file-exists');
const fs = require('fs');
const nodegit = require("nodegit");
const passport = require('passport');
const path = require("path");
const RateLimiter = require('async-ratelimiter');
const Redis = require('ioredis');
const rescue = require('express-rescue');
const sassMiddleware = require('node-sass-middleware');
const Sequelize = require('sequelize');
const session = require('express-session');
const showdown  = require('showdown');
const timeout = require('connect-timeout');
const url = require('url');

const RedisStore = require('connect-redis')(session);
const home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
const app = express();

process.on('uncaughtException', function (err) {
    console.log(err);
});

// Sequelize Model Import
const sequelize = new Sequelize(config.database.database, config.database.username, config.database.password, {
    host: config.database.host,
    dialect: config.database.dialect,
    operatorAliases: Sequelize.Op,
    logging: false
});
const models = require("./models");
const namespace = cls.createNamespace(config.namespace);

extendSequelize(models, {
    tracking: enhanceTracking({
        log: async (logs, options) => {
            return models.Log.log(logs, options);
        }
    })
});

const rateLimiter = new RateLimiter({
    db: new Redis(),
    max: 10,
    duration: 10000
});


let grantsObject = {
    admin: {
        accent: {
            'create:any': ['*'],
            'read:any': ['*'],
            'update:any': ['*'],
            'delete:any': ['*']
        },
        user: {
            'create:any': ['*'],
            'read:any': ['*'],
            'update:any': ['*'],
            'delete:any': ['*']
        }
    },
    user: {

    }
};

const ac = (new AccessControl(grantsObject)).lock();
(async () => {
    await models.sequelize.sync();
    console.log('Database synced models successfully');

    models.User.prototype.toJSON =  function () {
        return _.omit(this.get(), ['password', 'one_time']);
    };

    /*
    toJSON: function () {
        // Return a shallow clone so toJSON method of the nested models can be called recursively.
        return Object.assign({}, this.get());
    }
    */

    const sshPublicKeyPath = path.join(home, '.ssh', 'id_rsa.pub');
    const sshPrivateKeyPath = path.join(home, '.ssh', 'id_rsa');
    showdown.setFlavor('github');

    /* Setup 'app' Middleware */
    app.set('trust proxy', 1);
    app.use(timeout('45s'));
    app.use(compression());
    app.use('/js', express.static(__dirname + '/node_modules/gijgo/js'));
    app.use('/js', express.static(__dirname + '/node_modules/tko/dist'));
    app.use('/js', express.static(__dirname + '/node_modules/autocomplete.js/dist'));
    app.use('/js', express.static(__dirname + '/node_modules/popper.js/dist/umd'));
    app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js'));
    app.use('/js', express.static(__dirname + '/node_modules/popper.js/dist'));
    app.use('/js', express.static(__dirname + '/node_modules/jquery/dist'));
    app.use('/js', express.static(__dirname + '/node_modules/jquery.rubyann/dist'));
    app.use('/js', express.static(__dirname + '/node_modules/evil-icons/assets'));
    app.use('/js', express.static(__dirname + '/node_modules/moment/min'));

    app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css'));
    app.use('/css', express.static(__dirname + '/node_modules/gijgo/css'));
    app.use('/css', express.static(__dirname + '/node_modules/evil-icons/assets'));

    app.use('/fonts', express.static(__dirname + '/node_modules/gijgo/fonts'));
    app.use(sassMiddleware({
        src: path.join(__dirname, 'sass'),
        dest: path.join(__dirname, 'public', 'css'),
        response: true,
        outputStyle: 'compressed',
        prefix:  '/css',
        includePaths: [ path.join(__dirname, 'node_modules/') ]
    }));

    // Expose public folder
    app.use('/', express.static(path.join(__dirname, 'public')));

    // Github Update Handler
    const handler = createHandler({ path: '/webhook', secret: config.webhookSecret });
    app.use(handler);
    handler.on('push', function (event) {
        console.log('Received a push event for %s to %s', event.payload.repository.name, event.payload.ref);

        let repository;
        nodegit.Repository.open(path.join(__dirname, 'notes')).then(function(repo) {
            repository = repo;
            console.log('Opened repo');
            return repository.fetchAll({
                callbacks: {
                    credentials: function(url, userName) {
                        console.log('Asked for credentials: ', url, ' User: ', userName);
                        return nodegit.Cred.sshKeyNew(userName, sshPublicKeyPath, sshPrivateKeyPath, "");
                    },
                    certificateCheck: function() {
                        return 1;
                    }
                }
            });
        }).then(function() {
            console.log('Do merge');
            return repository.mergeBranches("master", "origin/master");
        }).catch(function(e) {
            console.log(e);
        });
    });

    // Parse the body
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json());

    // Add Passport Login/Session Middleware
    app.use(cookieParser(config.security.sessionSecret));
    app.use(session({
        secret: config.security.sessionSecret,
        resave: false,
        saveUninitialized: true,
        proxy: true,
        store: new RedisStore(),
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    // Set the rednering engine to Embedded JavaScript
    const template = require('express-art-template');
    app.engine('art', template);
    app.set('view engine', 'art');
    app.set('views', path.join(__dirname, 'views'));

    // Require in the routes
    const passThrough = {};
    passThrough.ac = ac;
    passThrough.config = config;
    passThrough.models = models;
    passThrough.namespace = namespace;
    passThrough.passport = passport;
    passThrough.Sequelize = Sequelize;
    passThrough.sequelize = sequelize;
    passThrough.rescue = rescue;
    passThrough.operatorAliases = Sequelize.Op;
    passThrough.rateLimiter = rateLimiter;
    passThrough.status = require('http-status-codes');
    passThrough.data = require('./data')(passThrough);
    passThrough.helpers = require(config.directory.server + '/helpers')(passThrough);
    app.use('/', require('./routes')(passThrough));

    // Start listening
    app.listen(1272, () => {
        console.log('Website listening on port 1272!');
    });
})();
