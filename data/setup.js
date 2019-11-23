const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const zlib = require('zlib');

function downloadToPath(url, path) {
    return new Promise((resolve, reject) => {
        http.get(url, response => {
            const statusCode = response.statusCode;
            if (statusCode !== 200) {
                return reject('Download error!');
            }

            const writeStream = fs.createWriteStream(path);
            response.pipe(writeStream);
            writeStream.on('error', (e) => reject(`Error writing to file: ${e}`));
            writeStream.on('finish', () => writeStream.close(resolve));
        });
    });
}

function decompressGZToPath(compressedPath, path) {
    return new Promise((resolve, reject) => {
        const compressedContents = fs.createReadStream(compressedPath);
        const writeStream = fs.createWriteStream(path);
        const unzip = zlib.createGunzip();
        compressedContents.pipe(unzip).pipe(writeStream);
        writeStream.on('error', (e) => reject(`Error writing to file: ${e}`));
        writeStream.on('finish', () => writeStream.close(resolve));
    });
}

(async function() {
    // Japanese Dictionary
    const japaneseDictionaryCompressedFile = path.join(__dirname, 'dictionaries/jmdict_e/main.xml.gz');
    const japaneseDictionaryFile = path.join(__dirname, 'dictionaries/jmdict_e/main.xml');
    const japaneseDictionaryFileURL = 'http://ftp.monash.edu/pub/nihongo/JMdict_e.gz';

    console.log(`Downloading Japanese dictionary...`);
    await downloadToPath(japaneseDictionaryFileURL, japaneseDictionaryCompressedFile);
    console.log(`Downloaded Japanese dictionary.`);
    console.log(`Decompressing Japanese dictionary...`);
    await decompressGZToPath(japaneseDictionaryCompressedFile, japaneseDictionaryFile);
    console.log(`Decompressed Japanese dictionary.`);
    console.log(`Parsing Japanese dictionary...`);
    await require(path.join(__dirname, 'dictionaries/jmdict.js'))();

    // Japanese Proper Names Dictionary
    const japaneseProperNamesDictionaryCompressedFile = path.join(__dirname, 'dictionaries/jmnedict/main.xml.gz');
    const japaneseProperNamesDictionaryFile = path.join(__dirname, 'dictionaries/jmnedict/main.xml');
    const japaneseProperNamesDictionaryFileURL = 'http://ftp.monash.edu/pub/nihongo/JMnedict.xml.gz';
    console.log(`Downloading Japanese proper names dictionary...`);
    await downloadToPath(japaneseProperNamesDictionaryFileURL, japaneseProperNamesDictionaryCompressedFile);
    console.log(`Downloaded Japanese proper names dictionary.`);
    console.log(`Decompressing Japanese proper names dictionary...`);
    await decompressGZToPath(japaneseProperNamesDictionaryCompressedFile, japaneseProperNamesDictionaryFile);
    console.log(`Decompressed Japanese proper names dictionary.`);
    console.log(`Parsing Japanese proper names dictionary...`);
    await require(path.join(__dirname, 'dictionaries/jmnedict.js'))();
})();
