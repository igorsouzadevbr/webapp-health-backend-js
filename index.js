const express = require('express');
const http = require('http');
const https = require('https');
const server = http.createServer(http);
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const fs = require('fs');
const app = express();
const options = {
  key: fs.readFileSync('./cert/key.pem'),
  cert: fs.readFileSync('./cert/cert.pem')
};
const socketServer = https.createServer(options, app);
const bodyParser = require('body-parser');

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
app.options('*', cors(corsOptions));
app.use(express.json());

//depends
const secretTokenKey = '0de6d8af5b6d3d908eca1e93cb5c9f384803ee7ee63ae1c5105e7baa475eca99';
const adminSecretTokenKey = '3E5E085DBA7951B401D811CAE24DF052C6D91065B2ACCE3833EE7CD52A9DA330';
const attendantSecretTokenKey = '2EC250AC6273C76BC50E7C8E1D7141632A9D35D131EFF249341FAAB2F798EF9F'

const dotenv = require('dotenv');
const Login = require('./auth/login');
const Users = require('./api/user/users');
const System = require('./api/system');

const AttendantFlow = require('./api/chatFlow/attendantFlow');
const PatientFlow = require('./api/chatFlow/patientFlow');

const SocketConnection = require('./api/chatFlow/socketConnection.js');

const AdminFunctions = require('./api/admin/functions');
const AttendantFunctions = require('./api/attendant/functions');
const ProfessionalFunctions = require('./api/professional/functions');
const DatabaseUtils = require('./api/util/databaseUtils');
const AlterDataWithTokens = require('./api/user/alterDataWithTokens');
const ScheduleFunctions = require('./api/schedule/locations.js');

//limitador de requisições -- importante identificar o uso real do webapp para deixar em um número bacana de requisições x tempo.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: "Você excedeu olimite de requisições em 15 minutos."
});
app.use('/api/', limiter);
app.set('trust proxy', 1);
//configuração de ambiente - development - test or production
process.env.NODE_ENV = 'development';


