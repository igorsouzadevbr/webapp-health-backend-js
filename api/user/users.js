const { v4: uuidv4 } = require('uuid');
const util = require('../util/util.js');
const systemMessages = require('../system/systemMessages.js');
const jwt = require('jsonwebtoken');
const systemObjects = require('../system/systemObjects.js');
const dbUtils = require('../util/databaseUtils.js');
class Users {
  constructor(connection) {
    this.connection = connection;
  }

  verifyLogin(req, res, keyUseAPI) {
    const { email, password } = req.body;
    const cryptoPass = util.convertToSHA256(password);
    const ip = req.ip;

    this.connection.getConnection((err, connection) => {
      if (err) { console.error('Erro ao conectar ao banco de dados:', err.message); return; }

      connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {

        if (err) { connection.release(); return res.sendStatus(500); }
        if (results.length === 0) { console.log('Vai enviar resposta 500'); return res.status(401).send({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

        const userId = results[0].id;
        connection.query('SELECT * FROM users_punishments WHERE userid = ?', userId, (err, results) => {

          if (err) { connection.release(); return res.sendStatus(500); }
          if (results.length > 0) {
            if (results[0].isblocked == 1) { connection.release(); return res.status(429).send({ message: systemMessages.ErrorMessages.BLOCKED_TOO_MUCH_TRIES.message, blockreason: results[0].blockedreason }); }

            if (results[0].isbanned == 1) {
              const bannedDate = results[0].banneddate;
              const data = new Date(bannedDate);

              const dia = String(data.getDate()).padStart(2, '0');
              const mes = String(data.getMonth() + 1).padStart(2, '0');
              const ano = data.getFullYear();
              const horas = String(data.getHours()).padStart(2, '0');
              const minutos = String(data.getMinutes()).padStart(2, '0');

              const dataFormatada = `${dia}/${mes}/${ano} ás ${horas}:${minutos}`;

              connection.release();
              return res.status(429).send({ message: systemMessages.ErrorMessages.BANNED_USER_MESSAGE.message, bannedreason: results[0].bannedreason, banneddate: dataFormatada });
            }
          }



          connection.query('SELECT * FROM login_attempts WHERE ip = ?', [ip], (err, results) => {
            if (err) { connection.release(); return res.sendStatus(500); }

            const timestampNow = new Date();
            let exists = results.length > 0;
            let timestamp = exists ? results[0].timestamp : timestampNow;

            const diffMinutos = (timestampNow - new Date(timestamp)) / 1000 / 60;

            if (exists && diffMinutos < 5 && results[0].tries <= 3) {
              connection.query('UPDATE login_attempts SET tries = tries + 1 WHERE ip = ?', [ip]);
              connection.release();
              return res.status(429).send({ message: systemMessages.ErrorMessages.TOO_MUCH_TRIES.message });
            }
            //bloquear usuário
            if (exists && diffMinutos < 5 && results[0].tries > 3) {
              connection.query('SELECT * FROM users WHERE email = ?', [email], (err, resultsUser) => {
                if (err) { connection.release(); return res.sendStatus(500); }
                const userId = resultsUser[0].id;

                connection.query('SELECT * FROM users_punishments WHERE userid = ?', [userId], (err, results) => {
                  if (err) { connection.release(); return res.sendStatus(500); }

                  if (results.length === 0) {
                    connection.query('INSERT INTO users_punishments(userid, isblocked, blockedreason, blockeddate) VALUES (?,?,?,?)', [userId, 1, 'Excesso de tentativas de login.', timestampNow]);
                    connection.release();
                  } else { connection.query('UPDATE users_punishments SET isblocked=1, blockedreason = ?, blockeddate = ? where userid = ?', ['Excesso de tentativas de login.', timestampNow, userId]); }

                  connection.release();
                });

              });
              return res.status(429).send({ message: systemMessages.ErrorMessages.BLOCKED_TOO_MUCH_TRIES.message });
            }
            connection.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, cryptoPass], (err, resultsUser) => {
              if (err) { connection.release(); return res.sendStatus(500); }

              if (resultsUser.length === 0) {

                if (exists) {
                  if (diffMinutos < 5) {
                    connection.query('UPDATE login_attempts SET tries = tries + 1 WHERE ip = ?', [ip]);
                    connection.release();
                  } else {
                    connection.query('UPDATE login_attempts SET timestamp = ?, tries = 1 WHERE ip = ?', [timestampNow, ip]);
                    connection.release();
                  }
                } else {
                  connection.query('INSERT INTO login_attempts (ip, timestamp, tries) VALUES (?, ?, 1)', [ip, timestampNow]);
                  connection.release();
                }
                return res.status(401).send({ message: systemMessages.ErrorMessages.INCORRECT_USER.message });
              } else {
                connection.release();
                const token = jwt.sign({ useremail: email, useruniqueid: resultsUser[0].uniqueid }, keyUseAPI, { expiresIn: '96h' });
                const authHeader = req.headers['authorization'];
                const secretKey = authHeader && authHeader.split(' ')[1];

                const uniqueid = uuidv4();
                util.logToDatabase({
                  uniqueid: uniqueid,
                  ip: req.ip,
                  method: 'GET',
                  message: 'verifyLogin: ' + JSON.stringify(results),
                  status: 200
                }, this.connection);
                return res.status(200).send({ message: 'Login realizado com sucesso.', token: token, secretKey: secretKey, expiresIn: expiresIn });
              }
            });
          });
        });
      });
    });
  }

