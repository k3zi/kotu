const glob = require("glob");
process.env["NODE_CONFIG_DIR"] = __dirname + "/../../config/";
const config = require("config");
const move = require('move-concurrently');
const fs = require('fs');
const path = require('path');
const sqlite = require('sqlite');
const Promise = require('bluebird');
const MeCab = new require('mecab-async');
const _ = require('lodash');
const moji = require('moji');
const program = require('commander');
const Sequelize = require('sequelize');
const uuidv1 = require('uuid/v1');

const mecab = new MeCab();
mecab.command = config.mecabCommand;

// Sequelize Model Import
const sequelize = new Sequelize(config.database.database, config.database.username, config.database.password, {
    host: config.database.host,
    dialect: config.database.dialect,
    operatorAliases: Sequelize.Op,
    logging: false
});

const models = require("../../models");

program
  .version('0.0.1')
  .option('-d, --directory [value]', 'Specify the relative directory where the anki file is extracted to (I.e. "subs2srs/HarryPotter/")')
  .option('-n, --name [value]', 'The title of the source of the anki deck (I.e. Drama Name, Book Name)')
  .option('-t, --tag [value]', 'Specify a tag to give the video.')
  .parse(process.argv);

const directory = program.directory;
const name = program.name;
const tag = program.tag;
let entered = 0;

const include = [
    {
        model: models.JMdictKanjiElement,
        as: 'entryKanjiElements',
        include: [
            {
                model: models.JMdictReadingElement,
                as: 'kanjiRestrictedReadingElements',
                attributes: ['word']
            }
        ],
        attributes: ['word']
    },
    {
        model: models.JMdictReadingElement,
        as: 'entryReadingElements',
        attributes: ['word']
    }
];

const fileExists = async path => !!(await fs.promises.stat(path).catch(e => false));

(async () => {
    await models.sequelize.sync();
    const db = await sqlite.open(path.join(directory, 'collection.anki2'), { Promise })
    console.log('Accessed database.');
    const notes = await db.all('SELECT * FROM notes');
    console.log(`Found ${notes.length} notes.`);

    const exampleMedia = await models.SentenceExampleMedia.create({
        name: name,
        type: 'subs2srs',
        soundPath: '',
        sourceId: '',
        tags: tag ? tag.split(',') : []
    });

    let i = 0;
    await Promise.map(notes, async note => {
        const notea = note.flds.split("\x1f");
        const soundNode = notea.find(b => b.startsWith('[sound:'));
        if (!soundNode) {
            return;
        }
        const sound = soundNode.split('[sound:')[1].slice(0, -1);
        if (!sound) {
            return;
        }

        const japanese = notea.find(x => x.match(config.isJapanese) && !x.includes('<') && !x.includes('[') && !x.includes('(') && !x.includes('_'));
        if (!japanese) {
            return;
        }

        let results = await Promise.fromCallback(callback => mecab.parse(japanese, callback));
        results = results.map(data => {
            return {
                original: data[0],
                lexical: data[1],
                compound: data[2],
                compound2: data[3],
                compound3: data[4],
                conjugation: data[5],
                inflection: data[6],
                root: data[7],
                pronunciation: data[8],
                realizedPronunciation: data[9] || ''
            }
        });

        let ext = sound.split('.');
        ext = ext[ext.length - 1];
        const oldPath = path.join(directory, 'collection.media', sound);
        if (!(await fileExists(oldPath))) {
            return;
        }

        let newSoundFile = `audio/${uuidv1()}.${ext}`;
        let newSoundPath = `${__dirname}/${newSoundFile}`;
        while (await fileExists(newSoundPath)) {
            newSoundFile = `audio/${uuidv1()}.${ext}`;
            newSoundPath = `${__dirname}/${newSoundFile}`;
        }
        await fs.promises.copyFile(oldPath, newSoundPath);

        const example = await models.SentenceExample.create({
            text: japanese,
            soundPath: newSoundFile
        });

        await exampleMedia.addSentence(example);

        await Promise.mapSeries(results, async x => {
            const original = x.original;
            const root = x.root;
            const pronunciation = x.pronunciation;

            const component = await models.SentenceExampleComponent.create({
                text: original,
                root: root,
                pronunciation: pronunciation
            });

            await example.addComponent(component);
        });
        i++;
        console.log(`${i} / ${notes.length } completed.`);
    }, { concurrency: 30 });
})();
