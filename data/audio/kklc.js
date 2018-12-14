const ffprobe = require('ffprobe')
const ffprobeStatic = require('ffprobe-static');
const glob = require("glob");
const move = require('move-concurrently');
const fs = require('fs');
const path = require('path');
const unorm = require('unorm');

const jmdicteJSONPath = path.join(__dirname, '..', 'dictionaries', 'jmdict_e', 'main.json');
const jmdicte = require(jmdicteJSONPath);

const audioMaps = [];
const audioMapsJSONPath = path.join(__dirname, 'kklc.json');

function parseFile() {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const name = file.split('/').pop().split('_');
        const kanji = unorm.nfkc(name[0].replace(/[〜~\s]/g, '').trim());
        const hiragana = unorm.nfkc(name[1].split('.')[0].replace(/[〜~\s]/g, '').trim());

        const search = jmdicte.filter(x => {
            const kanjiPart = x.k_ele && x.k_ele.some(k => k.keb.includes(kanji));
            if (!kanjiPart) {
                return false;
            }

            return x.r_ele.some(r => r.reb.includes(hiragana));
        });

        if (search.length) {
            for (let x = 0; x < search.length; x++) {
                const result = search[x];

                audioMaps.push({
                    jmdicte_id: result.ent_seq[0],
                    kanji: kanji,
                    hiragana: hiragana,
                    path: file.split("./").pop()
                });
            }
        } else {
            kanji = kanji.replace('する', '').replace('な', '').replace('の', '').replace('に', '');
            hiragana = hiragana.replace('する', '').replace('な', '').replace('の', '').replace('に', '');
            search = jmdicte.filter(x => {
                const kanjiPart = x.k_ele && x.k_ele.some(k => k.keb.includes(kanji));
                if (!kanjiPart) {
                    return false;
                }

                return x.r_ele.some(r => r.reb.includes(hiragana));
            });

            if (search.length) {
                for (let x = 0; x < search.length; x++) {
                    const result = search[x];

                    audioMaps.push({
                        jmdicte_id: result.ent_seq[0],
                        kanji: kanji,
                        hiragana: hiragana,
                        path: file.split("./").pop()
                    });
                }
            } else {
                console.log(JSON.stringify(jmdicte.filter(x => {
                    return x.k_ele && (x.k_ele.filter(k => k.keb.includes(kanji)).length > 0);
                })));
                console.log(search, "\n\n", kanji, " | ", hiragana, "\n\n\n\n---------------------------");
                console.log(`%${(100.0 * i) / files.length } left.`);
            }
        }
    }

    fs.writeFileSync(audioMapsJSONPath, JSON.stringify(audioMaps), 'utf8');
}

glob("./forvo/*", (er, files) => {
    parseFile(files);
});
