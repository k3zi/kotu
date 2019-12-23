const config = require('config');
const nodemailer = require("nodemailer");
const template = require('art-template');
const moji = require('moji');
const _ = require('lodash');

module.exports = function (passThrough) {
    const { data, models, operatorAliases: Op } = passThrough;

    let exportFinal = {};

    const arow = 'アカガサザタダナハバパマヤラワァャ';
    const irow = 'イキギシジチヂニヒビピミリィ';
    const urow = 'ウクグスズツヅヌフブプムルゥュ';
    const erow = 'エケゲセゼテデネヘベペメレェ';
    const orow = 'オコゴソゾトドノホボポモヨロヲォョ';
    const smallHiragana = 'ぁぃぅぇぉゃゅょゎ';
    const smallKatakana = 'ァィゥェォヵㇰヶㇱㇲㇳㇴㇵㇶㇷㇷ゚ㇸㇹㇺャュョㇻㇼㇽㇾㇿヮ';
    exportFinal.smallKatakana = smallKatakana;

    exportFinal.convertVowelToExtended = function(y) {
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
    };

    exportFinal.possiblyEqualSound = function(a, b, log) {
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
    };

    exportFinal.outputError = function (error) {
        console.log(error);

        return error.toString();
    };

    exportFinal.outputValidationErrors = function (errors) {
        console.log(errors);

        return errors;
    };

    exportFinal.render = function (filename, data) {
        return template(filename, data || {});
    };

    exportFinal.sendMail = function (to, subject, html, callback) {
        let smtpTransport = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            socketTimeout: 5000,
            logger: true,
            auth: {
                user: config.smtp.username,
                pass: config.smtp.password
            }
        });

        smtpTransport.sendMail({
            to: to,
            subject: subject,
            html: html
        }, callback);
    };

    exportFinal.includeAllEntry = [
        {
            model: models.JMdictKanjiElement,
            as: 'entryKanjiElements',
            seperate: true,
            include: [
                {
                    model: models.JMdictReadingElement,
                    as: 'kanjiRestrictedReadingElements'
                },
                {
                    model: models.JMdictSenseElement,
                    as: 'kanjiRestrictedSenseElements',
                    include: [{
                        model: models.JMdictSenseGlossElement,
                        as: 'glosses'
                    }]
                }
            ]
        },
        {
            model: models.JMdictReadingElement,
            as: 'entryReadingElements',
            seperate: true,
            include: [
                {
                    model: models.JMdictSenseElement,
                    as: 'readingRestrictedSenseElements',
                    include: [{
                        model: models.JMdictSenseGlossElement,
                        as: 'glosses'
                    }]
                }
            ]
        },
        {
            model: models.JMdictSenseElement,
            as: 'entrySenseElements',
            seperate: true,
            include: [{
                model: models.JMdictSenseGlossElement,
                as: 'glosses'
            }]
        },
        {
            model: models.JMdictTranslationElement,
            as: 'entryTranslationElements',
            seperate: true
        },
        {
            model: models.AccentJMDictPair,
            as: 'entryAccents',
            seperate: true
        }
    ];

    exportFinal.examplesForEntry = function (entry) {
        const kanjis = entry.entryKanjiElements.map(e => e.word);
        const flattened = arr => [].concat(...arr);
        const kanjiRestrictedReadings = flattened(entry.entryKanjiElements
            .map(e => e.kanjiRestrictedReadingElements))
            .map(e => e.word);
        const readings = entry.entryReadingElements.map(e => e.word);
        const all = kanjis.concat(readings).concat(kanjiRestrictedReadings);

        return exportFinal.examplesContaingArray(all);
    };

    exportFinal.examplesContaing = function (text) {
        return exportFinal.examplesContaingArray([text]);
    }

    exportFinal.examplesContaingArray = function (arr) {
        return models.SentenceExample.findAll({
            where: {
                [Op.or]: [
                    {
                        '$components.text$': arr
                    },
                    {
                        'text': {
                            [Op.like]: {
                                [Op.any]: arr.map(a => `%${a}%`)
                            }
                        }
                    }
                ]
            },
            include: [
                {
                    model: models.SentenceExampleComponent,
                    as: 'components'
                },
                {
                    model: models.SentenceExampleMedia,
                    as: 'media',
                    seperate: true
                }
            ],
            limit: 20
        }).map(m => m.get({ plain: true }));
    };

    exportFinal.resultMapping = function (d) {
        d = d.get({ plain: true });
        let k_ele = d.entryKanjiElements;
        let readings = d.entryReadingElements.map(x => x.word) || [];
        if (k_ele && k_ele.length) {
            k_ele = k_ele.sort((a, b) => a.id - b.id);
            d.entryKanjiElements = k_ele;
            d.title = k_ele.map(k => k.word).join('、');
            readings = readings.concat.apply([], k_ele.map(k => k.kanjiRestrictedReadingElements)).map(r => r.word);
            readings = _.uniq(readings);
            d.subtitle = readings.join('、');
        } else {
            d.title = readings.shift();
            if (readings.length > 0) {
                d.subtitle = readings.join('、');
            } else {
                d.subtitle = '';
            }
        }

        d.meanings = d.entrySenseElements.map(e => {
            return {
                info: e.information || [],
                text: e.glosses.map(g => g.value).join('; ')
            };
        });

        d.link = '/data/term/' + encodeURI(d.id);
        return d;
    }

    exportFinal.searchWordData = function (kanji, reading) {
        return models.JMdictEntry.findAll({
            where: {
                [Op.or]: [
                    {
                        [Op.and]: [
                            {
                                '$entryKanjiElements.word$': {
                                    [Op.like]: `${kanji}`
                                }
                            },
                            {
                                '$entryReadingElements.word$': {
                                    [Op.like]: `${reading}`
                                }
                            }
                        ]
                    },
                    {
                        [Op.and]: [
                            {
                                '$entryKanjiElements.word$': {
                                    [Op.like]: `${kanji}`
                                }
                            },
                            {
                                '$entryKanjiElements.kanjiRestrictedReadingElements.word$': {
                                    [Op.like]: `${reading}`
                                }
                            }
                        ]
                    },
                    {
                        '$entryReadingElements.word$': {
                            [Op.like]: `${reading}`
                        }
                    },
                    {
                        '$entryKanjiElements.word$': {
                            [Op.like]: `${kanji}`
                        }
                    },
                    {
                        '$entryKanjiElements.kanjiRestrictedReadingElements.word$': {
                            [Op.like]: `${reading}`
                        }
                    }
                ]
            },
            include: exportFinal.includeAllEntry
        }).then(results => Promise.all(results.map(exportFinal.resultMapping)));
    };

    exportFinal.getAccentForKanjiKana = function (kanji, kana) {
        let nhkAccents = data.accent.nhk_old.filter(x => {
            return x.kanji === kanji && exportFinal.possiblyEqualSound(kana, x.pronunciation);
        });

        return exportFinal.parseAccents(nhkAccents);
    };

    exportFinal.parseAccents = function (nhkAccents) {
        nhkAccents = nhkAccents.map(a => {
            a = a.get({ plain: true });
            a.set = [{
                kanji: a.kanji,
                kana: a.kana,
                accurate: a.accurate,
                expression: a.expression
            }];
            return a;
        });
        let u = 0;
        let c = 0;
        while (u < nhkAccents.length) {
            let accent1 = nhkAccents[u];
            c = u + 1;
            while (c < nhkAccents.length) {
                let accent2 = nhkAccents[c];
                if (_.isEqual(accent2.accent, accent1.accent)) {
                    accent1.set.push({
                        kanji: accent2.kanji,
                        kana: accent2.kana,
                        accurate: accent2.accurate,
                        expression: accent2.expression
                    });
                    nhkAccents.splice(c, 1);
                } else {
                    c++;
                }
            }
            u++;
        }
        return nhkAccents;
    }

    exportFinal.outputResult = function (message, result) {
        return {
            success: true,
            result: result,
            message: message
        };
    };

    return exportFinal;
};
