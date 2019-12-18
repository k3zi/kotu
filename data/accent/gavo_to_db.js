process.env["NODE_CONFIG_DIR"] = __dirname + "/../../config/";
const _ = require('lodash');
const config = require('config');
const fs = require('fs');
const path = require('path');
const neatCsv = require('neat-csv');
const moji = require('moji');
const Promise = require('bluebird');
const Sequelize = require('sequelize');
const rp = require('request-promise');
const cheerio = require('cheerio');
const download = require('download');

// Sequelize Model Import
const models = require("../../models");
const baseAudioLink = 'http://www.gavo.t.u-tokyo.ac.jp/ojad/ajax/wave_download';

(async () => {
    await models.sequelize.sync();
    const helpers = require(config.directory.server + '/helpers')({
        models: models
    });

    await Promise.mapSeries(new Array(128), async (item, index) => {
        const page = index + 1;

        options.url = "http://www.gavo.t.u-tokyo.ac.jp/ojad/search/index/page:" + page + "/limit:100/sortprefix:accent/narabi1:kata_asc/narabi2:accent_asc/narabi3:mola_asc/yure:visible/curve:invisible/details:invisible";
        const $ = await rp({
            transform: function (body) {
                return cheerio.load(body);
            }
        });
        await Promise.map($('#word_table tbody tr').toArray(), async (wordRow, wordRowIndex) => {
            console.log("\n\n" + 'Word #' + wordRowIndex + ' on Page #' + page);
            console.log('----------------------------------------');
            const $wordRow = $(wordRow);
            const rawMidashis = $wordRow.find('.midashi_word').text().split('・').map(x => x.trim());
            const firstMidashi = rawMidashis[0];
            let secondMidashi = firstMidashi;
            let removedOnPlainForm = 0;
            if (firstMidashi.endsWith('[な]')) {
                secondMidashi = firstMidashi.replace('[な]', '');
                removedOnPlainForm = 1;
            } else if (firstMidashi.endsWith('する') && firstMidashi !== 'する') {
                secondMidashi = firstMidashi.replace('する', '');
                removedOnPlainForm = 2;
            }

            console.log('firstMidashi: ', firstMidashi);
            console.log('secondMidashi: ', secondMidashi);

            const parentAccentPairs = [];
            await Promise.mapSeries($wordRow.find('.katsuyo').toArray(), async conjiguation => {
                const $conjiguation = $(conjiguation).removeClass('katsuyo');
                const conjiguationType = $conjiguation.attr('class').trim().replace('_js', '');
                console.log("");
                console.log('conjiguationType: ', conjiguationType);

                await Promise.map($conjiguation.find('.katsuyo_proc').toArray(), async pronunciationVariation => {
                    const $pronunciationVariation = $(pronunciationVariation);
                    let accentString = "";
                    let accentNumber = 0;
                    $pronunciationVariation.find('.accented_word > span').each((i, elem) => {
                        const $elem = $(elem);
                        accentString += $elem.text().trim();
                        if ($elem.hasClass('accent_top')) {
                            accentString += "＼";
                            accentNumber = i + 1;
                        }
                    });

                    accentString = moji(accentString).convert('HG', 'KK').toString();
                    const regularWord = accentString.replace('＼', '');
                    let plainWord = regularWord;
                    if (removedOnPlainForm > 0) {
                        plainWord = regularWord.slice(0, -removedOnPlainForm);
                    }
                    if (conjiguationType === 'katsuyo_ishi' && accentString.slice(-1) === 'ウ') {
                        accentString = accentString.slice(0, -1) + 'ー';
                    }

                    console.log(`accentString: ${accentString}`);
                    console.log(`accentNumber: ${accentNumber}`);
                    console.log(`plainWord: ${plainWord}`);

                    const additionalAudioPaths = [];
                    await Promise.map($pronunciationVariation.find('.katsuyo_proc_button > a').toArray(), async elem => {
                        try {
                            const $elem = $(elem);
                            const id = $elem.attr('id');
                            const info = id.includes('female') ? 'female' : 'male';
                            const url = baseAudioLink + '/'+ id + '/' + id;

                            const soundFile = `./gavo.t.u-tokyo.ac.jp/${id}.mp3`;
                            if (!fs.existsSync(soundFile)) {
                                const data = await download(url);
                                fs.writeFileSync(soundFile, data);
                            }

                            additionalAudioPaths.push({
                                gender: info,
                                path: 'gavo.t.u-tokyo.ac.jp/' + id + '.mp3',
                                source: 'gavo.t.u-tokyo.ac.jp'
                            });
                        } catch (error) {
                            console.error(error);
                        }
                    });

                    // Now we have everything we need.

                    if (conjiguationType === 'katsuyo_jisho') {
                        let results = await models.AccentJMDictPair.findAll({
                            where: {
                                kanji: {
                                    [Sequelize.Op.contains]: [secondMidashi]
                                }
                            }
                        });

                        console.log('Found ', results.length, ' results.');

                        results = results.filter(result => {
                            const test1 = result.kana.some(k => helpers.possiblyEqualSound(k, plainWord));
                            if (!test1) {
                                return false;
                            }

                            return result.accent.some(a => a.accentNumber == accentNumber);
                        });

                        console.log('Narrowed down to ', results.length, ' results.');
                        results.forEach(result => {
                            if (removedOnPlainForm > 0) {
                                return;
                            }

                            if (!result.sources.includes('gavo.t.u-tokyo.ac.jp')) {
                                result.sources.push('gavo.t.u-tokyo.ac.jp');
                            }

                            if (!result.notes.includes(conjiguationType)) {
                                result.notes.push(conjiguationType);
                            }

                            if (!result.audioPaths || !_.isArray(result.audioPaths)) {
                                result.audioPaths = additionalAudioPaths;
                            } else {
                                additionalAudioPaths.forEach(pathInfo => {
                                    if (!result.audioPaths.some(c => c.path == pathInfo.path)) {
                                        result.audioPaths.push(pathInfo);
                                    }
                                });
                            }
                        });

                        await Promise.map(results, result => {
                            parentAccentPairs.push(result);
                            return result.save();
                        });
                    }

                    if (conjiguationType !== 'katsuyo_jisho' || removedOnPlainForm > 0) {
                        await Promise.map(parentAccentPairs, parentAccentPair => {
                            return models.AccentJMDictPair.create({
                                parentAccentPairId: parentAccentPair.id,
                                accent: [{
                                    accentString: accentString,
                                    accentNumber: accentNumber
                                }],
                                accurate: true,
                                fullKanji: '',
                                kana: [regularWord],
                                expression: '',
                                kanji: [],
                                notes: [conjiguationType],
                                sources: ['gavo.t.u-tokyo.ac.jp'],
                                audioPaths: additionalAudioPaths
                            });
                        });
                    }
                });
            });
        });
    });
})();
