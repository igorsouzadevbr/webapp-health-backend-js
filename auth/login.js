const jwt = require('jsonwebtoken');

class Login {
  constructor(secretKey) {
    this.secretKey = secretKey;
  }

  generateToken() {
    return jwt.sign({}, this.secretKey, { expiresIn: '96h' });
  }

  login(req, res) {
    const authHeader = req.headers['authorization'];
    const secretKeyUser = authHeader && authHeader.split(' ')[1];
    if (secretKeyUser != this.secretKey) {return res.status(403).send({ message: 'Token secreto inválido.'}); }
    const token = this.generateToken();

    res.status(200).send({ token, expiresIn: '96h', tokenType: 'Bearer'});

  }
}

module.exports = Login;
