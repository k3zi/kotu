'use strict';
module.exports = (sequelize, DataTypes) => {
    let SentenceExample = sequelize.define('SentenceExample', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        text: DataTypes.TEXT,
        soundPath: DataTypes.STRING(1000),
        startTime: DataTypes.DOUBLE,
        endTime: DataTypes.DOUBLE
    }, {});
    SentenceExample.associate = function(models) {
        SentenceExample.hasMany(models.SentenceExampleComponent, {
            as: 'components',
            foreignKey: 'sentenceExampleComponentId',
            foreignKeyConstraint: true
        });
        SentenceExample.belongsTo(models.SentenceExampleMedia, {
            as: 'media',
            onDelete: "CASCADE",
            targetKey: 'id',
            foreignKeyConstraint: true
        });
    };
    return SentenceExample;
};
