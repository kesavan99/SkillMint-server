const mongoose = require('mongoose');
require('dotenv').config();

class MongooseConnection {
  constructor() {
    if (MongooseConnection.instance) {
      return MongooseConnection.instance;
    }

    this.isConnected = false;
    MongooseConnection.instance = this;
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      const uri = process.env.MONGODB_URI;
      const dbName = process.env.MONGODB_DB_NAME || 'skill-mint';

      if (!uri) {
        throw new Error(
          'MONGODB_URI environment variable is not set. ' +
          'Please set it in your Render.com dashboard under Environment Variables.'
        );
      }

      await mongoose.connect(uri, {
        dbName: dbName,
        serverApi: {
          version: '1',
          strict: true,
          deprecationErrors: true,
        }
      });

      this.isConnected = true;
      
      await this.initializeDatabase();
      
    } catch (error) {
      console.error('Mongoose connection error:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    try {
      const Teacher = require('./schemas/teacherSchema');
      
      const adminExists = await Teacher.findOne({ user: 'admin' });
      
      if (!adminExists) {
        await Teacher.create({
          user: 'admin',
          password: 'admin'
        });
      }
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
    }
  }

  getConnection() {
    return mongoose.connection;
  }
}

module.exports = new MongooseConnection();
