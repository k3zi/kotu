'use strict';
module.exports = (sequelize, DataTypes) => {
    let JMdictTranslationElement = sequelize.define('JMdictTranslationElement', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        nameType: DataTypes.STRING,
        translationalEquivalents: DataTypes.ARRAY(DataTypes.STRING)
    }, {});
    JMdictTranslationElement.associate = function(models) {
        JMdictTranslationElement.belongsTo(models.JMdictEntry, {
            as: 'translationEntry',
            foreignKey: 'entryId',
            onDelete: "CASCADE",
            foreignKeyConstraint: true
        });
    };
    return JMdictTranslationElement;
};
