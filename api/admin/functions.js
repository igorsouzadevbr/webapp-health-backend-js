class Functions {
    constructor(connection) {
        this.connection = connection;
      }
      create(req, res) {
        const { name, email, phone, birthdate, gender, password } = req.body;
        const { v4: uuidv4 } = require('uuid');
        const uniqueid = uuidv4();
        const util = require('../util/util.js');
        
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
         this.connection.query(query, [uniqueid, name, email, util.convertToSHA256(password), 4, formattedPhone, formattedBirthDate, gender], (err, results) => {
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
module.exports = Functions;