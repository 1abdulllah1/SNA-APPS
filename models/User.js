// models/User.js

class User {
  constructor(id, username, email) { // Removed password
    this.id = id;
    this.username = username;
    this.email = email;
  }
}

module.exports = User; // Export the User class for use in other files
