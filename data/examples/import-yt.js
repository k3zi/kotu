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
const ytdl = require("youtube-dl");

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
  .option('-v, --video [value]', 'Specify the ID to the target YouTube video.')
  .option('-t, --tag [value]', 'Specify a tag to give the video.')
  .option('-a, --auto', 'Whether to use the auto generated subtitles.')
  .parse(process.argv);

const videoID = program.video;
const videoTag = program.tag;
const useAuto = program.auto;

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

function linesFor(url) {
    return new Promise((resolve, reject) => {
        let options = {
            auto: useAuto,
            all: false,
            format: "srt",
            lang: "ja",
            cwd: path.join(__dirname, "temp")
        };

        ytdl.getSubs(url, options, (err, files) => {
            if (err) {
                return reject(err);
            }

            fs.readFile(path.join(__dirname, "temp", files[0]), 'utf8', (error, lines) => {
                if (error) {
                    reject(error);
                }

                const result = lines.split(/\n{2,}/g)
            		.slice(1, -1)
                    .map(s => {
            			let [timingsString, text] = s.split("\n");
            			let timings = timingsString.split(" --> ");
            			let startTimeComponents = timings[0].split(":");
            			let endTimeComponents = timings[1].split(":");
            			let startTime = (parseInt(startTimeComponents[0]) * 3600) + (parseInt(startTimeComponents[1]) * 60) + parseFloat(startTimeComponents[2]);
            			let endTime = (parseInt(endTimeComponents[0]) * 3600) + (parseInt(endTimeComponents[1]) * 60) + parseFloat(endTimeComponents[2]);

            			return {
            				startTime,
            				endTime,
            				text
            			};
            		});
                resolve(result);
            });
        });
    });
}

function downloadAudio(url) {
    return new Promise((resolve, reject) => {
        let options = {
            auto: false,
            all: false,
            format: "mp3",
            lang: "ja",
            cwd: path.join(__dirname, "temp")
        };
        const video = ytdl(url, [ '--extract-audio', '--audio-format=mp3' ], {
            cwd: path.join(__dirname, "temp")
        });

        const result = {
            title: '',
            soundPath: `audio/${uuidv1()}.mp3`,
            displayId: ''
        };

        video.on('info', function(info) {
            console.log(`Download started...\nTitle:${info.title}`);
            result.title = info.title;
            result.displayId = info.display_id;
        });

        const newSoundPath = `${__dirname}/${result.soundPath}`;
        const output = fs.createWriteStream(newSoundPath);
        output.on('error', (e) => reject(`Error writing to file: ${e}`));
        output.on('finish', () => output.close(() => resolve(result)));
        video.pipe(output);
    });
}

(async () => {
    await models.sequelize.sync();

    const existingMedia = await models.SentenceExampleMedia.findAll({
        where: {
            type: 'youtube',
            sourceId: videoID
        }
    });

    if (existingMedia.length > 0) {
        console.log('Already an existing media in the database. Quiting.');
        return;
    }

    const videoURL = `https://www.youtube.com/watch?v=${videoID}`
    let lines = await linesFor(videoURL);
    if (lines === 0) {
        console.log('Zero lines. Quiting.');
        return;
    }
    let audio = await downloadAudio(videoURL);
    console.log(audio);

    let i = 0;
    let entered = 0;

    const exampleMedia = await models.SentenceExampleMedia.create({
        name: audio.title,
        type: 'youtube',
        soundPath: audio.soundPath,
        sourceId: audio.displayId,
        tags: videoTag ? videoTag.split(',') : []
    });

    await Promise.map(lines, async line => {
        const japanese = line.text;

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

        const example = await models.SentenceExample.create({
            text: japanese,
            startTime: line.startTime,
            endTime: line.endTime
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
        console.log(`${i} / ${lines.length } completed.`);
    }, { concurrency: 10 });
})();
