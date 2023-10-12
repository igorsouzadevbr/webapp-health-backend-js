const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const app = express();
app.use(bodyParser.json({ limit: '5mb' }));
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
  allowedHeaders: 'Authorization,Content-Type',
};
app.use(cors(corsOptions));
app.use(express.json());

//depends
const secretTokenKey = '0de6d8af5b6d3d908eca1e93cb5c9f384803ee7ee63ae1c5105e7baa475eca99';
const adminSecretTokenKey = '3E5E085DBA7951B401D811CAE24DF052C6D91065B2ACCE3833EE7CD52A9DA330';
const attendantSecretTokenKey = '2EC250AC6273C76BC50E7C8E1D7141632A9D35D131EFF249341FAAB2F798EF9F'
const professionalSecretTokenKey = '08EF27C501561F8A1C7237D1503DC0D7AF1441D2D1C3630421C2820945C38349';
const dotenv = require('dotenv');
const Login = require('./auth/login');
const Users = require('./api/user/users');
const System = require('./api/system');
const AdminFunctions = require('./api/admin/functions');
const DatabaseUtils = require('./api/util/databaseUtils');
const AlterDataWithTokens = require('./api/user/alterDataWithTokens');

//limitador de requisições -- importante identificar o uso real do webapp para deixar em um número bacana de requisições x tempo.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Você excedeu o limite de requisições em 15 minutos."
});
app.use('/api/', limiter);
app.set('trust proxy', 1);
//configuração de ambiente - development - test or production
process.env.NODE_ENV = 'development';


