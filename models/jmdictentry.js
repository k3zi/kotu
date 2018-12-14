'use strict';
module.exports = (sequelize, DataTypes) => {
    let JMdictEntry = sequelize.define('JMdictEntry', {
        id: {
            primaryKey: true,
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4
        },
        reference: {
            type: DataTypes.JSONB
        }
    }, {});
    JMdictEntry.associate = function(models) {
        JMdictEntry.hasMany(models.JMdictKanjiElement, {
            as: 'entryKanjiElements',
            foreignKeyConstraint: true
        });

        JMdictEntry.hasMany(models.JMdictReadingElement, {
            as: 'entryReadingElements',
            foreignKeyConstraint: true
            // TODO: foreignKey: 'entryId'
        });

        JMdictEntry.hasMany(models.JMdictSenseElement, {
            as: 'entrySenseElements',
            foreignKey: 'senseEntryId',
            foreignKeyConstraint: true
        });

        JMdictEntry.hasMany(models.JMdictSenseElement, {
            as: 'allSenseElements',
            foreignKey: 'parentEntryId',
            foreignKeyConstraint: true
        });

        JMdictEntry.hasMany(models.JMdictTranslationElement, {
            as: 'entryTranslationElements',
            foreignKey: 'entryId',
            foreignKeyConstraint: true
        });

        JMdictEntry.hasMany(models.AccentJMDictPair, {
            as: 'entryAccents',
            foreignKey: 'accentEntryId',
            foreignKeyConstraint: true
        });

        JMdictEntry.belongsToMany(models.SentenceExample, {
            as: 'sentenceExamples',
            through: 'SentenceExampleEntry',
            foreignKey: 'entryId',
            otherKey: 'sentenceExampleId',
            foreignKeyConstraint: true
        });
    };
    return JMdictEntry;
};
