'use strict';
module.exports = {
    up: function(queryInterface, Sequelize) {
        return queryInterface.createTable('JMdictReadingKanji', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            reading_id: {
                type: Sequelize.INTEGER,
                references: { model: 'JMdictReadingElements', key: 'id' },
                onDelete: 'CASCADE'
            },
            kanji_id: {
                type: Sequelize.INTEGER,
                references: { model: 'JMdictKanjiElements', key: 'id' },
                onDelete: 'CASCADE'
            }
        });
    },
    down: function(queryInterface) {
        return queryInterface.dropTable('JMdictReadingKanji');
    }
};
