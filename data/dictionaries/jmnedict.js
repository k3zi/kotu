const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const escape = require('xml-escape');
const config = require('config');

const XML_IGNORE = '<>\"';
const xmlParser = new xml2js.Parser();
const Promise = require("bluebird");
const _ = require('lodash');
const Sequelize = require('sequelize');

// Sequelize Model Import
const models = require("../../models");

const jmnedictPath = path.join(__dirname, 'jmnedict', 'main.xml');
const xml = escape(fs.readFileSync(jmnedictPath).toString(), XML_IGNORE);

module.exports = new Promise((resolve, reject) => {
    xmlParser.parseString(xml, (err, obj) => {
        const dict = obj.JMnedict.entry;
        console.log(`Loaded JSON: ${dict.length} entries.`);
        let i = 0;

        models.sequelize.sync().then(() => {
            function proccesEntry(entry, raw_entry) {
                return new Promise((resolve, reject) => {
                    return Promise.all((raw_entry.k_ele || []).mapSeries(raw_k_ele => {
                        return entry.createEntryKanjiElement({
                            word: raw_k_ele.keb[0],
                            info: raw_k_ele.ke_inf,
                            priority: raw_k_ele.ke_pri
                        });
                    })).then(k_eles => {
                        return Promise.all((raw_entry.r_ele || []).mapSeries(raw_r_ele => {
                            const r_ele_data = {
                                word: raw_r_ele.reb[0],
                                info: raw_r_ele.re_inf || [],
                                priority: raw_r_ele.re_pri || []
                            };

                            return models.JMdictReadingElement.create(r_ele_data).then(r_ele => {
                                if (raw_r_ele.re_nokanji || !k_eles || !k_eles.length) {
                                    return entry.addEntryReadingElement(r_ele).then(x => {
                                        return models.JMdictReadingElement.findByPk(r_ele.id);
                                    });
                                } else if (raw_r_ele.re_restr && raw_r_ele.re_restr.length) {
                                    return Promise.all([].concat.apply([], raw_r_ele.re_restr.map(restricted_keb => {
                                        return k_eles.filter(k_ele => k_ele.word == restricted_keb).map(k_ele => {
                                            return k_ele.addKanjiRestrictedReadingElement(r_ele);
                                        });
                                    }))).then(x => {
                                        return models.JMdictReadingElement.findByPk(r_ele.id);
                                    });
                                } else if (k_eles && k_eles.length) {
                                    return Promise.all(k_eles.map(k_ele => {
                                        return k_ele.addKanjiRestrictedReadingElement(r_ele);
                                    })).then(x => {
                                        return models.JMdictReadingElement.findByPk(r_ele.id);
                                    });
                                } else {
                                    return entry.addEntryReadingElement(r_ele).then(x => {
                                        return models.JMdictReadingElement.findByPk(r_ele.id);
                                    });
                                }
                            });
                        })).then(r_eles => {
                            return Promise.all((raw_entry.trans || []).mapSeries(raw_trans => {
                                const trans_data = {
                                    nameType: raw_trans.name_type ? raw_trans.name_type[0] : '',
                                    translationalEquivalents: raw_trans.trans_det || [],
                                    entry_id: entry.id
                                };

                                return models.JMdictTranslationElement.create(trans_data);
                            }));
                        });
                    }).then(function () {
                        return resolve(entry);
                    }).catch(reject);
                });
            }

            Promise.map(dict, raw_entry => {
                return models.JMdictEntry.create({
                    reference: {
                        'jmnedict_id': raw_entry.ent_seq[0]
                    }
                }).then(entry => {
                    return proccesEntry(entry, raw_entry).then(() => {
                        i++;
                        console.log(`Completed entry: ${i} / ${dict.length} = ${ ((100.0 * i) / dict.length).toFixed(2) }`);
                    });
                });
            }, { concurrency: 40 }).then(lastEntry => {
                console.log(`Inserted: all entries.`);
            }).catch(error => {
                console.log(error);
            });
        });
    });
    resolve();
});
