const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  phone_email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },

  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  otp: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

}, {
  tableName: 'users',
  timestamps: false,
});


// Hash password before creating user
User.beforeCreate(async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});


// Hash password before updating if changed
User.beforeUpdate(async (user) => {
  if (user.changed('password') && user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});


// Compare password
User.prototype.validatePassword = async function(password) {

  // If user signed in with Google
  if (!this.password) {
    return false;
  }

  return await bcrypt.compare(password, this.password);
};

module.exports = User;