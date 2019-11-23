const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const escape = require('xml-escape');
const config = require('config');

const XML_IGNORE = '<>\"';
const xmlParser = new xml2js.Parser();
const Promise = require("bluebird");
const _ = require('lodash');

const models = require("../../models");

const jmdictePath = path.join(__dirname, 'jmdict_e', 'main.xml');
const xml = escape(fs.readFileSync(jmdictePath).toString(), XML_IGNORE);

module.exports = new Promise((resolve, reject) => {
    xmlParser.parseString(xml, async (err, obj) => {
        const dict = obj.JMdict.entry;
        console.log(`Loaded JSON: ${dict.length} entries.`);

        await models.sequelize.sync();

        console.log('Synced models.');

        let iii = 0;
        await Promise.map(dict, async (rawEntry, i) => {
            let [entry, createdEntry] = await models.JMdictEntry.findOrCreate({
                where: {
                    reference: {
                        jmdict_id: rawEntry.ent_seq[0]
                    }
                }
            });

            let kanjiElements = await Promise.mapSeries(rawEntry.k_ele || [], async rawKanjiElement => {
                let [kanjiElement] = await models.JMdictKanjiElement.findOrCreate({
                    where: {
                        JMdictEntryId: entry.id,
                        word: rawKanjiElement.keb[0]
                    }
                });

                kanjiElement.info = rawKanjiElement.ke_inf;
                // TODO: Change prioroty → priority
                kanjiElement.prioroty = rawKanjiElement.ke_pri;
                return kanjiElement.save();
            });

            let kanjiRestrictedReadingElements = await Promise.mapSeries(kanjiElements, k => k.getKanjiRestrictedReadingElements);

            let readingElements = await Promise.mapSeries(rawEntry.r_ele || [], async rawReadingElement => {
                let readingElementUniqueData = {
                    word: rawReadingElement.reb[0]
                };

                let readingElement;
                if (rawReadingElement.re_nokanji || !kanjiElements || !kanjiElements.length) {
                    readingElementUniqueData.JMdictEntryId = entry.id;
                    [readingElement] = await models.JMdictReadingElement.findOrCreate({
                        where: readingElementUniqueData
                    });
                } else if (rawReadingElement.re_restr && rawReadingElement.re_restr.length) {
                    readingElement = kanjiRestrictedReadingElements.find(e => e.word === readingElementUniqueData.word);
                    if (!readingElement) {
                        readingElement = await models.JMdictReadingElement.create(readingElementUniqueData);
                    }

                    await Promise.mapSeries(rawReadingElement.re_restr, async restrictedKeb => {
                        let matchingKanjiElements = kanjiElements.filter(e => e.word === restrictedKeb);
                        return Promise.mapSeries(matchingKanjiElements, async kanjiElement => {
                            if (!(await kanjiElement.hasKanjiRestrictedReadingElement(readingElement))) {
                                return kanjiElement.addKanjiRestrictedReadingElement(readingElement);
                            }
                        });
                    });
                } else if (kanjiElements && kanjiElements.length) {
                    readingElement = kanjiRestrictedReadingElements.find(e => e.word === readingElementUniqueData.word);
                    if (!readingElement) {
                        readingElement = await models.JMdictReadingElement.create(readingElementUniqueData);
                    }

                    return Promise.mapSeries(kanjiElements, async kanjiElement => {
                        if (!(await kanjiElement.hasKanjiRestrictedReadingElement(readingElement))) {
                            return kanjiElement.addKanjiRestrictedReadingElement(readingElement);
                        }
                    });
                } else {
                    readingElementUniqueData.JMdictEntryId = entry.id;
                    [readingElement] = await models.JMdictReadingElement.findOrCreate({
                        where: readingElementUniqueData
                    });
                }

                readingElement.info = rawReadingElement.re_inf;
                // TODO: Change prioroty → priority
                readingElement.prioroty = rawReadingElement.re_pri;
                return readingElement.save();
            });

            // Delete old senses
            let oldSenseElements = await entry.getAllSenseElements();
            await Promise.mapSeries(oldSenseElements, e => e.destroy);

            let senseElements = await Promise.mapSeries(rawEntry.sense || [], async rawSenseElement => {
                let senseData = {
                    partsOfSpeech: rawSenseElement.pos || [],
                    fields: rawSenseElement.field || [],
                    misc: rawSenseElement.misc || [],
                    languageSources: rawSenseElement.lsource || [],
                    dialects: rawSenseElement.dial || [],
                    info: rawSenseElement.s_inf || []
                };

                senseData.languageSources = senseData.languageSources.map(rawLanguageSourceValue => {
                    if (_.isString(rawLanguageSourceValue)) {
                        return {
                            value: rawLanguageSourceValue
                        };
                    } else {
                        let attributedValue = rawLanguageSourceValue['$'];
                        attributedValue.value = rawLanguageSourceValue._;
                        return attributedValue;
                    }
                });

                let senseElement = await models.JMdictSenseElement.create(senseData);
                await senseElement.setParentEntry(entry);

                let glosses = (rawSenseElement.gloss || []).map(rawGlossValue => {
                    if (_.isString(rawGlossValue)) {
                        return {
                            value: rawGlossValue,
                            properties: {}
                        };
                    } else {
                        return {
                            value: rawGlossValue._,
                            properties: rawGlossValue['$'] || {}
                        };
                    }
                });

                let glossElements = await Promise.mapSeries(glosses, g => models.JMdictSenseGlossElement.create(g));
                senseElement.setGlosses(glossElements);

                if (!rawSenseElement.stagk && !rawSenseElement.stagr) {
                    await senseElement.setSenseEntry(entry);
                } else {
                    if (rawSenseElement.stagk && rawSenseElement.stagk.length) {
                        await Promise.mapSeries(rawSenseElement.stagk, async restrictedStagK => {
                            let matchingKanjiElements = kanjiElements.filter(e => e.word === restrictedStagK);
                            return Promise.mapSeries(matchingKanjiElements, e => e.addKanjiRestrictedSenseElement(senseElement));
                        });
                    }

                    if (rawSenseElement.stagr && rawSenseElement.stagr.length) {
                        await Promise.mapSeries(rawSenseElement.stagr, async restrictedStagR => {
                            let matchingReadingElements = readingElements.filter(e => e.word === restrictedStagR);
                            return Promise.mapSeries(matchingReadingElements, e => e.addReadingRestrictedSenseElement(senseElement));
                        });
                    }
                }

                return senseElement;
            });

            iii++;
            console.log(`Completed Entry: ${iii} / ${dict.length} = ${ ((100.0 * iii) / dict.length).toFixed(2) }. [kanjiElements: ${kanjiElements.length}, readingElements: ${readingElements.length}, senseElements: ${senseElements.length}]`);
        }, { concurrency: 80 });

        resolve();
    });
});
