const glob = require("glob");
const move = require('move-concurrently');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const config = require('config');
const _ = require('lodash');

const jmdicteJSONPath = path.join(__dirname, 'jmdict_e', 'main.json');
const jmdicte = require(jmdicteJSONPath);

const wisdomEMap = [];
const wisdomEMapJSONPath = path.join(__dirname, 'wisdom_e.json');

const wisdomJMap = [];
const wisdomJMapJSONPath = path.join(__dirname, 'wisdom_j.json');

function parseFile() {
    console.log(`Loaded ${files.length} files.`);
    for (const i = 0; i < files.length; i++) {
        const file = files[i];
        let xml = fs.readFileSync(file, 'utf8');
        if (xml.startsWith(':entry')) {
            xml = "<d" + xml;
        } else if (xml.startsWith('d:entry')) {
            xml = "<" + xml;
        }
        const $ = cheerio.load(xml);

        const title = $('.hw').first().text();
        const subtitle = $('.hv').first().text() || title;
        const fileName = $('.entry').first().attr("d:title");
        if (!title || !subtitle || !fileName) {
            continue;
        }

        if (fileName.match(config.isJapanese)) {
            const hiragana = title.replace(/[~―〜\-\(\)\s『』]*/g, '');
            const kanjis = _.without(subtitle.replace(/[~―〜\-\(\)\s『』]*/g, '').split(','), '', null);

            const search = jmdicte.filter(x => {
                if (kanjis.length > 0) {
                    const kanjiPart = (x.k_ele && x.k_ele.some(k => _.intersection(k.keb, kanjis).length > 0)) || x.r_ele.some(k => _.intersection(k.reb, kanjis).length > 0);
                    if (!kanjiPart) {
                        return false;
                    }
                }

                return x.r_ele.some(r => r.reb.includes(hiragana));
            });

            if (search.length) {
                for (let x = 0; x < search.length; x++) {
                    const result = search[x];

                    wisdomJMap.push({
                        jmdicte_id: result.ent_seq[0],
                        kanji: kanjis.join('、'),
                        hiragana: hiragana,
                        path: file.split("./").pop()
                    });
                }
            } else {
                console.log(JSON.stringify(jmdicte.filter(x => {
                    if (kanjis.length > 0) {
                        const kanjiPart = (x.k_ele && x.k_ele.some(k => _.intersection(k.keb, kanjis).length > 0)) || x.r_ele.some(k => _.intersection(k.reb, kanjis).length > 0);
                        if (!kanjiPart) {
                            return false;
                        }
                    }

                    return true;
                })));
                console.log(JSON.stringify(jmdicte.filter(x => {
                    return x.r_ele.some(r => r.reb.includes(hiragana));
                })));
                console.log(`${hiragana}|${kanjis.join('、')}|`);
                console.log(`%${(100.0 * i) / files.length} completed. ${wisdomJMap.length} inserted.`);
            }
        } else {
            /*wisdomEMap.push({
                title: title,
                subtitle: subtitle,
                path: file.split("./").pop()
            });*/
        }
    }

    /*fs.writeFileSync(wisdomEMapJSONPath, JSON.stringify(wisdomEMap), 'utf8');*/
    fs.writeFileSync(wisdomJMapJSONPath, JSON.stringify(wisdomJMap), 'utf8');
}
module.exports = new Promise((resolve, reject) => {
    glob("./wisdom/*.html", function (error, files) {
        if (error) {
            return reject(error);
        }

        parseFile(files.reverse());
        resolve();
    });
};
