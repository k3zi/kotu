const glob = require("glob");
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
mecab.command = "/usr/local/bin/mecab -d /usr/local/lib/mecab/dic/mecab-ipadic-neologd";

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
  .option('-s, --source [value]', 'The title of the source of the anki deck (I.e. Drama Name, Book Name)')
  .option('-t, --type [value]', 'The type of the source of the anki deck (I.e. Book, Drama, Anime)')
  .option('-p, --purge', 'If used will purge the database of example sentences')
  .parse(process.argv);

const directory = program.directory;
const source = program.source;
const type = program.type;
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

(async () => {
    await models.sequelize.sync();
    if (program.purge) {
        await models.SentenceExample.destroy({
            where: {},
            truncate: true
        });
    }

    const db = await sqlite.open(path.join(directory, 'collection.anki2'), { Promise })
    console.log('Accessed database.');
    const notes = await db.all('SELECT * FROM notes');
    console.log(`Found ${notes.length} notes.`);
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

        const japanese = notea.find(x => x.match(config.isJapanese) && !x.includes('<') && !x.includes('_'));
        const english = notea.find(x => !x.match(config.isJapanese) && !x.includes('<') && !x.includes('_') && x.length > 2);

        let results = await Promise.fromCallback(callback => mecab.parse(japanese, callback));
        results = results.map(data => {
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

        let ext = sound.split('.');
        ext = ext[ext.length - 1];
        const oldPath = path.join(directory, 'collection.media', sound);
        const newSoundFile = `audio/${uuidv1()}.${ext}`;
        const newSoundPath = `${__dirname}/${newSoundFile}`;
        await fs.promises.copyFile(oldPath, newSoundPath);

        const example = await models.SentenceExample.create({
            japanese: japanese,
            english: english,
            soundPath: newSoundFile,
            type: type,
            source: source
        });

        await Promise.mapSeries(results, async x => {
            const original = x.original;
            const reading = x.reading;
            const readingH = moji(reading || original).convert('KK', 'HG').toString();
            const jmdict = await models.JMdictEntry.findAll({
                where: {
                    [Sequelize.Op.or]: [
                        {
                            '$entryKanjiElements.word$': original
                        },
                        {
                            '$entryReadingElements.word$': original
                        }
                    ]
                },
                include: include
            });

            const search = jmdict.filter(x => {
                const kanjiPart = x.entryKanjiElements && x.entryKanjiElements.some(k => k.word == original);
                if (kanjiPart) {
                    return true;
                }

                return x.entryReadingElements.some(r => r.word == original);
            });

            if (search.length) {
                await Promise.mapSeries(search, result => {
                    entered++;
                    return result.addSentenceExample(example);
                });
            }

            console.log(`%${(100.0 * i) / notes.length } left. ${entered} example sentence/word pairs entered.`);
            i++;
        });
    }, { concurrency: 10 });
})();
