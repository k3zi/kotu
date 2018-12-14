'use strict';
module.exports = {
    up: (queryInterface, DataTypes) => {
        return queryInterface.createTable('Users', {
            id: {
                primaryKey: true,
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
            },
            nickname: {
                type: DataTypes.STRING(27)
            },
            username: {
                type: DataTypes.STRING(20),
                notEmpty: true
            },
            email: {
                type: DataTypes.STRING,
                validate: {
                    isEmail: true
                }
            },
            password: {
                type: DataTypes.STRING(30),
                allowNull: false
            },
            active: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            one_time: {
                type: DataTypes.STRING(50)
            },
            last_login: {
                type: DataTypes.DATE
            },
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
    down: (queryInterface, DataTypes) => {
        return queryInterface.dropTable('Users');
    }
};
