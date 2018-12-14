'use strict';
module.exports = (sequelize, DataTypes) => {
    const JMdictKanjiElement = sequelize.define('JMdictKanjiElement', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        word:  DataTypes.STRING,
        info: DataTypes.ARRAY(DataTypes.STRING),
        prioroty: DataTypes.ARRAY(DataTypes.STRING),
    }, {});

    JMdictKanjiElement.associate = function(models) {
        JMdictKanjiElement.belongsTo(models.JMdictEntry, {
            as: 'kanjiEntry',
            onDelete: "CASCADE",
            foreignKey: 'entryId',
            foreignKeyConstraint: true
        });

        JMdictKanjiElement.belongsToMany(models.JMdictReadingElement, {
            as: 'kanjiRestrictedReadingElements',
            through: 'JMdictReadingKanji',
            foreignKey: 'kanjiId',
            otherKey: 'readingId',
            foreignKeyConstraint: true
        });

        JMdictKanjiElement.belongsToMany(models.JMdictSenseElement, {
            as: 'kanjiRestrictedSenseElements',
            through: 'JMdictKanjiSense',
            foreignKey: 'kanjiId',
            otherKey: 'senseId',
            foreignKeyConstraint: true
        });
    };

    return JMdictKanjiElement;
};
