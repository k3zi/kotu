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
let xml = escape(fs.readFileSync(jmdictePath).toString(), XML_IGNORE);
xmlParser.parseString(xml, async (err, obj) => {
    const dict = obj.JMdict.entry;
    console.log(`Loaded JSON: ${dict.length} entries.`);

    await models.sequelize.sync();

    console.log('Synced models.');

    await Promise.mapSeries(dict, async (rawEntry, i) => {
        let [entry, createdEntry] = await models.JMdictEntry.findOrCreate({
            where: {
                reference: {
                    jmdict_id: rawEntry.ent_seq[0]
                }
            }
        });

        let kanjiElements = await Promise.map(rawEntry.k_ele || [], async rawKanjiElement => {
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

        let kanjiRestrictedReadingElements = await Promise.map(kanjiElements, k => k.getKanjiRestrictedReadingElements);

        let readingElements = await Promise.map(rawEntry.r_ele || [], async rawReadingElement => {
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

                await Promise.map(rawReadingElement.re_restr, async restrictedKeb => {
                    let matchingKanjiElements = kanjiElements.filter(e => e.word === restrictedKeb);
                    return Promise.map(matchingKanjiElements, async kanjiElement => {
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

                return Promise.map(kanjiElements, async kanjiElement => {
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
        await Promise.map(oldSenseElements, e => e.destroy);

        let senseElements = await Promise.map(rawEntry.sense || [], async rawSenseElement => {
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

            let glossElements = await Promise.map(glosses, g => models.JMdictSenseGlossElement.create(g));
            senseElement.setGlosses(glossElements);

            if (!rawSenseElement.stagk && !rawSenseElement.stagr) {
                await senseElement.setSenseEntry(entry);
            } else {
                if (rawSenseElement.stagk && rawSenseElement.stagk.length) {
                    await Promise.map(rawSenseElement.stagk, async restrictedStagK => {
                        let matchingKanjiElements = kanjiElements.filter(e => e.word === restrictedStagK);
                        return Promise.map(matchingKanjiElements, e => e.addKanjiRestrictedSenseElement(senseElement));
                    });
                }

                if (rawSenseElement.stagr && rawSenseElement.stagr.length) {
                    await Promise.map(rawSenseElement.stagr, async restrictedStagR => {
                        let matchingReadingElements = readingElements.filter(e => e.word === restrictedStagR);
                        return Promise.map(matchingReadingElements, e => e.addReadingRestrictedSenseElement(senseElement));
                    });
                }
            }

            return senseElement;
        });

        console.log(`Completed Entry: ${i} / ${dict.length} = ${ ((100.0 * i) / dict.length).toFixed(2) }. [kanjiElements: ${kanjiElements.length}, readingElements: ${readingElements.length}, senseElements: ${senseElements.length}]`);
    });

    console.log(`Inserted/Updated all entries.`);
});
