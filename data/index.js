const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const escape = require('xml-escape');

const XML_IGNORE = '<>\"';
const xmlParser = new xml2js.Parser();

function addSubFiles(data, passThrough, callback) {
    data.audio = {};
    data.audio.kklc = require(path.join(__dirname, 'audio', 'kklc.json'));
    data.audio.jdic = require(path.join(__dirname, 'audio', 'jdic.json'));

    data.dictionaries = {};
    data.dictionaries.wisdom_j = require(path.join(__dirname, 'dictionaries', 'wisdom_j.json'));
    data.dictionaries.common = [
        {
            provider: '大辞泉',
            data: require(path.join(__dirname, 'dictionaries', 'daijisen.json'))
        },
        {
            provider: '三省堂　スーパー大辞林',
            data: require(path.join(__dirname, 'dictionaries', 'daijirin.json'))
        },
        {
            provider: '研究社　新和英大辞典　第５版',
            data: require(path.join(__dirname, 'dictionaries', 'kenkyusha5.json'))
        },
        {
            provider: '広辞苑第六版 • 付属資料',
            data: require(path.join(__dirname, 'dictionaries', 'kojien6.json'))
        },
        {
            provider: '明鏡国語辞典',
            data: require(path.join(__dirname, 'dictionaries', 'meikyou.json'))
        },
        {
            provider: '故事ことわざの辞典',
            data: require(path.join(__dirname, 'dictionaries', 'kotowaza.json'))
        }
    ];

    const options = {
        shouldSort: true,
        threshold: 0.6,
        location: 0,
        distance: 20,
        maxPatternLength: 32,
        minMatchCharLength: 1,
        keys: [0]
    };

    data.dictionaries.searchCommon = function (entry) {
        const q = (entry.entryKanjiElements && entry.entryKanjiElements.length) ? entry.entryKanjiElements.word : entry.entryReadingElements.word;
        return data.dictionaries.common.map(d => {
           const siftedData = d.data.filter(x => {
               // 0 = expression, 1 = reading, 5 = glossary
               const expression = x[0];
               const reading = x[1];

               if (entry.entryKanjiElements && entry.entryKanjiElements.length) {
                   let kanjiPart = entry.entryKanjiElements.some(k => k.word == expression);
                   if (kanjiPart) {
                       return true;
                   }
               }

               return entry.entryReadingElements.some(r => r.word == expression || r.word == reading);
           });

           const fuse = new Fuse(siftedData, options);
           const results = fuse.search(q).map(result => {

               return {
                   expression: result[0][0],
                   reading: result[1][0],
                   glossary: result[5][0].replace(/(?:\r\n|\r|\n)/g, '<br />')
               }
           });
           return {
               provider: d.provider,
               results: results
           };
       }).filter(p => p.results.length);
   };

    if (callback) {
        callback(data);
    }
}

module.exports = function(passThrough, callback) {
    const data = {};

    // JMDict-E
    const jmdictePath = path.join(__dirname, 'dictionaries', 'jmdict_e', 'main.xml');
    const jmdicteJSONPath = path.join(__dirname, 'dictionaries', 'jmdict_e', 'main.json');
    const lastModifiedPath = jmdictePath + '.lastModified';
    let shouldOverwriteJSON = true;
    const stats = fs.statSync(jmdictePath);
    const mtime = stats.mtime;

    try {
        let lastModified = fs.readFileSync(lastModifiedPath).toString();
        shouldOverwriteJSON = mtime != lastModified;
    } catch (err) {
    }

    if (shouldOverwriteJSON) {
        let xml = escape(fs.readFileSync(jmdictePath).toString(), XML_IGNORE);
        xmlParser.parseString(xml, (err, obj) => {
            let jmdicte = obj.JMdict.entry;
            data.jmdicte = jmdicte;
            fs.writeFileSync(jmdicteJSONPath, JSON.stringify(jmdicte), 'utf8');
            fs.writeFileSync(lastModifiedPath, mtime);
            addSubFiles(data, passThrough, callback);
        });
    } else {
        data.jmdicte = require(jmdicteJSONPath);
        addSubFiles(data, passThrough, callback);
    }

    return data;
}
