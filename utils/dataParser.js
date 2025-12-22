class DataParser {
  static parseUserData(apiResponse) {
    const allowedFields = {
      email: apiResponse.email || apiResponse.emailAddress || apiResponse.mail,
      password: apiResponse.password || apiResponse.pass,
      name: apiResponse.name || apiResponse.fullName || apiResponse.username,
      phone: apiResponse.phone || apiResponse.phoneNumber || apiResponse.mobile
    };

    const cleanData = {};
    
    for (const [key, value] of Object.entries(allowedFields)) {
      if (value !== undefined && value !== null && value !== '') {
        cleanData[key] = value;
      }
    }

    return cleanData;
  }

  static parseSignupData(apiResponse) {
    return {
      email: apiResponse.email,
      password: apiResponse.password,
      name: apiResponse.name || null,
      phone: apiResponse.phone || null
    };
  }

  static parseLoginData(apiResponse) {
    return {
      email: apiResponse.email,
      password: apiResponse.password
    };
  }

  static parseProfileData(apiResponse) {
    const profileData = {};
    
    const fieldMapping = {
      email: ['email', 'emailAddress', 'mail', 'userEmail'],
      name: ['name', 'fullName', 'userName', 'displayName'],
      phone: ['phone', 'phoneNumber', 'mobile', 'contactNumber'],
      address: ['address', 'location', 'addr'],
      age: ['age', 'yearsOld'],
      gender: ['gender', 'sex']
    };

    for (const [targetField, possibleKeys] of Object.entries(fieldMapping)) {
      for (const key of possibleKeys) {
        if (apiResponse[key] !== undefined && apiResponse[key] !== null) {
          profileData[targetField] = apiResponse[key];
          break;
        }
      }
    }

    return profileData;
  }

  static removeUnwantedFields(data, allowedFields) {
    const cleanData = {};
    
    allowedFields.forEach(field => {
      if (data.hasOwnProperty(field)) {
        cleanData[field] = data[field];
      }
    });

    return cleanData;
  }

  static sanitizeInput(data) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        sanitized[key] = value.trim();
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

module.exports = DataParser;
