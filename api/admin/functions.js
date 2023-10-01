const { v4: uuidv4 } = require('uuid');
const util = require('../util/util.js');
const systemObjects = require('../system/systemObjects.js');
const systemMessages = require('../system/systemMessages.js');
class Functions {
  
    constructor(connection) {
        this.connection = connection;
      }

      create(req, res) {
        const { name, email, phone, birthdate, gender, password } = req.body;
        const uniqueid = uuidv4();

        if (!util.isPhoneNumber(phone)) {return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_PHONE_NUMBER.message});}
        if (!util.isInteger(gender)) {return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_GENDER.message});}
        if (!util.isEmail(email)) {return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message}); }

        this.connection.getConnection((err, connection) => {
          if (err) {console.error('Erro ao conectar ao banco de dados:', err.message); return;} 
       

        connection.query("SELECT * FROM users where email = ?", [email], (err, results) => {
           if (err) {
             console.error('Erro ao verificar e-mail do usuário:', err);
             return res.sendStatus(500);
           }
           if (results.length >0) { return res.status(409).send({ message: systemMessages.ErrorMessages.EMAIL_ALREADY_EXISTS.message}); }
           
         //FIM VERIFICAÇÕES
         
         const formattedPhone = util.formatPhoneNumber(phone);
         const formattedBirthDate = util.formatToDate(birthdate);
         // Inserção do usuário no banco de dados
         const query = 'INSERT INTO users(uniqueid, name, email, password, usertype, phone, birthdate, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
         try {
         connection.query(query, [uniqueid, name, email, util.convertToSHA256(password), systemObjects.UserTypes.ADMIN.id, formattedPhone, formattedBirthDate, gender], (err, results) => {
         connection.release(); 
          if (err) {
             console.error('Erro ao criar usuário:', err);
             return res.sendStatus(500);
           }
   
           res.status(200).send({ message: 'Usuário criado com sucesso!'});
         });
       }catch(err) {
         return res.sendStatus(500);
       }
      });
     });
      }

    }
module.exports = Functions;