module.exports = {
    apps : [{
        name: 'Server',
        script: 'index.js',
        instances: 1,
        autorestart: true,
        watch: true,
        ignore_watch: [
            'data/**/*.mp3',
            'data/**/*.zip',
            'data/**/*.gz',
            'data/**/*.lastModified',
            'data/**/*.html',
            'data/**/*.json',
            'data/**/*.csv',
            'data/**/*.csv',
            'data/**/*.csv',
            '**/temp/*',
            'data/dictionaries/wisdom/*',
            'data/examples/audio/*',
            'node_modules/*',
            '.git/*'
        ],
        env: {
            NODE_ENV: 'development'
        },
        env_production: {
            NODE_ENV: 'production'
        },
        node_args: '--max_old_space_size=16384'
    }]
};
