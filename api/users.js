class Users {
    constructor(connection) {
        this.connection = connection;
      }

      verifyLogin(req, res, keyUseAPI) {
        const { email, password } = req.body;
        const util = require('./util/util.js');
        const jwt = require('jsonwebtoken');
        const cryptoPass = util.convertToSHA256(password);
        const query = `SELECT * FROM users WHERE email = ?`;
        this.connection.query(query, [email], (err, results) => {
          if (err) {
            console.error('Erro ao obter usuários:', err);
            return res.sendStatus(500);
          }
          if (results.length <= 0) { 
            return res.status(409).send({ message: 'Usuário inexistente.'});
          }
          if (results[0].password !== cryptoPass) {
          return res.status(409).send({ message: 'Senha incorreta.'});
          }
          
          //gerar token para utilização do usuário
          const token = jwt.sign({useremail: email, useruniqueid: results[0].uniqueid}, keyUseAPI, { expiresIn: '24h' });
          const authHeader = req.headers['authorization'];
          const secretKey = authHeader && authHeader.split(' ')[1];
          res.status(200).send({ message: 'Login realizado com sucesso.', token: token, secretKey: secretKey });
          const { v4: uuidv4 } = require('uuid');
          const uniqueid = uuidv4();
          util.logToDatabase({
              uniqueid: uniqueid,
              ip: req.ip,
              method: 'GET',
              message: 'verifyLogin: ' + JSON.stringify(results),
              status: 200
          });
          this.connection.release();
        });
      }

      getUserData(req, res) {
        const email = req.params.email;
        const util = require('./util/util.js');
        if (email == null || !util.isEmail(email)) {return res.status(403).json({ message: 'Informe um endereço de e-mail válido.'});    }

        this.connection.query("SELECT * FROM users where email = ?", [email], (err, results) => {
          if (err) {
            console.error('Erro no método getUserData, query n° 1:', err);
            return res.sendStatus(500);
          }
          if (results.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.'});     
          }
          res.status(200).send({ results });
          const { v4: uuidv4 } = require('uuid');
          const uniqueid = uuidv4();
          util.logToDatabase({
              uniqueid: uniqueid,
              ip: req.ip,
              method: 'GET',
              message: 'getUserData: ' + JSON.stringify(results) + ' - 2023',
              status: 200
          });
          this.connection.release();
        });
      }

      alterUserData(req, res) {
        const uniqueid = req.params.uniqueid;
        const { name, usertype } = req.body;

        this.connection.query("SELECT * FROM users where uniqueid = ?", [uniqueid], (err, results) =>
        {
          if (err) {
            console.error('Erro no método alterUserData, query n° 1:', err);
            return res.sendStatus(500);
          }
          if (results.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.'});     
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
            return res.status(200).send({ message: 'Nenhum campo alterado.'});
          }
          this.connection.query("update users set ? where uniqueid = ?", [updatedData, uniqueid], (err, results) => {
            if (err) {
              console.error('Erro no método alterUserData, query n° 2:', err);
              return res.sendStatus(500);
            }

            res.status(200).send({ message: 'Usuário atualizado com sucesso.' });
            this.connection.release();
            //gerar LOG da atualização com data + hora
          });
        });
      }
      create (req, res, ) {
        const { name, email, phone, birthdate, gender, password } = req.body;
        const { v4: uuidv4 } = require('uuid');
        const uniqueid = uuidv4();
        const util = require('./util/util.js');
        
        if (!util.isPhoneNumber(phone)) {return res.status(409).send({ message: 'O telefone informado não é válido.'});}
        if (!util.isInteger(gender)) {return res.status(409).send({ message: 'O gênero informado não é um número.'});}
        if (!util.isEmail(email)) {return res.status(409).send({ message: 'O campo EMAIL informado não é um e-mail válido.'}); }

        this.connection.query("SELECT * FROM users where email = ?", [email], (err, results) => {
           if (err) {
             console.error('Erro ao verificar e-mail do usuário:', err);
             return res.sendStatus(500);
           }
           if (results.length >0) { return res.status(409).send({ message: 'E-mail informado já existe.'}); }
           
         //FIM VERIFICAÇÕES
         
         const formattedPhone = util.formatPhoneNumber(phone);
         const formattedBirthDate = util.formatToDate(birthdate);
         // Inserção do usuário no banco de dados
         const query = 'INSERT INTO users(uniqueid, name, email, password, usertype, phone, birthdate, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
         try {
         this.connection.query(query, [uniqueid, name, email, util.convertToSHA256(password), 1, formattedPhone, formattedBirthDate, gender], (err, results) => {
           if (err) {
             console.error('Erro ao criar usuário:', err);
             return res.sendStatus(500);
           }
   
           res.status(200).send({ message: 'Usuário criado com sucesso!'});
           this.connection.release();
         });
       }catch(err) {
         return res.sendStatus(500);
       }
     });
     }
      
}

module.exports = Users;