const ENV = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${ENV}` });

//Banco de Dados
const connection = mysql.createPool({
  connectionLimit: 800,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  queueLimit: 0,
  timezone: '-03:00'
});
connection.getConnection((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conexão com o banco de dados estabelecida.');
  }
});

//ROTAS DE AUTENTICAÇÃO
const clientLogin = new Login(secretTokenKey);
app.options('*', cors(corsOptions));
app.post('/api/auth', (req, res) => {
  clientLogin.login(req, res);
});
const adminLogin = new Login(adminSecretTokenKey);
app.options('*', cors(corsOptions));
app.post('/api/admin/auth', (req, res) => {
  adminLogin.login(req, res);
});
const attendantLogin = new Login(attendantSecretTokenKey);
app.options('*', cors(corsOptions));
app.post('/api/attendant/auth', (req, res) => {
  attendantLogin.login(req, res);
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

const authenticateAdministrator = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { return res.status(401).send({ message: 'O token de autenticação fornecido é inválido.' }); }

  jwt.verify(token, adminSecretTokenKey, (err, decoded) => {
    if (err) { return res.status(403).send({ message: 'O token de autenticação fornecido está expirado.' }); }
    next();
  });
};

const authenticateAttendant = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { return res.status(401).send({ message: 'O token de autenticação fornecido é inválido.' }); }

  jwt.verify(token, attendantSecretTokenKey, (err, decoded) => {
    if (err) { return res.status(403).send({ message: 'O token de autenticação fornecido está expirado.' }); }
    next();
  });
};

const authenticateProfessional = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { return res.status(401).send({ message: 'O token de autenticação fornecido é inválido.' }); }

  jwt.verify(token, professionalSecretTokenKey, (err, decoded) => {
    if (err) { return res.status(403).send({ message: 'O token de autenticação fornecido está expirado.' }); }
    next();
  });
};

const authenticateUser = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const { secretKey } = req.body;
  if (!token) { return res.status(401).send({ message: 'O token de autenticação fornecido é inválido.' }); }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) { return res.status(403).send({ message: 'O token de autenticação fornecido está expirado.' }); }
    next();
  });
};

//FIM DA ROTA DE AUTENTICAÇÃO
const users = new Users(connection);
const system = new System(connection);
const adminFunctions = new AdminFunctions(connection);
const databaseUtils = new DatabaseUtils(connection);
const alterDataWithTokens = new AlterDataWithTokens(connection);

//ROTA API -- ADMINS
app.options('*', cors(corsOptions));
app.put('/api/admin/users/create', authenticateAdministrator, (req, res) => {
  adminFunctions.create(req, res);
});


//ROTA API -- USUARIOS
app.options('*', cors(corsOptions));
app.put('/api/users/create', authenticateClient, (req, res) => {
  users.create(req, res);
});
app.options('*', cors(corsOptions));
app.patch('/api/users/update/location', authenticateClient, (req, res) => {
  users.createLocation(req, res);
});
app.options('*', cors(corsOptions));
app.patch('/api/update/users/:uniqueid', authenticateClient, (req, res) => {
  users.alterUserData(req, res);
});
app.options('*', cors(corsOptions));
app.post('/api/users/login', authenticateClient, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  users.verifyLogin(req, res, token);
});
//mudar o codigo dos demais metodos
app.options('*', cors(corsOptions));
app.get('/api/users/update/token/password', authenticateUser, (req, res) => {
  alterDataWithTokens.getTokenToAlterUserPassword(req, res);
});
app.options('*', cors(corsOptions));
app.patch('/api/update/users/password', authenticateUser, (req, res) => {
  alterDataWithTokens.verifyTokenAndAlterUserPassword(req, res);
});
app.options('*', cors(corsOptions));
app.get('/api/users/update/token/email', authenticateUser, (req, res) => {
  alterDataWithTokens.getTokenToAlterUserEmail(req, res);
});
app.options('*', cors(corsOptions));
app.patch('/api/users/update/email', authenticateUser, (req, res) => {
  alterDataWithTokens.verifyTokenAndAlterUserEmail(req, res);
});
app.options('*', cors(corsOptions));
app.post('/api/users/info', authenticateUser, (req, res) => {
  users.getUserData(req, res);
});
app.options('*', cors(corsOptions));
app.patch('/api/users/update/userphoto', authenticateClient, (req, res) => {
  users.insertUserPhoto(req, res);
});

//SISTEMA
app.post('/api/system/verify/email', authenticateClient, (req, res) => {
  users.verifyUserEmail(req, res);
});
app.options('*', cors(corsOptions));
app.post('/api/system/users/unban', authenticateClient, (req, res) => {
  users.unBanUser(req, res);
});
app.options('*', cors(corsOptions));
app.post('/api/system/users/unblock', authenticateClient, (req, res) => {
  users.unBlockUser(req, res);
});
app.options('*', cors(corsOptions));
app.get('/api/system/usertypes', authenticateClient, (req, res) => {
  system.getUserTypes(req, res);
});
app.options('*', cors(corsOptions));
app.get('/api/system/city/id/:cityid', authenticateClient, (req, res) => {
  system.getCityByID(req, res);
});
app.options('*', cors(corsOptions));
app.get('/api/system/city/name/:cityname', authenticateClient, (req, res) => {
  system.getCityByName(req, res);
});
app.options('*', cors(corsOptions));
app.get('/api/system/state/id/:stateid', authenticateClient, (req, res) => {
  system.getStateByID(req, res);
});
app.options('*', cors(corsOptions));
app.get('/api/system/state/name/:statename', authenticateClient, (req, res) => {
  system.getStateByName(req, res);
});
app.options('*', cors(corsOptions));
app.get('/api/system/state/abbreviation/:stateab', authenticateClient, (req, res) => {
  system.getStateByAb(req, res);
});
app.options('*', cors(corsOptions));
app.get('/api/system/gender/id/:genderid', authenticateClient, (req, res) => {
  system.getGenderByID(req, res);
});
app.options('*', cors(corsOptions));
app.get('/api/system/gender/name/:gendername', authenticateClient, (req, res) => {
  system.getGenderByName(req, res);
});
app.options('*', cors(corsOptions));
app.get('/api/system/cep/:postalcode', authenticateClient, (req, res) => {
  system.getPostalCode(req, res);
});



//ERRO PARA REQUESTS NÃO SUPORTADOS.
app.use('/api', (req, res) => {
  res.status(405).json({ message: 'Método não suportado' });
});
app.use('/api/', (req, res) => {
  res.status(405).json({ message: 'Método não suportado' });
});
app.get('/', (req, res) => {
  res.json({ message: 'Versão da API: ' + process.env.API_VERSION });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta:${PORT}`);
});

module.exports = {
  connection
};