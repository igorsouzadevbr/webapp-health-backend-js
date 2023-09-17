const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const app = express();
const rateLimit = require('express-rate-limit');
app.use(express.json());

//depends
const secretTokenKey = '0de6d8af5b6d3d908eca1e93cb5c9f384803ee7ee63ae1c5105e7baa475eca99';
const dotenv = require('dotenv');
const Login = require('./auth/login');
const Users = require('./api/users');
const System = require('./api/system');

//limitador de requisições -- importante identificar o uso real do webapp para deixar em um número bacana de requisições x tempo.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 800, 
  message: "Você excedeu o limite de 800 requisições em 15 minutos."
});

app.use('/api/', limiter);
app.set('trust proxy', 1);

//configuração de ambiente - development - test or production
process.env.NODE_ENV = 'development';


const ENV = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${ENV}` });

//Banco de Dados
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    timezone: '-03:00'
});
connection.connect((err) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
      console.log('Conexão com o banco de dados estabelecida.');
    }
  });

//ROTA DE AUTENTICAÇÃO
const login = new Login(secretTokenKey);
app.post('/api/auth', (req, res) => {
    login.login(req, res);
});

const authenticateClient = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) { return res.status(401).send({ message: 'O token de autenticação fornecido é inválido.' }); }
    
    jwt.verify(token, secretTokenKey, (err, decoded) => {
        if (err) { return res.status(403).send({ message: 'O token de autenticação fornecido está expirado.' }); }
        next();
    });
};

//FIM DA ROTA DE AUTENTICAÇÃO
const users = new Users(connection);
const system = new System(connection);

//ROTA API -- USUARIOS
app.post('/api/users/create', authenticateClient, (req, res) => {
    users.create(req, res);
});
// app.post('/api/users/createWithUserType', authenticateClient, (req, res) => {
//     users.createWithUserType(req, res);
// });
app.put('/api/users/update/:uniqueid', authenticateClient, (req, res) => {
  users.alterUserData(req, res);
});

//SISTEMA
app.get('/api/system/usertypes', authenticateClient, (req, res) => {
    system.getUserTypes(req, res);
});
app.get('/api/system/city/id/:cityid', authenticateClient, (req, res) => {
  system.getCityByID(req, res);
});
app.get('/api/system/city/name/:cityname', authenticateClient, (req, res) => {
  system.getCityByName(req, res);
});
app.get('/api/system/state/id/:stateid', authenticateClient, (req, res) => {
  system.getStateByID(req, res);
});
app.get('/api/system/state/name/:statename', authenticateClient, (req, res) => {
  system.getStateByName(req, res);
});
app.get('/api/system/state/abbreviation/:stateab', authenticateClient, (req, res) => {
  system.getStateByAb(req, res);  
});
app.get('/api/system/gender/id/:genderid', authenticateClient, (req, res) => {
  system.getGenderByID(req, res);
});
app.get('/api/system/gender/name/:gendername', authenticateClient, (req, res) => {
  system.getGenderByName(req, res);
});


app.get('/api/users/login', authenticateClient, (req, res) => {
  users.verifyLogin(req, res);
});
app.get('/api/users/info/:email', authenticateClient, (req, res) => {
    users.getUserData(req, res);
});


//ERRO PARA REQUESTS NÃO SUPORTADOS.
app.use('/api', (req, res) => {
  res.status(405).json( { message: 'Método não suportado' });
});
app.use('/api/', (req, res) => {
  res.status(405).json( { message: 'Método não suportado' });
});
app.get('/', (req, res) => {
    res.json({message: 'Versão da API: ' + process.env.API_VERSION});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ligado na porta:${PORT}`);
});

module.exports = {
 connection
};