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
