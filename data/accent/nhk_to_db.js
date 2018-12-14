const _ = require('lodash');
const config = require('config');

const fs = require('fs');
const path = require('path');
const neatCsv = require('neat-csv');
const moji = require('moji');
const Promise = require('bluebird');

const Sequelize = require('sequelize');

// Sequelize Model Import
const sequelize = new Sequelize(config.database.database, config.database.username, config.database.password, {
    host: config.database.host,
    dialect: config.database.dialect,
    operatorAliases: Sequelize.Op,
    logging: true
});
const models = require("../../models");

const nhkAccentCSVFile = path.join(__dirname, 'ACCDB_unicode.csv');
const jmdicteJSONPath = path.join(__dirname, '..', 'dictionaries', 'jmdict_e', 'main.json');

const arow = 'アカガサザタダナハバパマヤラワァャ';
const irow = 'イキギシジチヂニヒビピミリィ';
const urow = 'ウクグスズツヅヌフブプムルゥュ';
const erow = 'エケゲセゼテデネヘベペメレェ';
const orow = 'オコゴソゾトドノホボポモヨロヲォョ';
const smallHiragana = 'ぁぃぅぇぉゃゅょゎ';
const smallKatakana = 'ァィゥェォヵㇰヶㇱㇲㇳㇴㇵㇶㇷㇷ゚ㇸㇹㇺャュョㇻㇼㇽㇾㇿヮ';

