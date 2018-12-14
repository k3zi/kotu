'use strict';
module.exports = (sequelize, Sequelize) => {
    let AccentJMDictPair = sequelize.define('AccentJMDictPair', {
        id: {
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
        },
        accent: {
            type: Sequelize.JSONB
        },
        kana: {
            type: Sequelize.STRING
        },
        kanji: {
            type: Sequelize.ARRAY(Sequelize.STRING)
        },
        fullKanji: {
            type: Sequelize.STRING
        },
        expression: {
            type: Sequelize.STRING
        },
        sources: {
            type: Sequelize.ARRAY(Sequelize.STRING)
        },
        notes: {
            type: Sequelize.ARRAY(Sequelize.TEXT)
        },
        accurate: {
            type: Sequelize.BOOLEAN
        }
    }, {
        history: true
    });

    AccentJMDictPair.associate = function(models) {
        AccentJMDictPair.belongsTo(models.JMdictEntry, {
            as: 'accentEntry',
            onDelete: "CASCADE",
            foreignKeyConstraint: true
        });
    };

    return AccentJMDictPair;
};