  getUserData(req, res) {
    const email = req.params.email;

    if (email == null || !util.isEmail(email)) { return res.status(403).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

    this.connection.getConnection((err, connection) => {
      if (err) { console.error('Erro ao conectar ao banco de dados:', err.message); return; }

      connection.query("SELECT * FROM users where email = ?", [email], (err, results) => {
        connection.release();
        if (err) {
          connection.release();
          console.error('Erro no método getUserData, query n° 1:', err);
          return res.sendStatus(500);
        }
        if (results.length === 0) {
          connection.release();
          return res.status(404).json({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message });
        }
        res.status(200).send({ results });
        const uniqueid = uuidv4();
        util.logToDatabase({
          uniqueid: uniqueid,
          ip: req.ip,
          method: 'GET',
          message: 'getUserData: ' + JSON.stringify(results) + ' - 2023',
          status: 200
        }, this.connection);

      });
    });
  }

  alterUserData(req, res) {
    const uniqueid = req.params.uniqueid;
    const { name, usertype } = req.body;

    this.connection.getConnection((err, connection) => {
      if (err) { console.error('Erro ao conectar ao banco de dados:', err.message); return; }

      connection.query("SELECT * FROM users where uniqueid = ?", [uniqueid], (err, results) => {
        connection.release();
        if (err) {
          connection.release();
          console.error('Erro no método alterUserData, query n° 1:', err);
          return res.sendStatus(500);
        }
        if (results.length === 0) {
          return res.status(404).json({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message });
        }
        const currentUserData = results[0];
        const updatedData = {};
        let hasChanges = false;

        const fieldsToUpdate = {
          name, usertype
        }
        for (const field in fieldsToUpdate) {
          if (fieldsToUpdate[field] && fieldsToUpdate[field] !== currentUserData[field]) {
            updatedData[field] = fieldsToUpdate[field];
            hasChanges = true;
          }
        }
        if (!hasChanges) {
          return res.status(200).send({ message: 'Nenhum campo alterado.' });
        }
        connection.query("update users set ? where uniqueid = ?", [updatedData, uniqueid], (err, results) => {
          connection.release();
          if (err) {
            console.error('Erro no método alterUserData, query n° 2:', err);
            return res.sendStatus(500);
          }

          res.status(200).send({ message: 'Usuário atualizado com sucesso.' });

          //gerar LOG da atualização com data + hora
        });
      });
    });
  }

  create(req, res) {
    const { name, email, phone, birthdate, gender, password } = req.body;
    const uniqueid = uuidv4();

    if (!util.isPhoneNumber(phone)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_PHONE_NUMBER.message }); }
    if (!util.isInteger(gender)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_GENDER.message }); }
    if (!util.isEmail(email)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

    this.connection.getConnection((err, connection) => {
      if (err) { console.error('Erro ao conectar ao banco de dados:', err.message); return; }

      connection.query("SELECT * FROM users where email = ?", [email], (err, results) => {
        connection.release();
        if (err) {
          connection.release();
          console.error('Erro ao verificar e-mail do usuário:', err);
          return res.sendStatus(500);
        }
        if (results.length > 0) { return res.status(409).send({ message: systemMessages.ErrorMessages.EMAIL_ALREADY_EXISTS.message }); }

        //FIM VERIFICAÇÕES

        const formattedPhone = util.formatPhoneNumber(phone);
        const formattedBirthDate = util.formatToDate(birthdate);
        // Inserção do usuário no banco de dados
        const query = 'INSERT INTO users(uniqueid, name, email, password, usertype, phone, birthdate, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        try {
          connection.query(query, [uniqueid, name, email, util.convertToSHA256(password), systemObjects.UserTypes.PACIENTE.id, formattedPhone, formattedBirthDate, gender], (err, results) => {
            connection.release();
            if (err) {
              console.error('Erro ao criar usuário:', err);
              return res.sendStatus(500);
            }

            res.status(200).send({ message: 'Usuário criado com sucesso!', userUniqueId: uniqueid });

          });

        } catch (err) {
          return res.sendStatus(500);
        }
      });
    });
  }





  //LOCATION DATA
  async createLocation(req, res) {
    const userUniqueId = req.params.userUniqueId;
    const { address, number, complement, neighborhood, cityId, stateId, postalCode } = req.body;
    const uniqueid = uuidv4();

    try {
      if (!await util.validateStateById(stateId, this.connection)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_CITY.message }); }
    } catch (error) {
      console.error('Erro ao validar o estado:', error);
      return res.status(500).send({ message: 'Erro ao validar o estado' });
    }

    try {
      if (!await util.validateCityById(cityId, this.connection)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_CITY.message }); }
    } catch (error) {
      console.error('Erro ao validar a cidade:', error);
      return res.status(500).send({ message: 'Erro ao validar a cidade' });
    }

    try {
      if (!await util.validaCEP(postalCode, this.connection)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_POSTAL_CODE.message }); }
    } catch (error) {
      console.error('Erro ao validar o CEP:', error);
      return res.status(500).send({ message: 'Erro ao validar o CEP.' });
    }

    this.connection.getConnection((err, connection) => {
      if (err) { console.error('Erro ao conectar ao banco de dados:', err.message); return; }

      connection.query('SELECT id FROM users where uniqueid = ? and isDeleted = 0', [userUniqueId], (err, results) => {
        connection.release();
        if (err) {
          connection.release();
          console.error('Erro no método createLocation, query n° 1:', err);
          return res.sendStatus(500);
        }
        if (results.length === 0) { connection.release(); return res.status(409).send({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message }); }
        const userId = results[0].id;

        connection.query('SELECT id FROM location where personid = ? and isDeleted = 0', [results[0].id], (err, results) => {
          if (err) {
            connection.release();
            console.error('Erro no método createLocation, query n° 2:', err);
            return res.sendStatus(500);
          }
          if (results.length > 0) { connection.release(); return res.status(409).send({ message: systemMessages.ErrorMessages.USER_ALREADY_HAS_ADDRESS.message }); }

          connection.query('INSERT INTO location(uniqueid, personid, address, number, complement, neighborhood, postalcode, cityId, stateId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [uniqueid, userId, address, number, complement, neighborhood, postalCode, cityId, stateId], (err, results) => {
            if (err) {
              console.error('Erro no método createLocation, query INSERT n° 1:', err);
              return res.sendStatus(500);
            }
            //atualizar endereço no cadastro do usuário
            const generatedLocationId = results.insertId;

            connection.query('UPDATE users SET locationid = ? where id = ?', [generatedLocationId, userId], (err, results) => {
              connection.release();
              if (err) {
                console.error('Erro no método createLocation, query UPDATE n° 1:', err);
                return res.sendStatus(500);
              }
              return res.status(200).send({ message: 'Endereço cadastrado com sucesso.', addressUniqueId: uniqueid });

            });
          });
        });
      });
    });
  }

}

module.exports = Users;