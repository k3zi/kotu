'use strict';
module.exports = {
    up: (queryInterface, DataTypes) => {
        return queryInterface.createTable('JMdictReadingElements', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: DataTypes.INTEGER
            },
            word:  DataTypes.STRING,
            info: DataTypes.ARRAY(DataTypes.STRING),
            prioroty: DataTypes.ARRAY(DataTypes.STRING),
            createdAt: {
                allowNull: false,
                type: DataTypes.DATE
            },
            updatedAt: {
                allowNull: false,
                type: DataTypes.DATE
            }
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('JMdictReadingElements');
    }
};
