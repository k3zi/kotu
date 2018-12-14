'use strict';
module.exports = (sequelize, DataTypes) => {
    let JMdictSenseGlossElement = sequelize.define('JMdictSenseGlossElement', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        value: DataTypes.STRING(1000),
        properties: DataTypes.JSONB,
    }, {});

    JMdictSenseGlossElement.associate = function(models) {
        JMdictSenseGlossElement.belongsTo(models.JMdictSenseElement, {
            as: 'glossSense',
            onDelete: "CASCADE",
            targetKey: 'id',
            foreignKeyConstraint: true
        });
    };

    return JMdictSenseGlossElement;
};
