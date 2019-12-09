'use strict';
module.exports = (sequelize, DataTypes) => {
    let SentenceExampleComponent = sequelize.define('SentenceExampleComponent', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        root: DataTypes.TEXT,
        text: DataTypes.TEXT,
        pronunciation: DataTypes.TEXT
    }, {});
    return SentenceExampleComponent;
};
