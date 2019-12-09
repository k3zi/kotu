'use strict';
module.exports = (sequelize, DataTypes) => {
    let SentenceExampleMedia = sequelize.define('SentenceExampleMedia', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        name: DataTypes.TEXT,
        soundPath: DataTypes.STRING(1000),
        type: DataTypes.STRING,
        sourceId: DataTypes.STRING,
        tags: DataTypes.ARRAY(DataTypes.STRING)
    }, {});
    SentenceExampleMedia.associate = function(models) {
        SentenceExampleMedia.hasMany(models.SentenceExample, {
            as: 'sentences',
            foreignKey: 'mediaId',
            foreignKeyConstraint: true
        });
    };
    return SentenceExampleMedia;
};
