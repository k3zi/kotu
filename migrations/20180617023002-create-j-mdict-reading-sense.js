'use strict';
module.exports = {
    up: function(queryInterface, Sequelize) {
        return queryInterface.createTable('JMdictReadingSense', {
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
                references: { model: 'JMdictSenseElements', key: 'id' },
                onDelete: 'CASCADE'
            }
        });
    },
    down: function(queryInterface) {
        return queryInterface.dropTable('JMdictReadingSense');
    }
};
