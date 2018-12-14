'use strict';
const bcrypt = require('bcrypt');

module.exports = function(sequelize, DataTypes) {
    let User = sequelize.define('User', {
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
            type: DataTypes.STRING,
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
        role: {
            type: DataTypes.STRING,
            defaultValue: 'user'
        },
        createdAt: {
            allowNull: false,
            type: DataTypes.DATE
        },
        updatedAt: {
            allowNull: false,
            type: DataTypes.DATE
        }
    }, {
        history: true
    });

    User.prototype.validPassword = async function (password) {
        return await bcrypt.compare(password, this.password);
    };

    return User;
}
