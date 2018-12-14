'use strict';
module.exports = (sequelize, DataTypes) => {
    let SentenceExample = sequelize.define('SentenceExample', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        japanese: DataTypes.TEXT,
        english: DataTypes.TEXT,
        soundPath: DataTypes.STRING(1000),
        type: DataTypes.STRING,
        source: DataTypes.STRING
    }, {});
    SentenceExample.associate = function(models) {
        SentenceExample.belongsToMany(models.JMdictEntry, {
            as: 'sentenceExampleEntries',
            through: 'SentenceExampleEntry',
            foreignKey: 'sentenceExampleId',
            otherKey: 'entryId',
            foreignKeyConstraint: true
        });
    };
    return SentenceExample;
};