function getKanjiArray(s) {
    let arr = [];
    for (const i = 0;  i < s.length; i++) {
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
    for (const i = 1; i < x.length; i++) {
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
    return (x.k_ele && x.k_ele.some(k => k.keb.includes(kanji)))
        || x.r_ele.some(r => r.reb.some(reading => possiblyEqualSound(kanji, reading)));
}

function stringEqualsAt(string, equalString, index) {
    if (string.length < (index + equalString.length)) {
        return false;
    }

    return string.substring(index).startsWith(equalString) ? equalString.length : undefined;
}

function parseAccent(entry) {
    const text = entry.midashigo1;
    const expression = entry.NHKexpr;

    const stringLength = text.length;
    const accentLength = entry.ac.length;
    const accent = "0".repeat(stringLength - accentLength) + entry.ac;
    let accentNumber = accent.indexOf('2');
    accentNumber = accentNumber < 0 ? 0 : (accentNumber + 1);

    const nasalPositions = [];
    if (entry.nasalsoundpos) {
        entry.nasalsoundpos.split('0').forEach(p => {
            if (p) {
                nasalPositions.push(parseInt(p));
            } else {
                nasalPositions[nasalPositions.length - 1] = nasalPositions[nasalPositions.length - 1] * 10
            }
        });
    }

    const devoicedPositions = [];
    if (entry.nopronouncepos) {
        entry.nopronouncepos.split('0').forEach(p => {
            if (p) {
                devoicedPositions.push(parseInt(p));
            } else {
                devoicedPositions[devoicedPositions.length - 1] = devoicedPositions[devoicedPositions.length - 1] * 10
            }
        });
    }

    let finalAccent = "";
    for (let u = 0; u < stringLength; u++) {
        if (devoicedPositions.includes(u + 1)) {
            finalAccent += '(';
        }
        finalAccent += text[u];
        if (nasalPositions.includes(u + 1)) {
            finalAccent += "\u309a";
        }
        if (devoicedPositions.includes(u + 1)) {
            finalAccent += ')';
        }
        if (accent[u] == 2) {
            finalAccent += "＼";
        }
    }

    return finalAccent.split('・').map(a => {
        let justWord = a.replace(/\(|\)|\*/g, '');
        justWord = justWord.split('').filter(chr => smallKatakana.indexOf(chr) === -1).join('');
        const number = justWord.indexOf('＼');
        return {
            accentString: a,
            accentNumber: number < 0 ? 0 : number
        };
    });
}

const csv = "NID,ID,WAVname,K_FLD,ACT,midashigo,nhk,kanjiexpr,NHKexpr,numberchars,nopronouncepos,nasalsoundpos,majiri,kaisi,KWAV,midashigo1,akusentosuu,bunshou,ac\n" + fs.readFileSync(nhkAccentCSVFile, { encoding: 'utf8' });
const jmdicte = require(jmdicteJSONPath);
(async () => {
    await models.sequelize.sync();

    const entryInclude = [
        {
            model: models.JMdictKanjiElement,
            as: 'entryKanjiElements',
            seperate: true,
            include: [
                {
                    model: models.JMdictReadingElement,
                    as: 'kanjiRestrictedReadingElements',
                    seperate: true,
                    attributes: {
                        exclude: ['id', 'updatedAt', 'createdAt', 'info', 'prioroty', 'restricted', 'JMdictEntryId', 'readingEntryId']
                    },
                }
            ],
            attributes: {
                exclude: ['id', 'updatedAt', 'createdAt', 'info', 'prioroty', 'entryId', 'JMdictEntryId']
            }
        },
        {
            model: models.JMdictReadingElement,
            as: 'entryReadingElements',
            seperate: true,
            attributes: {
                exclude: ['id', 'updatedAt', 'createdAt', 'info', 'prioroty', 'restricted', 'JMdictEntryId', 'readingEntryId']
            }
        }
    ];

    let data = await neatCsv(csv, { separator: "," });
    console.log('Count before: ', data.length);

    data = _.groupBy(data, 'ID');
    data = Object.values(data);
    console.log('Count after: ', data.length);

    await Promise.mapSeries(data, async (entries, entryIndex) => {
        let logId = `Entry: ${entryIndex}`;
        console.log('');
        console.time(logId);
        const rawEntry = entries[entries.length - 1];
        const accent = parseAccent(rawEntry);
        const pronunciation = rawEntry.midashigo;
        const kanji = [rawEntry.nhk];
        if (!kanji.includes(rawEntry.kanjiexpr)) {
            kanji.push(rawEntry.kanjiexpr);
        }

        let expression = kanji.includes(rawEntry.NHKexpr) ? '' : rawEntry.NHKexpr;
        let entry = {
            accent: accent,
            kana: entries.map(e => e.midashigo)[0],
            kanji: kanji,
            fullKanji: rawEntry.kanjiexpr,
            expression: expression,
            sources: ['nhk1998'],
            notes: []
        };

        console.timeLog(logId, 'mapped accent');

        const fullKanji = entry.fullKanji;
        const kanjiArray = getKanjiArray(fullKanji);
        const hasKanji = kanjiArray.length > 0;
        const hasKana = kanjiArray.length != fullKanji.length;

        console.timeLog(logId, 'searching for previous accent(s)');
        const results = await models.AccentJMDictPair.findAll({
            where: {
                kanji: {
                    [Sequelize.Op.overlap]: entry.kanji
                },
                kana: entry.kana
            }
        });
        console.timeLog(logId, `found ${results.length} previous accent(s)`);

        const accentMatchResults = results.filter(r => {
            return _.isEqual(r.accent.map(a => a.accentNumber), entry.accent.map(a => a.accentNumber));
        });
        if (accentMatchResults.length) {
            await Promise.mapSeries(accentMatchResults, async match => {
                const sources = _.cloneDeep(match.sources);
                if (!sources.includes('nhk1998')) {
                    sources.push('nhk1998');
                }

                // Replace because NHK shows silenced vowels and nasal sounds
                const accent = entry.accent;

                let expression = match.expression || "";
                if (!expression.includes(entry.expression)) {
                    expression += `; ${entry.expression}`;
                }

                return match.update({
                    accent: accent,
                    sources: sources,
                    expression: expression
                });
            });
        }
        console.timeLog(logId, `updated/checked ${accentMatchResults.length} accent(s)`);

        const search = jmdicte.filter(x => {
            if (kanjiArray.length == 0 && x.k_ele && x.k_ele.length > 0) {
                return false;
            }

            let kanjiPart = hasKanjiElement(x, fullKanji);

            if (!kanjiPart && hasKana && x.k_ele) {
                kanjiPart = kanjiArray.every(k => x.k_ele.some(r => r.keb.some(kreading => kreading.includes(k))));
                kanjiPart = kanjiPart && x.k_ele.some(r => r.keb.some(kreading => getKanjiArray(kreading).every(k => kanjiArray.includes(k))));
            }

            if (!kanjiPart) {
                return false;
            }

            return x.r_ele.some(r => r.reb.some(reading => possiblyEqualSound(pronunciation, reading)));
        });

        console.timeLog(logId, `returned ${search.length} results for: ${entry.fullKanji} (${entry.kana})`);

        if (search.length === 0) {
            if (accentMatchResults.length === 0) {
                await models.AccentJMDictPair.create(entry);
                console.timeLog(logId, `inserting placeholder from #${entryIndex} of ${data.length} entries`);
            } else {
                console.timeLog(logId, `finished #${entryIndex} of ${data.length} entries`);
            }

            return console.timeEnd(logId);
        }

        let actuallyHandledResults = 0;
        await Promise.map(search, async x => {
            const jmdict = await models.JMdictEntry.findOne({
                where: {
                    [Sequelize.Op.and]: {
                        id: {
                            [Sequelize.Op.notIn]: accentMatchResults.map(a => a.accentEntryId),
                        },
                        reference: {
                            jmdict_id: x.ent_seq[0]
                        }
                    }
                }
            });

            if (jmdict) {
                const specificEntry = _.cloneDeep(entry);
                specificEntry.accurate = hasKanjiElement(x, fullKanji);
                const dbPair = await models.AccentJMDictPair.create(specificEntry);
                await dbPair.setAccentEntry(jmdict);
                actuallyHandledResults++;
            }
        });

        console.timeLog(logId, `inserted ${actuallyHandledResults} mapping(s) from #${entryIndex} of ${data.length} entries`);
        return console.timeEnd(logId);
    }, { concurrency: 20 });
})();
