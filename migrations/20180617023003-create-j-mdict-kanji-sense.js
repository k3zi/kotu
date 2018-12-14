'use strict';
module.exports = {
    up: function(queryInterface, Sequelize) {
        return queryInterface.createTable('JMdictKanjiSense', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            kanji_id: {
                type: Sequelize.INTEGER,
                references: { model: 'JMdictKanjiElements', key: 'id' },
                onDelete: 'CASCADE'
            },
            kanji_id: {
                type: Sequelize.INTEGER,
                references: { model: 'JMdictSenseElements', key: 'id' },
                onDelete: 'CASCADE'
            }
        });
    },
    down: function(queryInterface) {
        return queryInterface.dropTable('JMdictKanjiSense');
    }
};
