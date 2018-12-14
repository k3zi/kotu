'use strict';
module.exports = (sequelize, DataTypes) => {
    let JMdictReadingElement = sequelize.define('JMdictReadingElement', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        word:  DataTypes.STRING,
        info: DataTypes.ARRAY(DataTypes.STRING),
        prioroty: DataTypes.ARRAY(DataTypes.STRING),
        restricted: DataTypes.ARRAY(DataTypes.STRING)
    }, {});
    JMdictReadingElement.associate = function(models) {
        // TODO: Delete this duplicate
        JMdictReadingElement.belongsTo(models.JMdictEntry, {
            as: 'readingEntry',
            onDelete: "CASCADE",
            foreignKeyConstraint: true
        });

        JMdictReadingElement.belongsToMany(models.JMdictKanjiElement, {
            as: 'readingRestrictedKanjiElements',
            through: 'JMdictReadingKanji',
            foreignKey: 'readingId',
            otherKey: 'kanjiId',
            foreignKeyConstraint: true
        });

        JMdictReadingElement.belongsToMany(models.JMdictSenseElement, {
            as: 'readingRestrictedSenseElements',
            through: 'JMdictReadingSense',
            foreignKey: 'readingId',
            otherKey: 'senseId',
            foreignKeyConstraint: true
        });
    };
    return JMdictReadingElement;
};
