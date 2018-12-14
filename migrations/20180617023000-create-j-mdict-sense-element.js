'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('JMdictSenseElements', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            entry_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'JMdictEntries',
                    key: 'id'
                }
            },
            kanji_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'JMdictKanjiElements',
                    key: 'id'
                }
            },
            reading_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'JMdictReadingElements',
                    key: 'id'
                }
            },
            pos: Sequelize.ARRAY(Sequelize.STRING),
            field: Sequelize.ARRAY(Sequelize.STRING),
            misc: Sequelize.ARRAY(Sequelize.STRING),
            languageSource: Sequelize.ARRAY(Sequelize.STRING),
            dialect: Sequelize.ARRAY(Sequelize.STRING),
            glosses: Sequelize.ARRAY(Sequelize.STRING),
            particularLanguage: Sequelize.ARRAY(Sequelize.STRING),
            information: Sequelize.ARRAY(Sequelize.STRING),
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('JMdictSenseElements');
    }
};
