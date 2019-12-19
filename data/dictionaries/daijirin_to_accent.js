process.env["NODE_CONFIG_DIR"] = __dirname + "/../../config/";
const _ = require('lodash');
const config = require('config');

const fs = require('fs');
const path = require('path');
const neatCsv = require('neat-csv');
const moji = require('moji');
const Promise = require('bluebird');
const helpers = require(config.directory.server + '/helpers');
const Sequelize = require('sequelize');

// Sequelize Model Import
const sequelize = new Sequelize(config.database.database, config.database.username, config.database.password, {
    host: config.database.host,
    dialect: config.database.dialect,
    operatorAliases: Sequelize.Op,
    logging: false
});
const models = require("../../models");
const horzBar = '―';
const nhk1998 = 'ＮＨＫ日本語発音アクセント辞典（１９９８）';

const arow = 'アカガサザタダナハバパマヤラワァャ';
const irow = 'イキギシジチヂニヒビピミリィ';
const urow = 'ウクグスズツヅヌフブプムルゥュ';
const erow = 'エケゲセゼテデネヘベペメレェ';
const orow = 'オコゴソゾトドノホボポモヨロヲォョ';
const smallHiragana = 'ぁぃぅぇぉゃゅょゎ';
const smallKatakana = 'ァィゥェォヵㇰヶㇱㇲㇳㇴㇵㇶㇷㇷ゚ㇸㇹㇺャュョㇻㇼㇽㇾㇿヮ';

function getKanjiArray(s) {
    let arr = [];
    for (let i = 0;  i < s.length; i++) {
        if (s[i] >= "\u3040" && s[i] <= "\u30ff") {
            result = true;
        } else {
            arr.push(s[i]);
        }
    }

    return arr;
}

function convertVowelToExtended(y) {
    let x = y;
    for (let i = 1; i < x.length; i++) {
        if (arow.includes(x[i - 1])) {
            if (x[i] === 'ア') {
                x = x.replace(/./g, (c, y) => y == i ? 'ー' : c);
            }
        }

        if (irow.includes(x[i - 1])) {
            if (x[i] === 'イ') {
                x = x.replace(/./g, (c, y) => y == i ? 'ー' : c);
            }


            if (x[i] === 'エ') {
                x = x.replace(/./g, (c, y) => y == i ? 'ー' : c);
            }
        }

        if (urow.includes(x[i - 1])) {
            if (x[i] === 'ウ') {
                x = x.replace(/./g, (c, y) => y == i ? 'ー' : c);
            }
        }

        if (erow.includes(x[i - 1])) {
            if (x[i] === 'エ') {
                x = x.replace(/./g, (c, y) => y == i ? 'ー' : c);
            }
        }

        if (orow.includes(x[i - 1])) {
            if (x[i] === 'ウ') {
                x = x.replace(/./g, (c, y) => y == i ? 'ー' : c);
            }

            if (x[i] === 'オ') {
                x = x.replace(/./g, (c, y) => y == i ? 'ー' : c);
            }
        }
    }

    return x;
}

function possiblyEqualSound(a, b, log) {
    if (a.length != b.length) {
        return false;
    }

    if (a === b) {
        return true;
    }

    let ka = moji(a).convert('HG', 'KK').toString();
    let kb = moji(b).convert('HG', 'KK').toString();

    if (ka === kb) {
        return true;
    }

    if (log) {
        console.log('Not yet equal: ', ka, '!=', kb);
    }

    ka = convertVowelToExtended(ka).replace(/ヅ/g, 'ズ');
    kb = convertVowelToExtended(kb).replace(/ヅ/g, 'ズ');

    if (log) {
        console.log('Equal?: ', ka, '!=', kb);
    }

    return ka === kb;
}

function hasKanjiElement(x, kanji) {
    return x.entryKanjiElements && x.entryKanjiElements.some(k => k.word == kanji)
        || x.entryReadingElements.some(r => possiblyEqualSound(kanji, r.word)) || x.entryKanjiElements.some(k => k.kanjiRestrictedReadingElements.some(r => possiblyEqualSound(kanji, r.word)));
}

