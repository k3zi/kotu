'use strict';
module.exports = (sequelize, DataTypes) => {
    const JMdictSenseElement = sequelize.define('JMdictSenseElement', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        partsOfSpeech: DataTypes.ARRAY(DataTypes.STRING),
        fields: DataTypes.ARRAY(DataTypes.STRING),
        misc: DataTypes.ARRAY(DataTypes.STRING),
        languageSources: DataTypes.JSONB,
        dialects: DataTypes.ARRAY(DataTypes.STRING),
        info: DataTypes.ARRAY(DataTypes.STRING),
    }, {});

    JMdictSenseElement.associate = function(models) {
        JMdictSenseElement.belongsTo(models.JMdictEntry, {
            as: 'parentEntry',
            onDelete: "CASCADE",
            targetKey: 'id',
            foreignKeyConstraint: true
        });

        JMdictSenseElement.belongsTo(models.JMdictEntry, {
            as: 'senseEntry',
            onDelete: "CASCADE",
            targetKey: 'id',
            foreignKeyConstraint: true
        });

        JMdictSenseElement.belongsToMany(models.JMdictKanjiElement, {
            as: 'senseRestrictedKanjiElements',
            through: 'JMdictKanjiSense',
            foreignKey: 'senseId',
            otherKey: 'kanjiId',
            foreignKeyConstraint: true
        });

        JMdictSenseElement.belongsToMany(models.JMdictReadingElement, {
            as: 'senseRestrictedReadingElements',
            through: 'JMdictReadingSense',
            foreignKey: 'senseId',
            otherKey: 'readingId',
            foreignKeyConstraint: true
        });

        JMdictSenseElement.hasMany(models.JMdictSenseGlossElement, {
            as: 'glosses',
            foreignKey: 'glossSenseId',
            foreignKeyConstraint: true
        });
    };

    return JMdictSenseElement;
};
