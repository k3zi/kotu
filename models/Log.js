'use strict';
module.exports = (sequelize, DataTypes) => {
    let Log = sequelize.define('Log', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.BIGINT,
      },
      type: {
        allowNull: false,
        type: DataTypes.ENUM('UPDATE', 'ERROR', 'REQUEST', 'DELETE'),
      },
      reference: {
        allowNull: true,
        type: DataTypes.STRING(64),
      },
      data: {
        allowNull: false,
        type: DataTypes.TEXT,
      },
      executionTime: {
        allowNull: true,
        type: DataTypes.FLOAT,
      },
      createdAt: {
        allowNull: true,
        type: DataTypes.DATE,
      },
    }, {
      timestamps: true,
      updatedAt: false,
      tableName: 'logs',
      freezeTableName: true,
      history: false, // make sure the logging table has no history
    });

    Log.log = async function log(values, options) {
      values.forEach((v) => {
        v.data = JSON.stringify(v.data);
      });
      return this.bulkCreate(values, { transaction: options.transaction });
    };
    return Log;
};