const ENV = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${ENV}` });

//Banco de Dados
const connection = mysql.createPool({
  connectionLimit: 10000,
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

const socketConnection = new SocketConnection(socketServer, connection);


//ROTAS DE AUTENTICAÇÃO
const clientLogin = new Login(secretTokenKey);

app.post('/api/auth', (req, res) => {
  clientLogin.login(req, res);
});
const adminLogin = new Login(adminSecretTokenKey);

app.post('/api/admin/auth', (req, res) => {
  adminLogin.login(req, res);
});
const attendantLogin = new Login(attendantSecretTokenKey);

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

const authenticateUser = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const secretKey = req.body.secretKey;
  if (!token) { return res.status(401).send({ message: 'O token de autenticação fornecido é inválido.' }); }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) { return res.status(403).send({ message: 'O token de autenticação fornecido está expirado.' }); }
    next();
  });
};

//FIM DA ROTA DE AUTENTICAÇÃO
const users = new Users(connection);
const attendantFlow = new AttendantFlow(connection);
const patientFlow = new PatientFlow(connection);
const system = new System(connection);
const attendantFunctions = new AttendantFunctions(connection);
const professionalFunctions = new ProfessionalFunctions(connection);
const adminFunctions = new AdminFunctions(connection);
const databaseUtils = new DatabaseUtils(connection);
const alterDataWithTokens = new AlterDataWithTokens(connection);
const scheduleFunctions = new ScheduleFunctions(connection);

//ROTA DE CHAT -- FLUXOS & DEMAIS

app.post('/api/attendant/queue/get', authenticateClient, (req, res) => {
  attendantFlow.listChatQueue(req, res);
});

app.post('/api/attendant/queue/scheduled/get', authenticateClient, (req, res) => {
  attendantFlow.listChatQueueScheduled(req, res);
});

app.post('/api/attendant/queue/accept', authenticateClient, (req, res) => {
  attendantFlow.acceptChat(req, res);
});

app.post('/api/attendant/get', authenticateClient, (req, res) => {
  attendantFlow.getAttendantData(req, res);
});

app.post('/api/patient/get', authenticateClient, (req, res) => {
  patientFlow.getPatientData(req, res);
});

app.get('/api/chat/categories/get', authenticateClient, (req, res) => {
  system.getAllCategoriesWithAttendantsAvailable(req, res);
});

app.get('/api/chat/attendant/get', authenticateClient, (req, res) => {
  attendantFlow.getAllAttendantsFromDB(req, res);
});
app.get('/api/chat/attendant/get/pagination', authenticateClient, (req, res) => {
  attendantFlow.getAllAttendantsFromDBWithPagination(req, res);
});

app.post('/api/chat/attendant/get/category', authenticateClient, (req, res) => {
  attendantFlow.getAttendantsByCategoryFromDB(req, res);
});

//ROTA API -- ADMINS & DEMAIS

app.post('/api/chat/quiz/get', authenticateClient, (req, res) => {
  system.getQuizFromConversation(req, res);
});

app.post('/api/chat/get', authenticateClient, (req, res) => {
  system.getAllMessagesFromConversation(req, res);
});

app.post('/api/chat/queue/enter', authenticateClient, (req, res) => {
  patientFlow.callAttendant(req, res);
});

app.post('/api/chat/queue/attendant/enter', authenticateClient, (req, res) => {
  attendantFlow.turnAttendantOnline(req, res);
});

app.post('/api/chat/queue/attendant/leave', authenticateClient, (req, res) => {
  attendantFlow.turnAttendantOffline(req, res);
});

app.put('/api/admin/users/create', authenticateClient, (req, res) => {
  adminFunctions.create(req, res);
});

app.put('/api/attendant/users/create', authenticateClient, (req, res) => {
  attendantFunctions.create(req, res);
});

app.post('/api/attendant/approve', authenticateClient, (req, res) => {
  attendantFunctions.approveAttendant(req, res);
});

app.patch('/api/attendant/users/update', authenticateClient, (req, res) => {
  attendantFunctions.alterAttendantData(req, res);
});

// app.put('/api/professional/users/create', authenticateClient, (req, res) => {
//   professionalFunctions.create(req, res);
// });

//ROTA API -- USUARIOS

app.post('/api/schedules/location/create', authenticateClient, (req, res) => {
  scheduleFunctions.createLocation(req, res);
});

app.post('/api/schedules/location/get', authenticateClient, (req, res) => {
  scheduleFunctions.getLocation(req, res);
});

app.post('/api/schedules/professional/get', authenticateClient, (req, res) => {
  users.getHoursByAttendants(req, res);
});

app.post('/api/schedules/date/get', authenticateClient, (req, res) => {
  users.listUnavailableHours(req, res);
});

app.post('/api/schedules/patient/verify', authenticateClient, (req, res) => {
  users.verifySchedule(req, res);
});

app.post('/api/attendant/schedules/accept', authenticateClient, (req, res) => {
  attendantFlow.acceptPendingSchedule(req, res);
});

app.post('/api/schedules/create', authenticateClient, (req, res) => {
  users.createSchedule(req, res);
});

app.post('/api/schedules/patient/get', authenticateClient, (req, res) => {
  users.listSchedules(req, res);
});

app.post('/api/attendant/schedules/pending/get', authenticateClient, (req, res) => {
  attendantFlow.listSchedulesPending(req, res);
});

app.post('/api/attendant/schedules/confirmed/get', authenticateClient, (req, res) => {
  attendantFlow.listSchedulesConfirmed(req, res);
});

app.put('/api/users/create', authenticateClient, (req, res) => {
  users.create(req, res);
});

app.post('/api/users/create/location', authenticateClient, (req, res) => {
  users.createLocation(req, res);
});

app.patch('/api/users/update/location', authenticateClient, (req, res) => {
  users.createLocation(req, res);
});

app.patch('/api/users/update', authenticateClient, (req, res) => {
  users.alterUserData(req, res);
});

app.post('/api/users/login', authenticateClient, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  users.verifyLogin(req, res, token);
});
//mudar o codigo dos demais metodos

app.post('/api/users/update/token/password', authenticateClient, (req, res) => {
  alterDataWithTokens.getTokenToAlterUserPassword(req, res);
});

app.patch('/api/users/update/password', authenticateClient, (req, res) => {
  alterDataWithTokens.verifyTokenAndAlterUserPassword(req, res);
});

app.get('/api/users/update/token/email', authenticateUser, (req, res) => {
  alterDataWithTokens.getTokenToAlterUserEmail(req, res);
});

app.patch('/api/users/update/email', authenticateUser, (req, res) => {
  alterDataWithTokens.verifyTokenAndAlterUserEmail(req, res);
});

app.post('/api/users/info', authenticateClient, (req, res) => {
  users.getUserData(req, res);
});

app.post('/api/users/location/info', authenticateClient, (req, res) => {
  users.getUserAddressData(req, res);
});

app.patch('/api/users/update/userphoto', authenticateClient, (req, res) => {
  users.insertUserPhoto(req, res);
});

//SISTEMA
app.post('/api/system/verify/email', authenticateClient, (req, res) => {
  users.verifyUserEmail(req, res);
});

app.post('/api/system/users/unban', authenticateClient, (req, res) => {
  users.unBanUser(req, res);
});

app.post('/api/system/users/unblock', authenticateClient, (req, res) => {
  users.unBlockUser(req, res);
});

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

app.get('/api/system/cep/:postalcode', authenticateClient, (req, res) => {
  system.getPostalCode(req, res);
});

app.post('/api/system/verify/attendant', authenticateClient, (req, res) => {
  system.verifyIfAttendantIsAvailable(req, res);
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

server.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta:${PORT}`);
});

const portSocket = process.env.PORT_SOCKET || 3001;
socketServer.listen(portSocket, () => {
  console.log(`Servidor Socket.IO ouvindo na porta: ${portSocket}`);
});

module.exports = {
  connection
};