function stringEqualsAt(string, equalString, index) {
    if (string.length < (index + equalString.length)) {
        return false;
    }

    return string.substring(index).startsWith(equalString) ? equalString.length : undefined;
}

function addAccent(string, index) {
    if (index == 0) {
        return string;
    }

    let i = 0;
    return Array.from(string).map(c => {
        if (!smallKatakana.includes(c) && !smallHiragana.includes(c)) {
            i++;
            return c + (i == index ? '＼' : '');
        }

        return c;
    }).join('');
}


(async () => {
    await models.sequelize.sync();
    console.log('Loaded models.');
    const dictData = require(path.join(__dirname, 'daijirin.json'));
    let s = 0;
    await Promise.map(dictData, async (d, i) => {
        if (d[5][0].includes('[') && s < 40) {
            const e = {
                expression: d[0],
                reading: d[1],
                gloss: d[5][0].split("\n")
            };

            if (e.expression.includes(horzBar)) {
                const kanjiReplacements = e.reading.split(/[\u3040-\u309f]/).filter(a => a.length);
                let kanjiIndex = 0;
                while (e.expression.includes(horzBar)) {
                    if (typeof kanjiReplacements[kanjiIndex] === 'undefined') {
                        console.log('_________________UUUUU____________________');
                        console.log(d);
                    }
                    e.expression = e.expression.replace(horzBar, kanjiReplacements[kanjiIndex]);
                    kanjiIndex++;
                }
            }

            if (e.gloss[0].includes('[')) {
                e.accentMatches = e.gloss[0].split('[').filter(v => { return v.indexOf(']') > -1}).map(value => {
                    return parseInt(value.split(']')[0]);
                }).filter(v => !isNaN(v));
                if (!e.reading.length) {
                    e.reading = e.expression;
                }

                e.reading = moji(e.reading.trim()).convert('HG', 'KK').toString();
                
                console.log(e);

                const results = await models.AccentJMDictPair.findAll({
                    where: {
                        kanji: {
                            [Sequelize.Op.contains]: [e.expression]
                        },
                        kana: e.reading
                    }
                });
                
                console.log(results);

                const accentMatchResults = results.filter(r => r.accent.length == 1 && e.accentMatches.includes(r.accent[0].accentNumber));
                if (accentMatchResults.length) {
                    await Promise.mapSeries(accentMatchResults, async match => {
                        const sources = _.cloneDeep(match.sources);
                        if (!sources.includes('daijirin3')) {
                            sources.push('daijirin3');
                        }

                        if (sources.includes(nhk1998)) {
                            sources.splice(sources.indexOf(nhk1998), 1, 'nhk1998');
                        }

                        if (sources.includes('daijirin')) {
                            sources.splice(sources.indexOf('daijirin'), 1);
                        }

                        console.log('Saved Accent Match: ', sources);
                        await match.update({
                            sources: sources
                        });
                    });
                }

                const nonMatches = e.accentMatches.filter(m => !results.some(r => r.accent.length == 1 && r.accent[0].accentNumber == m));
                if (nonMatches.length) {
                    const kanji = e.expression;
                    const kanjiArray = getKanjiArray(kanji);
                    const hasKanji = kanjiArray.length > 0;
                    const hasKana = kanjiArray.length != kanji.length;

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

                    const hiraganaMoj = moji(e.reading).convert('KK', 'HG').toString();
                    const jmdict = await models.JMdictEntry.findAll({
                        where: {
                            [Sequelize.Op.or]: [
                                {
                                    '$entryKanjiElements.word$': e.expression
                                },
                                {
                                    '$entryKanjiElements.kanjiRestrictedReadingElements.word$': e.reading
                                },
                                {
                                    '$entryKanjiElements.kanjiRestrictedReadingElements.word$': hiraganaMoj
                                },
                                {
                                    '$entryReadingElements.word$': e.reading
                                },
                                {
                                    '$entryReadingElements.word$': hiraganaMoj
                                }
                            ]
                        },
                        include: include
                    });

                    const search = jmdict.filter(x => {
                        if (kanjiArray.length == 0 && x.entryReadingElements.length == 0 && x.entryKanjiElements.length > 0) {
                            return false;
                        }

                        let kanjiPart = hasKanjiElement(x, kanji);

                        if (!kanjiPart && hasKana && x.entryKanjiElements) {
                            kanjiPart = kanjiArray.every(k => x.entryKanjiElements.some(r => r.word.includes(k)));
                        }

                        const hiraganaPart = x.entryReadingElements.some(r => possiblyEqualSound(e.reading, r.word)) || x.entryKanjiElements.some(k => k.kanjiRestrictedReadingElements.some(r =>  possiblyEqualSound(e.reading, r.word)));
                        return kanjiPart && hiraganaPart;
                    });

                    await Promise.mapSeries(nonMatches, accentNumber => {
                        const entry = {
                            accent: [{
                                accentString: addAccent(e.reading, accentNumber),
                                accentNumber: accentNumber
                            }],
                            kana: e.reading,
                            kanji: [kanji],
                            fullKanji: kanji,
                            sources: ['daijirin3'],
                            notes: []
                        };

                        if (search.length == 0) {
                            return models.AccentJMDictPair.create(entry);
                        }

                        return Promise.all(search.map(async searchResult => {
                            const specificEntry = _.cloneDeep(entry);
                            specificEntry.accurate = hasKanjiElement(searchResult, kanji);
                            const dbPair = await models.AccentJMDictPair.create(specificEntry);
                            await dbPair.setAccentEntry(searchResult);
                        }));
                    });
                }
            }

            // Attempt to get the accents that are dependent on part of speech.
            /*
            let accentGlosses = e.gloss.map((g, gIndex) => {
                return {
                    accent: g,
                    originalIndex: gIndex
                };
            }).slice(1).filter(g => {
                return /\[[0-9]+\]/.test(g.accent);
            });

            let seperateAdditions = [];

            if (accentGlosses.length) {
                accentGlosses = accentGlosses.forEach((g, gIndex) => {
                    const accentMatches = g.accent.split('[').filter(v => { return v.indexOf(']') > -1}).map(value => {
                        return parseInt(value.split(']')[0]);
                    }).filter(v => !isNaN(v));
                    const partOfSpeech = _.uniq(_.flatten(g.accent.split('（').filter(v => { return v.indexOf('）') > -1}).map(value => {
                        return value.split('）')[0].split('・');
                    }))).filter(f => f.startsWith('動') || ['名', '形動', '代', '副', '感', '形', '形動ナリ', '接続', '連体', '形動タリ'].includes(f));
                    const notes = _.uniq(_.flatten(g.accent.split('〔').filter(v => { return v.indexOf('〕') > -1}).map(value => {
                        return value.split('〕')[0].split('・');
                    }))).filter(f => f.includes('アクセント'));

                    if (partOfSpeech.length || notes.length) {
                        seperateAdditions.push({
                            accentNumbers: accentMatches,
                            partOfSpeech: partOfSpeech,
                            notes: notes
                        });
                    } else if (e.gloss.length > g.originalIndex) {
                        const definitions = e.gloss.slice(g.originalIndex + 1, (accentGlosses.length > (gIndex + 1)) ? accentGlosses[gIndex + 1].originalIndex : e.gloss.length).filter(a => a.length);
                        console.log(g.accent);
                        console.log(definitions);
                    } else {
                        console.log(partOfSpeech);
                        console.log(notes);
                        console.log(g);
                        console.log('----------------------------------------');
                    }
                });
            }*/
        }
    }, { concurrency: 20 });

    console.log('Done.');
})();
